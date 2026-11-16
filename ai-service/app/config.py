"""Application configuration loaded from environment variables."""

from functools import lru_cache
from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    """Runtime settings for the separated FastAPI + Ollama quiz generation service."""

    model_config = SettingsConfigDict(
        env_file=str(_ENV_FILE),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    ai_service_host: str = Field(default="127.0.0.1")
    ai_service_port: int = Field(default=8001, ge=1, le=65535)
    ai_service_api_key: str = Field(default="")

    ollama_base_url: str = Field(default="http://127.0.0.1:11434")
    ollama_model: str = Field(default="qwen3:4b")
    ollama_embed_model: str = Field(default="")
    ollama_keep_alive: str = Field(default="15m")
    ollama_timeout_seconds: float = Field(default=105.0, ge=5.0, le=300.0)
    ollama_temperature: float = Field(default=0.25, ge=0.0, le=1.5)
    ollama_num_ctx: int = Field(default=8192, ge=1024, le=131072)

    rag_chunk_size: int = Field(default=2200, ge=400, le=8000)
    rag_chunk_overlap: int = Field(default=200, ge=0, le=2000)
    rag_max_chunks_per_batch: int = Field(default=6, ge=1, le=20)

    max_pdf_bytes: int = Field(default=20 * 1024 * 1024, ge=1024)
    max_response_bytes: int = Field(default=1048576, ge=4096)
    min_extracted_chars: int = Field(default=100, ge=20)
    max_questions_per_batch: int = Field(default=10, ge=1, le=50)
    idempotency_ttl_seconds: int = Field(default=900, ge=30)


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached settings instance."""
    return Settings()
