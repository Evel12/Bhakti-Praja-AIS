"""Per-request overlapping chunking and ephemeral hybrid RAG context retrieval."""

from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass
from typing import Sequence

import numpy as np

from app.pdf_extractor import ExtractedDocument

_INDONESIAN_STOPWORDS = frozenset(
    {
        "yang", "dan", "di", "ke", "dari", "pada", "untuk", "dengan", "atau",
        "ini", "itu", "adalah", "sebagai", "dalam", "oleh", "tersebut", "dapat",
        "akan", "juga", "karena", "jika", "bila", "agar", "saat", "tidak",
        "bukan", "lebih", "sudah", "belum", "harus", "bisa", "antara", "serta",
        "the", "and", "of", "to", "in", "is", "for", "with", "that", "as",
    }
)


@dataclass(slots=True)
class DocumentChunk:
    """Single overlapping chunk traced back to PDF page boundaries."""

    index: int
    page_start: int
    page_end: int
    text: str


def _tokenize(text: str) -> list[str]:
    tokens = re.findall(r"[0-9a-zA-Z]{2,}", text.lower())
    return [tok for tok in tokens if tok not in _INDONESIAN_STOPWORDS]


def _find_split_point(text: str, start: int, target_end: int) -> int:
    """Find a clean newline or sentence boundary near target_end without stalling."""
    if target_end >= len(text):
        return len(text)
    search_floor = start + max(100, int((target_end - start) * 0.65))
    for sep in ("\n\n", "\n", ". ", " "):
        pos = text.rfind(sep, search_floor, target_end)
        if pos != -1 and pos > start:
            return pos + len(sep)
    return target_end


