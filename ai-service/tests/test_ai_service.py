"""Comprehensive unit and API contract tests (AI-01..AI-05) for Bhakti Praja AI Service."""

from __future__ import annotations

import asyncio
import json
import unittest
from typing import Any

import httpx
import numpy as np
import pymupdf
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.ollama_client import OllamaClient, OllamaUnavailableError, parse_json_object
from app.pdf_extractor import PdfExtractionError, extract_pdf_text
from app.rag_pipeline import EphemeralRagIndex, chunk_document
from app.schemas import (
    SchemaValidationError,
    build_final_quiz_payload,
    extract_valid_questions,
)


def _make_sample_pdf(pages_text: list[str], *, repeating_header: str | None = None) -> bytes:
    doc = pymupdf.open()
    for text in pages_text:
        page = doc.new_page()
        body = f"{repeating_header}\n{text}" if repeating_header else text
        page.insert_textbox(pymupdf.Rect(50, 50, 540, 780), body, fontsize=11)
    try:
        return doc.tobytes()
    finally:
        doc.close()


def _mock_ollama_questions(prefix: str, count: int, start_idx: int = 1) -> dict[str, Any]:
    return {
        "title": "Kuis Dasar Jaringan Komputer",
        "description": "Evaluasi otomatis berbasis modul PDF.",
        "questions": [
            {
                "question_type": "multiple_choice",
                "question_text": f"{prefix} Pertanyaan nomor {start_idx + i} tentang topologi dan protokol?",
                "options": [
                    {"option_label": "A", "option_text": f"Jawaban salah {i}-A", "is_correct": i % 4 == 0},
                    {"option_label": "B", "option_text": f"Jawaban B {i}", "is_correct": i % 4 == 1},
                    {"option_label": "C", "option_text": f"Jawaban C {i}", "is_correct": i % 4 == 2},
                    {"option_label": "D", "option_text": f"Jawaban D {i}", "is_correct": i % 4 == 3},
                ],
            }
            for i in range(count)
        ],
    }


class TestPdfExtractor(unittest.TestCase):
    """AI-01: PDF validation, extraction, boilerplate stripping, and scan rejection."""

    def test_valid_pdf_extracts_text_and_strips_repeating_header(self) -> None:
        pdf = _make_sample_pdf(
            [
                f"Halaman {i}: Protokol TCP/IP membagi data menjadi paket melalui lapisan transport dan network."
                for i in range(1, 6)
            ],
            repeating_header="SMK BHAKTI PRAJA BATANG - MODUL TKJ",
        )
        doc = extract_pdf_text(pdf, max_pdf_bytes=5_000_000, min_extracted_chars=50)
        self.assertEqual(doc.page_count, 5)
        self.assertGreaterEqual(doc.total_chars, 50)
        for page in doc.pages:
            self.assertNotIn("SMK BHAKTI PRAJA BATANG - MODUL TKJ", page.text)

    def test_rejects_non_pdf_header_and_scanned_empty_pdf(self) -> None:
        with self.assertRaises(PdfExtractionError):
            extract_pdf_text(b"NOT A PDF", max_pdf_bytes=1024, min_extracted_chars=10)

        blank_pdf = _make_sample_pdf(["   "])
        with self.assertRaises(PdfExtractionError):
            extract_pdf_text(blank_pdf, max_pdf_bytes=1_000_000, min_extracted_chars=50)


class TestRagPipeline(unittest.TestCase):
    """AI-02: Overlapping chunking and section-stratified + hybrid retrieval."""

    def test_chunking_respects_overlap_and_batch_coverage(self) -> None:
        pages = [
            f"Bab {i}. " + ("Router meneruskan paket antar jaringan menggunakan tabel routing dinamis OSPF. " * 25)
            for i in range(1, 9)
        ]
        pdf = _make_sample_pdf(pages)
        doc = extract_pdf_text(pdf, max_pdf_bytes=5_000_000, min_extracted_chars=50)
        chunks = chunk_document(doc, chunk_size=1200, chunk_overlap=200)
        self.assertGreater(len(chunks), 4)
        for chunk in chunks:
            self.assertLessEqual(chunk.page_start, chunk.page_end)

        index = EphemeralRagIndex(chunks)
        used: set[int] = set()
        batch_1 = index.select_chunks_for_batch(batch_index=0, total_batches=2, max_chunks=2, used_chunk_indices=used)
        batch_2 = index.select_chunks_for_batch(batch_index=1, total_batches=2, max_chunks=2, used_chunk_indices=used)
        self.assertEqual(len(batch_1), 2)
        self.assertEqual(len(batch_2), 2)
        self.assertNotEqual([c.index for c in batch_1], [c.index for c in batch_2])

    def test_hybrid_embeddings_boost_matching_chunk(self) -> None:
        pdf = _make_sample_pdf(["A " * 80, "B " * 80, "C " * 80])
        doc = extract_pdf_text(pdf, max_pdf_bytes=5_000_000, min_extracted_chars=50)
        chunks = chunk_document(doc, chunk_size=100, chunk_overlap=0)
        embs = np.eye(len(chunks), dtype=np.float32)
        index = EphemeralRagIndex(chunks, embeddings=embs)
        query_vec = [0.0] * len(chunks)
        query_vec[-1] = 1.0
        selected = index.select_chunks_for_batch(
            batch_index=0,
            total_batches=2,
            max_chunks=1,
            used_chunk_indices=set(),
            query_embedding=query_vec,
        )
        self.assertEqual(len(selected), 1)


