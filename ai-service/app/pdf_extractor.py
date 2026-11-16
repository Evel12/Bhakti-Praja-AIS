"""PDF binary verification, text extraction, and scanned/corrupt detection via PyMuPDF."""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass
import pymupdf


class PdfExtractionError(ValueError):
    """Raised when uploaded PDF is malformed, encrypted, unreadable, or lacks extractable text."""


@dataclass(slots=True)
class ExtractedPage:
    """Cleaned text belonging to a single PDF page."""

    page_number: int
    text: str


@dataclass(slots=True)
class ExtractedDocument:
    """Extracted document representation with page provenance."""

    page_count: int
    total_chars: int
    pages: list[ExtractedPage]


def _normalize_line(line: str) -> str:
    return re.sub(r"\s+", " ", line).strip()


def _strip_repeating_edge_lines(page_lines: list[list[str]]) -> list[list[str]]:
    """Remove boilerplate lines repeated identically across >=60% of pages (headers/footers)."""
    if len(page_lines) < 4:
        return page_lines

    edge_counts: Counter[str] = Counter()
    for lines in page_lines:
        if not lines:
            continue
        candidates = {lines[0]}
        if len(lines) > 1:
            candidates.add(lines[-1])
        for line in candidates:
            if len(line) <= 120:
                edge_counts[line] += 1

    threshold = max(3, int(len(page_lines) * 0.6))
    boilerplate = {line for line, cnt in edge_counts.items() if cnt >= threshold}
    if not boilerplate:
        return page_lines

    cleaned: list[list[str]] = []
    for lines in page_lines:
        filtered = [line for line in lines if line not in boilerplate]
        cleaned.append(filtered)
    return cleaned


def extract_pdf_text(
    pdf_bytes: bytes,
    *,
    max_pdf_bytes: int,
    min_extracted_chars: int = 100,
) -> ExtractedDocument:
    """Validate PDF signature/size and extract clean multi-page text."""
    if not pdf_bytes:
        raise PdfExtractionError("File PDF kosong.")
    if len(pdf_bytes) > max_pdf_bytes:
        raise PdfExtractionError(
            f"Ukuran file PDF melebihi batas maksimal {max_pdf_bytes} byte."
        )
    if not pdf_bytes.startswith(b"%PDF-"):
        raise PdfExtractionError("Berkas tidak memiliki header %PDF- yang valid.")

    doc = None
    try:
        doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    except Exception as exc:
        raise PdfExtractionError("Berkas PDF korup atau tidak dapat dibuka.") from exc

    try:
        if doc.needs_pass:
            raise PdfExtractionError("Berkas PDF terenkripsi kata sandi dan tidak dapat diproses.")

        page_count = doc.page_count
        if page_count == 0:
            raise PdfExtractionError("Berkas PDF tidak memiliki halaman.")

        raw_page_lines: list[list[str]] = []
        for idx in range(page_count):
            page = doc.load_page(idx)
            raw_text = page.get_text("text") or ""
            lines = [_normalize_line(line) for line in raw_text.splitlines()]
            lines = [line for line in lines if line]
            raw_page_lines.append(lines)

        cleaned_page_lines = _strip_repeating_edge_lines(raw_page_lines)

        pages: list[ExtractedPage] = []
        total_meaningful_chars = 0
        for idx, lines in enumerate(cleaned_page_lines, start=1):
            joined = "\n".join(lines).strip()
            if not joined:
                continue
            pages.append(ExtractedPage(page_number=idx, text=joined))
            total_meaningful_chars += len(re.sub(r"\s+", "", joined))

        if total_meaningful_chars < min_extracted_chars or not pages:
            raise PdfExtractionError(
                "Teks PDF tidak mencukupi atau merupakan PDF hasil pindaian (scan gambar) tanpa layer teks."
            )

        return ExtractedDocument(
            page_count=page_count,
            total_chars=total_meaningful_chars,
            pages=pages,
        )
    finally:
        if doc is not None:
            doc.close()
