from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "StudyQuest"
    app_env: str = "development"
    secret_key: str
    database_url: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    cors_origins: str = "http://localhost:5173"
    rate_limit_enabled: bool = True
    trust_proxy_headers: bool = False
    # How many proxies sit between the internet and this app. The visitor's
    # address is then the Nth entry from the RIGHT of X-Forwarded-For.
    trusted_proxy_hops: int = 1
    session_heartbeat_grace_seconds: int = 90
    app_timezone: str = "Asia/Kolkata"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @model_validator(mode="after")
    def check_production_settings(self) -> "Settings":
        """In production, refuse to start with an unsafe configuration."""
        if self.app_env.strip().lower() != "production":
            return self

        problems: list[str] = []

        key = self.secret_key
        if (
            len(key) < 32
            or len(set(key)) < 12
            or key.lower().startswith(("change", "secret", "password"))
        ):
            problems.append(
                "SECRET_KEY is weak (use 32+ random characters, e.g. "
                "python -c \"import secrets; print(secrets.token_urlsafe(48))\")"
            )

        origins = self.cors_origin_list
        if not origins:
            problems.append("CORS_ORIGINS must list the frontend URL")
        for origin in origins:
            if not origin.startswith("https://"):
                problems.append(f"CORS origin must be https:// in production: {origin}")

        if not self.rate_limit_enabled:
            problems.append("RATE_LIMIT_ENABLED must be true in production")

        if not self.database_url.startswith("postgresql+psycopg://"):
            problems.append("DATABASE_URL must start with postgresql+psycopg://")

        if self.trusted_proxy_hops < 1:
            problems.append("TRUSTED_PROXY_HOPS must be at least 1")

        if problems:
            raise ValueError(
                "Unsafe production configuration: " + "; ".join(problems)
            )
        return self


settings = Settings()