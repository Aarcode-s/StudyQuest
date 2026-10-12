from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "StudyQuest"
    app_env: str = "development"
    secret_key: str  # no default: the app won't start without it
    database_url: str  # no default: the app won't start without it

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()