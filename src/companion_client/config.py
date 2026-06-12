"""Client configuration.

The client owns the persona and the memory data and points at an external Voice
Agent Service. It runs no model itself. Settings come from environment variables
(prefix ``COMPANION_``) with optional overrides from a ``.env`` file.
"""

from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

PROJECT_ROOT: Path = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ---- the external Voice Agent Service ----
    service_url: str = Field("http://127.0.0.1:8080", alias="COMPANION_SERVICE_URL")

    # ---- what this project owns ----
    persona_path: Path = Field(
        default_factory=lambda: PROJECT_ROOT / "persona" / "system_prompt.txt",
        alias="COMPANION_PERSONA_PATH",
    )
    vault_dir: Path = Field(
        default_factory=lambda: PROJECT_ROOT / "memory" / "vault",
        alias="COMPANION_VAULT_DIR",
    )
    knowledge_dir: Path = Field(
        default_factory=lambda: PROJECT_ROOT / "memory" / "knowledge",
        alias="COMPANION_KNOWLEDGE_DIR",
    )

    # ---- domain memory hints passed to the generic service ----
    # Note types always surfaced for context every turn (this companion's vocabulary).
    profile_types: str = Field("therapy,preference", alias="COMPANION_PROFILE_TYPES")

    # ---- misc ----
    request_timeout: float = Field(30.0, alias="COMPANION_REQUEST_TIMEOUT")
    log_level: str = Field("INFO", alias="COMPANION_LOG_LEVEL")


settings = Settings()
