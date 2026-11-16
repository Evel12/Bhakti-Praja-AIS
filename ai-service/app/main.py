"""FastAPI entry point implementing /health and /generate-quiz for Laravel HttpQuizGenerator."""

from __future__ import annotations

import asyncio
import logging
import math
import os
import time
from contextlib import asynccontextmanager
from typing import Any

logger = logging.getLogger("uvicorn.error")

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, UploadFile, status

from app.auth import verify_bearer_token
from app.config import Settings, get_settings
from app.idempotency import IdempotencyConflictError, IdempotencyStore
from app.ollama_client import (
    OllamaBadOutputError,
    OllamaClient,
    OllamaUnavailableError,
)
from app.pdf_extractor import PdfExtractionError, extract_pdf_text
from app.prompt_builder import (
    build_quiz_messages,
    build_repair_messages,
    schema_for_batch,
)
from app.rag_pipeline import EphemeralRagIndex, chunk_document
from app.schemas import (
    QuizQuestionSchema,
    SchemaValidationError,
    build_final_quiz_payload,
    extract_valid_questions,
    question_fingerprint,
)


HTTP_422 = getattr(status, "HTTP_422_UNPROCESSABLE_CONTENT", 422)


def _derive_fallback_title(filename: str | None) -> str:
    stem = os.path.splitext(os.path.basename(filename or ""))[0]
    cleaned = stem.replace("-", " ").replace("_", " ").strip()
    if not cleaned or cleaned.lower().startswith("module "):
        return "Kuis Evaluasi Materi Pembelajaran"
    return f"Kuis: {cleaned[:240]}"


async def _read_bounded_upload(upload: UploadFile, max_bytes: int) -> bytes:
    chunks: list[bytes] = []
    total = 0
    chunk_size = 256 * 1024
    while True:
        chunk = await upload.read(chunk_size)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise PdfExtractionError(
                f"Ukuran berkas PDF melebihi batas maksimal {max_bytes} byte."
            )
        chunks.append(chunk)
    return b"".join(chunks)


