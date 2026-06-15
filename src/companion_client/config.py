"""Client configuration.

The client owns the persona and the memory data and points at an external Voice
Agent Service. It runs no model itself. Settings come from environment variables
(prefix ``COMPANION_``) with optional overrides from a ``.env`` file.
"""

from __future__ import annotations

from pathlib import Path

from pydantic import AliasChoices, Field
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
    # v2 default: the deployed, persona-agnostic service behind Cloudflare Access.
    # For a local engine, set VA_BASE_URL (or COMPANION_SERVICE_URL) to http://127.0.0.1:8080.
    service_url: str = Field(
        "https://voice-agent-service.mattiapiatti.eu",
        validation_alias=AliasChoices("VA_BASE_URL", "COMPANION_SERVICE_URL"),
    )

    # ---- Cloudflare Access service token (machine-to-machine) ----
    # Required by the deployed server: sent on every REST, SSE, and WebSocket call.
    # Leave empty when talking to a local service that has no edge auth.
    cf_access_client_id: str = Field(
        "",
        validation_alias=AliasChoices(
            "VA_CF_ACCESS_CLIENT_ID", "COMPANION_CF_ACCESS_CLIENT_ID"
        ),
    )
    cf_access_client_secret: str = Field(
        "",
        validation_alias=AliasChoices(
            "VA_CF_ACCESS_CLIENT_SECRET", "COMPANION_CF_ACCESS_CLIENT_SECRET"
        ),
    )

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

    def auth_headers(self) -> dict[str, str]:
        """Cloudflare Access service-token headers, sent on every request.

        Empty when no token is configured (local service with no edge auth), so the
        same client works against both the deployed server and a local engine.
        """
        if self.cf_access_client_id and self.cf_access_client_secret:
            return {
                "CF-Access-Client-Id": self.cf_access_client_id,
                "CF-Access-Client-Secret": self.cf_access_client_secret,
            }
        return {}


settings = Settings()
