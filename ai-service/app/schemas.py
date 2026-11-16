"""Canonical schemas and strict normalization matching Laravel GeneratedQuizValidator."""

from __future__ import annotations

import json
import re
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

LABELS: tuple[Literal["A", "B", "C", "D"], ...] = ("A", "B", "C", "D")


class SchemaValidationError(ValueError):
    """Raised when LLM output fails canonical quiz constraints."""


class QuizOptionSchema(BaseModel):
    """Single multiple-choice option matching Laravel option schema."""

    model_config = ConfigDict(extra="ignore")

    option_label: Literal["A", "B", "C", "D"]
    option_text: str = Field(min_length=1, max_length=5000)
    is_correct: bool


class QuizQuestionSchema(BaseModel):
    """Single multiple-choice question with strictly 4 options and 1 correct key."""

    model_config = ConfigDict(extra="ignore")

    question_type: Literal["multiple_choice"] = "multiple_choice"
    question_text: str = Field(min_length=1, max_length=10000)
    options: list[QuizOptionSchema]

    @model_validator(mode="after")
    def validate_options_invariant(self) -> "QuizQuestionSchema":
        if len(self.options) != 4:
            raise ValueError("Each question must contain exactly 4 options.")
        labels = [opt.option_label for opt in self.options]
        if set(labels) != set(LABELS) or len(set(labels)) != 4:
            raise ValueError("Options must contain unique labels A, B, C, and D.")
        correct_count = sum(1 for opt in self.options if opt.is_correct)
        if correct_count != 1:
            raise ValueError("Each question must have strictly one correct option.")
        order = {label: idx for idx, label in enumerate(LABELS)}
        self.options = sorted(self.options, key=lambda o: order[o.option_label])
        return self


class GeneratedQuizSchema(BaseModel):
    """Top-level response payload returned to Laravel HttpQuizGenerator."""

    model_config = ConfigDict(extra="ignore")

    title: str = Field(min_length=1, max_length=255)
    description: str | None = Field(default=None, max_length=10000)
    questions: list[QuizQuestionSchema]


def _clean_text(value: Any, max_len: int) -> str:
    if not isinstance(value, str):
        return ""
    cleaned = re.sub(r"\s+", " ", value).strip()
    if len(cleaned) > max_len:
        cleaned = cleaned[: max_len - 3].rstrip() + "..."
    return cleaned


def question_fingerprint(text: str) -> str:
    """Normalize question text for duplicate suppression across generation batches."""
    return re.sub(r"[^0-9a-z]+", "", text.lower())


def sanitize_single_question(raw_question: Any) -> QuizQuestionSchema | None:
    """Attempt deterministic normalization of compact or canonical LLM question formats."""
    if not isinstance(raw_question, dict):
        return None

    # Compact Ollama format: {"question": "...", "A": "...", "B": "...", "C": "...", "D": "...", "answer": "B"}
    if "question" in raw_question and "answer" in raw_question and "options" not in raw_question:
        q_text = _clean_text(raw_question.get("question"), 10000)
        answer = str(raw_question.get("answer") or "").strip().upper()
        if not q_text or answer not in LABELS:
            return None
        compact_options: list[QuizOptionSchema] = []
        for label in LABELS:
            opt_text = _clean_text(raw_question.get(label), 5000)
            if not opt_text:
                return None
            compact_options.append(
                QuizOptionSchema(
                    option_label=label,
                    option_text=opt_text,
                    is_correct=(label == answer),
                )
            )
        return QuizQuestionSchema(
            question_type="multiple_choice",
            question_text=q_text,
            options=compact_options,
        )

    q_type = raw_question.get("question_type", "multiple_choice")
    if q_type is not None and q_type != "multiple_choice":
        return None

    q_text = _clean_text(raw_question.get("question_text"), 10000)
    if not q_text:
        return None

    raw_options = raw_question.get("options")
    if not isinstance(raw_options, list) or len(raw_options) != 4:
        return None

    normalized_options: list[dict[str, Any]] = []
    seen_labels: set[str] = set()
    missing_label = any(
        not isinstance(opt, dict)
        or str(opt.get("option_label") or opt.get("label") or "").strip().upper() not in LABELS
        for opt in raw_options
    )

    for idx, raw_opt in enumerate(raw_options):
        if not isinstance(raw_opt, dict):
            return None
        label_raw = str(raw_opt.get("option_label") or raw_opt.get("label") or "").strip().upper()
        label = LABELS[idx] if missing_label else label_raw
        if label not in LABELS or label in seen_labels:
            return None
        seen_labels.add(label)

        opt_text = _clean_text(raw_opt.get("option_text") or raw_opt.get("text"), 5000)
        if not opt_text:
            return None

        is_correct = raw_opt.get("is_correct")
        if not isinstance(is_correct, bool):
            return None

        normalized_options.append(
            {
                "option_label": label,
                "option_text": opt_text,
                "is_correct": is_correct,
            }
        )

    try:
        return QuizQuestionSchema(
            question_type="multiple_choice",
            question_text=q_text,
            options=[QuizOptionSchema(**o) for o in normalized_options],
        )
    except Exception:
        return None