def create_app(
    *,
    settings_override: Settings | None = None,
    ollama_client_override: OllamaClient | None = None,
) -> FastAPI:
    """Create FastAPI application instance with injectable settings/client for testing."""
    cfg = settings_override or get_settings()

    @asynccontextmanager
    async def lifespan(app_instance: FastAPI):
        client = ollama_client_override or OllamaClient(
            base_url=cfg.ollama_base_url,
            model=cfg.ollama_model,
            embed_model=cfg.ollama_embed_model,
            keep_alive=cfg.ollama_keep_alive,
            temperature=cfg.ollama_temperature,
            num_ctx=cfg.ollama_num_ctx,
        )
        app_instance.state.ollama_client = client
        app_instance.state.idempotency = IdempotencyStore(cfg.idempotency_ttl_seconds)
        try:
            yield
        finally:
            if ollama_client_override is None:
                await client.close()

    app = FastAPI(
        title="EXAMNIA Bhakti Praja AI Service",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.dependency_overrides[get_settings] = lambda: cfg

    @app.get("/health")
    async def health(request: Request) -> dict[str, Any]:
        client: OllamaClient = request.app.state.ollama_client
        ollama_info = await client.health()
        overall = "ok" if (ollama_info["ollama_reachable"] and ollama_info["model_ready"]) else "degraded"
        return {
            "status": overall,
            **ollama_info,
        }

    @app.post("/generate-quiz")
    async def generate_quiz(
        request: Request,
        _: str = Depends(verify_bearer_token),
        settings: Settings = Depends(get_settings),
        file: UploadFile = File(...),
        question_count: int = Form(...),
        language: str = Form("id"),
    ) -> dict[str, Any]:
        if question_count < 1 or question_count > 50:
            raise HTTPException(
                status_code=HTTP_422,
                detail="question_count must be between 1 and 50.",
            )

        try:
            pdf_bytes = await _read_bounded_upload(file, settings.max_pdf_bytes)
        except PdfExtractionError as exc:
            raise HTTPException(status_code=HTTP_422, detail=str(exc)) from exc
        finally:
            await file.close()

        idempotency_store: IdempotencyStore = request.app.state.idempotency
        idem_key = (request.headers.get("Idempotency-Key") or "").strip()
        fingerprint = IdempotencyStore.build_fingerprint(pdf_bytes, question_count, language)

        if idem_key:
            try:
                cached = await idempotency_store.get(idem_key, fingerprint)
            except IdempotencyConflictError as exc:
                raise HTTPException(status_code=HTTP_422, detail=str(exc)) from exc
            if cached is not None:
                return cached

            key_lock = await idempotency_store.lock_for(idem_key)
            async with key_lock:
                try:
                    cached = await idempotency_store.get(idem_key, fingerprint)
                except IdempotencyConflictError as exc:
                    raise HTTPException(status_code=HTTP_422, detail=str(exc)) from exc
                if cached is not None:
                    return cached

                result = await _run_generation_pipeline(
                    ollama_client=request.app.state.ollama_client,
                    settings=settings,
                    pdf_bytes=pdf_bytes,
                    filename=file.filename,
                    question_count=question_count,
                    language=language,
                )
                await idempotency_store.put(idem_key, fingerprint, result)
                return result

        return await _run_generation_pipeline(
            ollama_client=request.app.state.ollama_client,
            settings=settings,
            pdf_bytes=pdf_bytes,
            filename=file.filename,
            question_count=question_count,
            language=language,
        )

    return app


async def _run_generation_pipeline(
    *,
    ollama_client: OllamaClient,
    settings: Settings,
    pdf_bytes: bytes,
    filename: str | None,
    question_count: int,
    language: str,
) -> dict[str, Any]:
    deadline = time.monotonic() + settings.ollama_timeout_seconds

    def _remaining() -> float:
        return deadline - time.monotonic()

    try:
        document = await asyncio.to_thread(
            extract_pdf_text,
            pdf_bytes,
            max_pdf_bytes=settings.max_pdf_bytes,
            min_extracted_chars=settings.min_extracted_chars,
        )
    except PdfExtractionError as exc:
        raise HTTPException(status_code=HTTP_422, detail=str(exc)) from exc

    chunks = await asyncio.to_thread(
        chunk_document,
        document,
        chunk_size=settings.rag_chunk_size,
        chunk_overlap=settings.rag_chunk_overlap,
    )
    if not chunks:
        raise HTTPException(
            status_code=HTTP_422,
            detail="Materi PDF tidak menghasilkan potongan teks yang dapat diproses.",
        )

    embeddings = None
    if settings.ollama_embed_model.strip():
        embeddings = await ollama_client.embed_texts(
            [c.text for c in chunks],
            timeout_seconds=min(20.0, max(5.0, _remaining())),
        )

    rag_index = EphemeralRagIndex(chunks, embeddings=embeddings)
    collected: list[QuizQuestionSchema] = []
    seen_fingerprints: set[str] = set()
    used_chunk_indices: set[int] = set()
    title_candidate: Any = None
    description_candidate: Any = None

    batch_size = min(question_count, settings.max_questions_per_batch)
    planned_batches = max(1, math.ceil(question_count / max(1, batch_size)))
    max_attempts = planned_batches + 2  # allow bounded top-up batches if dedup drops duplicates

    attempt_idx = 0
    while len(collected) < question_count and attempt_idx < max_attempts:
        remaining_budget = _remaining()
        if remaining_budget <= 3.0:
            raise HTTPException(
                status_code=status.HTTP_504_GATEWAY_TIMEOUT,
                detail="Waktu tunggu inferensi Ollama habis sebelum semua soal selesai dibuat.",
            )

        needed = question_count - len(collected)
        batch_ask = min(needed, settings.max_questions_per_batch)
        selected_chunks = rag_index.select_chunks_for_batch(
            batch_index=attempt_idx,
            total_batches=planned_batches,
            max_chunks=settings.rag_max_chunks_per_batch,
            used_chunk_indices=used_chunk_indices,
        )
        avoid_stems = [q.question_text for q in collected]
        need_metadata = attempt_idx == 0
        batch_schema = schema_for_batch(need_metadata)
        messages = build_quiz_messages(
            chunks=selected_chunks,
            question_count=batch_ask,
            language=language,
            avoid_questions=avoid_stems or None,
            need_metadata=need_metadata,
        )

        try:
            raw_json, raw_text = await ollama_client.chat_json(
                messages=messages,
                json_schema=batch_schema,
                timeout_seconds=remaining_budget,
            )
        except OllamaUnavailableError as exc:
            status_code = (
                status.HTTP_504_GATEWAY_TIMEOUT if exc.is_timeout else status.HTTP_503_SERVICE_UNAVAILABLE
            )
            raise HTTPException(status_code=status_code, detail=str(exc)) from exc
        except OllamaBadOutputError as exc:
            if _remaining() <= 8.0:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="Output model Ollama tidak berupa JSON valid.",
                ) from exc
            attempt_idx += 1
            continue

        if title_candidate is None and isinstance(raw_json.get("title"), str):
            title_candidate = raw_json.get("title")
        if description_candidate is None and isinstance(raw_json.get("description"), str):
            description_candidate = raw_json.get("description")

        batch_valid = extract_valid_questions(raw_json, existing_fingerprints=seen_fingerprints)
        raw_count = len(raw_json.get("questions", [])) if isinstance(raw_json.get("questions"), list) else 0
        logger.info(
            "Batch %s: asked=%s raw=%s valid_new=%s collected=%s",
            attempt_idx,
            batch_ask,
            raw_count,
            len(batch_valid),
            len(collected) + min(len(batch_valid), needed),
        )

        # Single targeted repair pass if Ollama returned malformed items or fewer than requested in batch.
        if len(batch_valid) < batch_ask and _remaining() > 10.0 and len(chunks) > 0 and not batch_valid:
            try:
                repaired_json, _ = await ollama_client.chat_json(
                    messages=build_repair_messages(
                        previous_raw=raw_text,
                        expected_count=batch_ask,
                        language=language,
                        reason="Pastikan setiap soal memiliki question, opsi A-D terisi, dan answer A/B/C/D.",
                    ),
                    json_schema=batch_schema,
                    timeout_seconds=_remaining(),
                )
                batch_valid = extract_valid_questions(repaired_json, existing_fingerprints=seen_fingerprints)
                if title_candidate is None and isinstance(repaired_json.get("title"), str):
                    title_candidate = repaired_json.get("title")
                if description_candidate is None and isinstance(repaired_json.get("description"), str):
                    description_candidate = repaired_json.get("description")
            except OllamaUnavailableError as exc:
                status_code = (
                    status.HTTP_504_GATEWAY_TIMEOUT if exc.is_timeout else status.HTTP_503_SERVICE_UNAVAILABLE
                )
                raise HTTPException(status_code=status_code, detail=str(exc)) from exc
            except OllamaBadOutputError:
                pass

        for question in batch_valid:
            if len(collected) >= question_count:
                break
            seen_fingerprints.add(question_fingerprint(question.question_text))
            collected.append(question)

        attempt_idx += 1

    try:
        return build_final_quiz_payload(
            title_candidate=title_candidate,
            description_candidate=description_candidate,
            questions=collected,
            expected_count=question_count,
            fallback_title=_derive_fallback_title(filename),
            max_response_bytes=settings.max_response_bytes,
        )
    except SchemaValidationError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc)) from exc


app = create_app()
