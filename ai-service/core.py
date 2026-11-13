"""Pure processing and validation, shared by the API and tests."""
import re
from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator


class Question(BaseModel):
    model_config = ConfigDict(extra="forbid")
    question: str = Field(min_length=1, max_length=5000)
    options: list[str] = Field(min_length=4, max_length=4)
    correct_index: StrictInt = Field(ge=0, le=3)
    explanation: str = Field(min_length=1, max_length=5000)

    @field_validator("options")
    @classmethod
    def valid_options(cls, values):
        if any(not value.strip() or len(value) > 2000 for value in values):
            raise ValueError("Invalid option")
        if len({value.strip().casefold() for value in values}) != 4:
            raise ValueError("Options must be distinct")
        return values


class Draft(BaseModel):
    model_config = ConfigDict(extra="forbid")
    title: str = Field(min_length=1, max_length=255)
    questions: list[Question] = Field(min_length=1, max_length=50)


def chunks(text: str, size: int = 1200, overlap: int = 200) -> list[str]:
    text = re.sub(r"\s+", " ", text.replace("\x00", " ")).strip()
    if len(text) < 80:
        raise ValueError("PDF tidak mengandung teks yang cukup. Gunakan PDF berbasis teks.")
    return [text[i:i + size] for i in range(0, len(text), size - overlap) if text[i:i + size].strip()]


def validate_output(raw: str, count: int) -> Draft:
    draft = Draft.model_validate_json(raw)
    if len(draft.questions) != count:
        raise ValueError("Jumlah soal tidak sesuai permintaan.")
    if len({q.question.strip().casefold() for q in draft.questions}) != count:
        raise ValueError("Soal duplikat.")
    return draft