class TestSchemaNormalization(unittest.TestCase):
    """AI-03: Strict GeneratedQuizValidator parity, dedup, and size bounds."""

    def test_extracts_valid_and_rejects_malformed_or_duplicate_questions(self) -> None:
        raw = {
            "title": "Kuis Evaluasi",
            "questions": [
                _mock_ollama_questions("Sesi1", 1, 1)["questions"][0],
                _mock_ollama_questions("Sesi1", 1, 1)["questions"][0],  # duplicate
                {  # invalid: two correct options
                    "question_text": "Soal rusak dua jawaban benar?",
                    "options": [
                        {"option_label": "A", "option_text": "1", "is_correct": True},
                        {"option_label": "B", "option_text": "2", "is_correct": True},
                        {"option_label": "C", "option_text": "3", "is_correct": False},
                        {"option_label": "D", "option_text": "4", "is_correct": False},
                    ],
                },
            ],
        }
        valid = extract_valid_questions(raw)
        self.assertEqual(len(valid), 1)
        payload = build_final_quiz_payload(
            raw["title"],
            "Deskripsi singkat",
            valid,
            expected_count=1,
            fallback_title="Fallback",
            max_response_bytes=1048576,
        )
        self.assertEqual(payload["questions"][0]["options"][0]["option_label"], "A")
        with self.assertRaises(SchemaValidationError):
            build_final_quiz_payload(
                raw["title"],
                None,
                valid,
                expected_count=2,
                fallback_title="Fallback",
                max_response_bytes=1048576,
            )

    def test_expands_compact_ollama_schema_to_canonical_laravel_schema(self) -> None:
        compact_raw = {
            "title": "Kuis Kompak",
            "questions": [
                {
                    "question": "Protokol apa yang digunakan ping?",
                    "A": "TCP",
                    "B": "ICMP",
                    "C": "DNS",
                    "D": "DHCP",
                    "answer": "B",
                }
            ],
        }
        valid = extract_valid_questions(compact_raw)
        self.assertEqual(len(valid), 1)
        payload = build_final_quiz_payload(
            compact_raw["title"],
            None,
            valid,
            expected_count=1,
            fallback_title="Fallback",
            max_response_bytes=1048576,
        )
        opts = payload["questions"][0]["options"]
        self.assertEqual([o["option_label"] for o in opts], ["A", "B", "C", "D"])
        self.assertEqual([o["is_correct"] for o in opts], [False, True, False, False])

        # Multi-question batch rebalances answer keys evenly across A, B, C, D when model picks all A
        biased_raw = {
            "title": "Kuis Terdistribusi",
            "questions": [
                {
                    "question": f"Pertanyaan unik #{idx}?",
                    "A": f"Benar {idx}",
                    "B": f"Salah B {idx}",
                    "C": f"Salah C {idx}",
                    "D": f"Salah D {idx}",
                    "answer": "A",
                }
                for idx in range(4)
            ],
        }
        multi_valid = extract_valid_questions(biased_raw)
        multi_payload = build_final_quiz_payload(
            biased_raw["title"],
            None,
            multi_valid,
            expected_count=4,
            fallback_title="Fallback",
            max_response_bytes=1048576,
        )
        keys = [
            next(o["option_label"] for o in q["options"] if o["is_correct"])
            for q in multi_payload["questions"]
        ]
        self.assertEqual(keys, ["A", "B", "C", "D"])


class TestOllamaClientParsing(unittest.IsolatedAsyncioTestCase):
    """AI-04: JSON extraction (including <think> strip) and error handling."""

    def test_parses_json_wrapped_in_think_and_fence(self) -> None:
        text = "<think>reasoning step</think>\n```json\n{\"title\": \"T\", \"questions\": []}\n```"
        parsed = parse_json_object(text)
        self.assertEqual(parsed["title"], "T")

    async def test_503_from_ollama_raises_unavailable_error(self) -> None:
        transport = httpx.MockTransport(lambda req: httpx.Response(503, text="busy"))
        async_http = httpx.AsyncClient(base_url="http://127.0.0.1:11434", transport=transport)
        client = OllamaClient(base_url="http://127.0.0.1:11434", model="qwen3:4b", http_client=async_http)
        try:
            with self.assertRaises(OllamaUnavailableError):
                await client.chat_json(
                    messages=[{"role": "user", "content": "hi"}],
                    json_schema={"type": "object"},
                    timeout_seconds=10.0,
                )
        finally:
            await async_http.aclose()


