"""Compact Ollama JSON Schema and Indonesian SMK prompt builders."""

from __future__ import annotations

from typing import Any

from app.rag_pipeline import DocumentChunk

_COMPACT_QUESTION_ITEM_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["question", "A", "B", "C", "D", "answer"],
    "properties": {
        "question": {"type": "string"},
        "A": {"type": "string"},
        "B": {"type": "string"},
        "C": {"type": "string"},
        "D": {"type": "string"},
        "answer": {"type": "string", "enum": ["A", "B", "C", "D"]},
    },
}

QUIZ_BATCH_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["title", "description", "questions"],
    "properties": {
        "title": {"type": "string"},
        "description": {"type": "string"},
        "questions": {
            "type": "array",
            "items": _COMPACT_QUESTION_ITEM_SCHEMA,
        },
    },
}

QUIZ_QUESTIONS_ONLY_JSON_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["questions"],
    "properties": {
        "questions": {
            "type": "array",
            "items": _COMPACT_QUESTION_ITEM_SCHEMA,
        },
    },
}


def schema_for_batch(need_metadata: bool) -> dict[str, Any]:
    """Return full schema on initial batch and questions-only schema on continuation batches."""
    return QUIZ_BATCH_JSON_SCHEMA if need_metadata else QUIZ_QUESTIONS_ONLY_JSON_SCHEMA


def build_quiz_messages(
    *,
    chunks: list[DocumentChunk],
    question_count: int,
    language: str,
    avoid_questions: list[str] | None = None,
    need_metadata: bool = True,
) -> list[dict[str, str]]:
    """Construct compact system and user messages grounding Ollama strictly in extracted PDF chunks."""
    lang = (language or "id").strip().lower()
    is_english = lang.startswith("en")

    if is_english:
        system_prompt = (
            "You are a vocational high school (SMK) assessment writer. "
            "Write multiple-choice questions strictly grounded in the provided PDF excerpts and output ONLY compact single-line JSON matching the schema. "
            "Rules: "
            "1) Generate the exact number of unique questions requested. "
            "2) Each question has fields: question, A, B, C, D, and answer ('A'|'B'|'C'|'D'). "
            "3) Distribute correct answers across A, B, C, and D evenly; avoid meta-options like 'All of the above' or 'A and B are correct'. "
            "4) Keep questions and options concise (4-15 words per option) with plausible distractors from the text."
        )
    else:
        system_prompt = (
            "Anda adalah penyusun soal SMK profesional. "
            "Buat soal pilihan ganda HANYA berdasarkan kutipan materi PDF dan keluarkan HANYA JSON kompak satu baris tanpa indentasi berlebih sesuai skema. "
            "Aturan wajib: "
            "1) Gunakan Bahasa Indonesia baku yang jelas dan tepat secara teknis. "
            "2) Array 'questions' HARUS berisi tepat jumlah soal yang diminta dan tidak boleh ada soal duplikat. "
            "3) Tiap item berisi: 'question' (pertanyaan), 'A', 'B', 'C', 'D' (4 opsi singkat padat 4-15 kata), dan 'answer' ('A'|'B'|'C'|'D'). "
            "4) Sebar nilai 'answer' bervariasi antar A, B, C, dan D, serta hindari opsi seperti 'Semua benar' atau 'A dan B benar'. "
            "5) Gunakan hanya fakta dari materi PDF; jangan mengarang materi di luar kutipan."
        )

    context_blocks = "\n\n---\n\n".join(chunk.text for chunk in chunks)
    avoid_section = ""
    if avoid_questions:
        listed = "\n".join(f"- {stem[:140]}" for stem in avoid_questions[-25:])
        if is_english:
            avoid_section = (
                "\n\nExplore different angles (definitions, comparisons, standards/numbers, troubleshooting scenarios) "
                f"and do NOT repeat or paraphrase these existing questions:\n{listed}\n"
            )
        else:
            avoid_section = (
                "\n\nGali aspek baru dari materi (fungsi, perbandingan konsep, parameter/angka teknis, atau studi kasus troubleshooting) "
                f"dan JANGAN mengulang atau memparafrasekan soal berikut:\n{listed}\n"
            )

    if is_english:
        intro = (
            f"Create EXACTLY {question_count} distinct multiple-choice questions plus quiz title and short description."
            if need_metadata
            else f"Create EXACTLY {question_count} distinct additional multiple-choice questions."
        )
        user_prompt = (
            f"{intro}{avoid_section}\n"
            f"=== MATERIAL EXCERPTS ===\n{context_blocks}\n=== END MATERIAL ==="
        )
    else:
        intro = (
            f"Buatlah TEPAT {question_count} soal pilihan ganda yang berbeda satu sama lain (butir 1..{question_count}), "
            f"beserta 'title' dan 'description' singkat dari materi berikut."
            if need_metadata
            else f"Buatlah TEPAT {question_count} soal pilihan ganda tambahan yang berbeda dari daftar sebelumnya (butir 1..{question_count})."
        )
        user_prompt = (
            f"{intro}{avoid_section}\n"
            f"=== KUTIPAN MATERI PDF ===\n{context_blocks}\n=== AKHIR MATERI ==="
        )

    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]


def build_repair_messages(
    *,
    previous_raw: str,
    expected_count: int,
    language: str,
    reason: str,
) -> list[dict[str, str]]:
    """Request a schema repair from Ollama if the prior JSON failed validation."""
    lang = (language or "id").strip().lower()
    if lang.startswith("en"):
        prompt = (
            f"Fix the following quiz JSON so it contains EXACTLY {expected_count} valid questions "
            f"(each with non-empty question, A, B, C, D, and answer in A..D). "
            f"Issue: {reason}.\n\nJSON:\n{previous_raw[:10000]}"
        )
    else:
        prompt = (
            f"Perbaiki JSON kuis berikut agar berisi TEPAT {expected_count} soal valid "
            f"(setiap soal memiliki question, A, B, C, D yang terisi dan answer bernilai A/B/C/D). "
            f"Masalah: {reason}.\n\nJSON:\n{previous_raw[:10000]}"
        )

    return [
        {
            "role": "system",
            "content": "Return ONLY repaired compact valid JSON matching the provided schema.",
        },
        {"role": "user", "content": prompt},
    ]