def extract_valid_questions(
    raw_payload: dict[str, Any],
    existing_fingerprints: set[str] | None = None,
) -> list[QuizQuestionSchema]:
    """Filter valid, non-duplicate questions from an LLM batch payload."""
    seen = set(existing_fingerprints or ())
    valid: list[QuizQuestionSchema] = []
    raw_questions = raw_payload.get("questions")
    if not isinstance(raw_questions, list):
        return valid

    for raw_q in raw_questions:
        parsed = sanitize_single_question(raw_q)
        if parsed is None:
            continue
        fp = question_fingerprint(parsed.question_text)
        if not fp or fp in seen:
            continue
        seen.add(fp)
        valid.append(parsed)

    return valid


_META_OPTION_RE = re.compile(
    r"\b(semua jawaban|semua opsi|di atas|semuanya benar|a dan b|b dan c|c dan d|a,\s*b|bukan salah satu|all of the above|none of the above)\b",
    re.IGNORECASE,
)


def _rebalance_option_keys(questions: list[QuizQuestionSchema]) -> list[QuizQuestionSchema]:
    """Deterministically distribute correct answers across A/B/C/D when options are standalone."""
    if len(questions) < 2:
        return questions

    rebalanced: list[QuizQuestionSchema] = []
    for idx, q in enumerate(questions):
        if any(_META_OPTION_RE.search(opt.option_text) for opt in q.options):
            rebalanced.append(q)
            continue

        correct_idx = next((i for i, opt in enumerate(q.options) if opt.is_correct), 0)
        target_idx = idx % 4
        texts = [opt.option_text for opt in q.options]
        if target_idx != correct_idx:
            texts[target_idx], texts[correct_idx] = texts[correct_idx], texts[target_idx]

        new_options = [
            QuizOptionSchema(
                option_label=LABELS[i],
                option_text=texts[i],
                is_correct=(i == target_idx),
            )
            for i in range(4)
        ]
        rebalanced.append(
            QuizQuestionSchema(
                question_type=q.question_type,
                question_text=q.question_text,
                options=new_options,
            )
        )
    return rebalanced


def build_final_quiz_payload(
    title_candidate: Any,
    description_candidate: Any,
    questions: list[QuizQuestionSchema],
    expected_count: int,
    fallback_title: str,
    max_response_bytes: int,
) -> dict[str, Any]:
    """Assemble final canonical payload and enforce exact count and byte-size ceiling."""
    if len(questions) < expected_count:
        raise SchemaValidationError(
            f"Generated only {len(questions)} valid questions; expected {expected_count}."
        )

    title = _clean_text(title_candidate, 255) or _clean_text(fallback_title, 255) or "Kuis Evaluasi Materi"
    description_clean = _clean_text(description_candidate, 10000)
    description = description_clean if description_clean else None
    balanced_questions = _rebalance_option_keys(questions[:expected_count])

    draft = GeneratedQuizSchema(
        title=title,
        description=description,
        questions=balanced_questions,
    )
    payload = draft.model_dump()
    encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")

    if len(encoded) > max_response_bytes and payload["description"]:
        payload["description"] = None
        encoded = json.dumps(payload, ensure_ascii=False).encode("utf-8")

    if len(encoded) > max_response_bytes:
        raise SchemaValidationError(
            f"Serialized quiz payload ({len(encoded)} bytes) exceeds max {max_response_bytes} bytes."
        )

    return payload