def chunk_document(
    document: ExtractedDocument,
    *,
    chunk_size: int = 2200,
    chunk_overlap: int = 200,
) -> list[DocumentChunk]:
    """Split extracted PDF pages into overlapping chunks while preserving page provenance."""
    if chunk_overlap >= chunk_size:
        chunk_overlap = max(0, chunk_size // 4)

    segments: list[tuple[int, int, int]] = []
    cursor = 0
    combined_parts: list[str] = []
    for page in document.pages:
        part = f"[Halaman {page.page_number}]\n{page.text}"
        start = cursor
        combined_parts.append(part)
        cursor += len(part)
        segments.append((start, cursor, page.page_number))
        combined_parts.append("\n\n")
        cursor += 2

    full_text = "".join(combined_parts).strip()
    if not full_text:
        return []

    chunks: list[DocumentChunk] = []
    pos = 0
    chunk_idx = 0
    text_len = len(full_text)

    while pos < text_len:
        raw_end = min(text_len, pos + chunk_size)
        end = _find_split_point(full_text, pos, raw_end)
        chunk_text = full_text[pos:end].strip()
        if chunk_text:
            overlapping_pages = [
                page_no
                for seg_start, seg_end, page_no in segments
                if seg_end > pos and seg_start < end
            ]
            page_start = min(overlapping_pages) if overlapping_pages else document.pages[0].page_number
            page_end = max(overlapping_pages) if overlapping_pages else document.pages[-1].page_number
            chunks.append(
                DocumentChunk(
                    index=chunk_idx,
                    page_start=page_start,
                    page_end=page_end,
                    text=chunk_text,
                )
            )
            chunk_idx += 1

        if end >= text_len:
            break
        next_pos = max(pos + 1, end - chunk_overlap)
        pos = next_pos

    return chunks


class EphemeralRagIndex:
    """Ephemeral per-request chunk index combining BM25 lexical scores and optional Ollama embeddings."""

    def __init__(
        self,
        chunks: list[DocumentChunk],
        embeddings: np.ndarray | None = None,
    ) -> None:
        self.chunks = chunks
        self._chunk_tokens = [_tokenize(c.text) for c in chunks]
        self._doc_freqs: Counter[str] = Counter()
        for toks in self._chunk_tokens:
            self._doc_freqs.update(set(toks))
        self._avg_len = (
            sum(len(t) for t in self._chunk_tokens) / max(1, len(self._chunk_tokens))
        )
        self._embeddings = self._normalize_embeddings(embeddings)

    @staticmethod
    def _normalize_embeddings(embeddings: Sequence[Sequence[float]] | np.ndarray | None) -> np.ndarray | None:
        if embeddings is None:
            return None
        arr = np.asarray(embeddings, dtype=np.float32)
        if arr.ndim != 2 or arr.shape[0] == 0:
            return None
        norms = np.linalg.norm(arr, axis=1, keepdims=True)
        norms = np.where(norms == 0.0, 1.0, norms)
        return arr / norms

    def bm25_scores(self, query: str) -> np.ndarray:
        """Compute BM25 similarity across chunks for a query string."""
        n_docs = len(self.chunks)
        if n_docs == 0:
            return np.zeros(0, dtype=np.float32)

        q_tokens = _tokenize(query)
        if not q_tokens:
            return np.zeros(n_docs, dtype=np.float32)

        k1 = 1.5
        b = 0.75
        scores = np.zeros(n_docs, dtype=np.float32)
        for doc_idx, toks in enumerate(self._chunk_tokens):
            if not toks:
                continue
            tf_counts = Counter(toks)
            doc_len = len(toks)
            score = 0.0
            for qt in q_tokens:
                tf = tf_counts.get(qt, 0)
                if tf == 0:
                    continue
                df = self._doc_freqs.get(qt, 0)
                idf = math.log((n_docs - df + 0.5) / (df + 0.5) + 1.0)
                denom = tf + k1 * (1.0 - b + b * (doc_len / max(1.0, self._avg_len)))
                score += idf * ((tf * (k1 + 1.0)) / denom)
            scores[doc_idx] = float(score)

        max_score = float(scores.max()) if scores.size else 0.0
        if max_score > 0.0:
            scores = scores / max_score
        return scores

    def select_chunks_for_batch(
        self,
        *,
        batch_index: int,
        total_batches: int,
        max_chunks: int,
        used_chunk_indices: set[int],
        query_embedding: Sequence[float] | None = None,
        query_text: str = "",
    ) -> list[DocumentChunk]:
        """Select diverse, section-balanced chunks for a generation batch."""
        n = len(self.chunks)
        if n <= max_chunks:
            return list(self.chunks)

        # Stratified windowing distributes question coverage across all pages/sections.
        window_size = max(1, math.ceil(n / max(1, total_batches)))
        start_anchor = (batch_index * window_size) % n

        lexical = self.bm25_scores(query_text) if query_text else np.zeros(n, dtype=np.float32)
        semantic = np.zeros(n, dtype=np.float32)
        if self._embeddings is not None and query_embedding is not None and len(query_embedding) == self._embeddings.shape[1]:
            q_vec = np.asarray(query_embedding, dtype=np.float32)
            q_norm = float(np.linalg.norm(q_vec))
            if q_norm > 0.0:
                q_vec = q_vec / q_norm
                semantic = np.clip(self._embeddings @ q_vec, 0.0, 1.0)

        ranked_candidates: list[tuple[float, int]] = []
        for idx in range(n):
            # Prioritize chunks inside this batch's section slice, plus unused diversity bonus.
            distance = (idx - start_anchor) % n
            in_slice_bonus = 1.0 if distance < window_size else 0.2 / (1.0 + distance)
            novelty_bonus = 0.6 if idx not in used_chunk_indices else 0.0
            relevance = (0.65 * float(semantic[idx]) + 0.35 * float(lexical[idx])) if self._embeddings is not None else float(lexical[idx])
            score = in_slice_bonus + novelty_bonus + 0.5 * relevance
            ranked_candidates.append((score, idx))

        ranked_candidates.sort(key=lambda item: (-item[0], item[1]))
        chosen_indices = sorted(idx for _, idx in ranked_candidates[:max_chunks])
        used_chunk_indices.update(chosen_indices)
        return [self.chunks[idx] for idx in chosen_indices]
