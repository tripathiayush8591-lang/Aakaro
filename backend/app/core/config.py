from urllib.parse import urlsplit

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    gemini_api_key: SecretStr = SecretStr("")
    gemini_model: str = ""
    firebase_project_id: str = ""
    google_application_credentials: str | None = None
    cors_origins: list[str] = ["http://localhost:5173"]
    provider_timeout_seconds: float = Field(default=25, ge=1, le=45)
    user_request_limit: int = Field(default=5, ge=1, le=100)
    user_window_seconds: int = Field(default=60, ge=1, le=3600)
    connection_test_enabled: bool = True

    @field_validator("cors_origins")
    @classmethod
    def explicit_origins(cls, origins: list[str]) -> list[str]:
        for origin in origins:
            parsed = urlsplit(origin)
            if (
                parsed.scheme not in {"http", "https"}
                or not parsed.netloc
                or parsed.path
                or parsed.query
                or parsed.fragment
                or "*" in origin
                or parsed.username
            ):
                raise ValueError(
                    "CORS_ORIGINS must contain exact http(s) origins without paths or wildcards"
                )
        return origins


def configured(value: str) -> bool:
    return bool(value.strip()) and not value.startswith("replace-with-")