class TestFastApiContract(unittest.TestCase):
    """AI-05: End-to-end FastAPI contract matching Laravel HttpQuizGenerator."""

    def _build_test_client(self, handler) -> tuple[TestClient, httpx.AsyncClient]:
        transport = httpx.MockTransport(handler)
        async_http = httpx.AsyncClient(base_url="http://127.0.0.1:11434", transport=transport)
        ollama = OllamaClient(base_url="http://127.0.0.1:11434", model="qwen3:4b", http_client=async_http)
        settings = Settings(
            _env_file=None,
            ai_service_api_key="test-shared-secret",
            ollama_model="qwen3:4b",
            max_questions_per_batch=6,
            ollama_timeout_seconds=30.0,
        )
        app = create_app(settings_override=settings, ollama_client_override=ollama)
        return TestClient(app), async_http

    def test_auth_rejection_and_successful_batched_generation_with_idempotency(self) -> None:
        calls = 0

        def ollama_handler(request: httpx.Request) -> httpx.Response:
            nonlocal calls
            if request.url.path == "/api/tags":
                return httpx.Response(200, json={"models": [{"name": "qwen3:4b"}]})
            calls += 1
            data = _mock_ollama_questions(f"Batch{calls}", 6, start_idx=(calls - 1) * 6 + 1)
            return httpx.Response(200, json={"message": {"content": json.dumps(data)}})

        pdf = _make_sample_pdf(
            [f"Materi TKJ halaman {i}: " + ("VLAN memisahkan broadcast domain pada switch layer 2. " * 10) for i in range(1, 5)]
        )
        client, async_http = self._build_test_client(ollama_handler)
        try:
            with client:
                health = client.get("/health")
                self.assertEqual(health.status_code, 200)
                self.assertEqual(health.json()["status"], "ok")

                # 401 without valid Bearer token
                unauth = client.post(
                    "/generate-quiz",
                    files={"file": ("module-1.pdf", pdf, "application/pdf")},
                    data={"question_count": "5", "language": "id"},
                )
                self.assertEqual(unauth.status_code, 401)

                # 200 batched generation (12 questions across 2 calls of 6)
                headers = {
                    "Authorization": "Bearer test-shared-secret",
                    "Idempotency-Key": "quiz-generation-99",
                }
                res = client.post(
                    "/generate-quiz",
                    headers=headers,
                    files={"file": ("module-1.pdf", pdf, "application/pdf")},
                    data={"question_count": "12", "language": "id"},
                )
                self.assertEqual(res.status_code, 200, res.text)
                body = res.json()
                self.assertEqual(len(body["questions"]), 12)
                self.assertEqual(calls, 2)
                for q in body["questions"]:
                    self.assertEqual(q["question_type"], "multiple_choice")
                    self.assertEqual([o["option_label"] for o in q["options"]], ["A", "B", "C", "D"])
                    self.assertEqual(sum(1 for o in q["options"] if o["is_correct"]), 1)

                # Repeat request with same Idempotency-Key returns cached result without calling Ollama again
                res_repeat = client.post(
                    "/generate-quiz",
                    headers=headers,
                    files={"file": ("module-1.pdf", pdf, "application/pdf")},
                    data={"question_count": "12", "language": "id"},
                )
                self.assertEqual(res_repeat.status_code, 200)
                self.assertEqual(calls, 2)
                self.assertEqual(res_repeat.json(), body)
        finally:
            asyncio.run(async_http.aclose())

    def test_returns_503_when_ollama_unreachable_and_422_on_scanned_pdf(self) -> None:
        def failing_handler(request: httpx.Request) -> httpx.Response:
            raise httpx.ConnectError("Connection refused", request=request)

        valid_pdf = _make_sample_pdf(
            ["Topik keamanan jaringan firewall stateless dan stateful inspection untuk siswa SMK TKJ."] * 2
        )
        blank_pdf = _make_sample_pdf(["   "])
        client, async_http = self._build_test_client(failing_handler)
        try:
            with client:
                bad_pdf = client.post(
                    "/generate-quiz",
                    headers={"Authorization": "Bearer test-shared-secret"},
                    files={"file": ("scan.pdf", blank_pdf, "application/pdf")},
                    data={"question_count": "5", "language": "id"},
                )
                self.assertEqual(bad_pdf.status_code, 422)

                down = client.post(
                    "/generate-quiz",
                    headers={"Authorization": "Bearer test-shared-secret"},
                    files={"file": ("module.pdf", valid_pdf, "application/pdf")},
                    data={"question_count": "5", "language": "id"},
                )
                self.assertEqual(down.status_code, 503)
        finally:
            asyncio.run(async_http.aclose())


if __name__ == "__main__":
    unittest.main()
