import pytest
from pydantic import ValidationError

from app.core.config import Settings

GOOD_KEY = "k3Jf9xQ2mZ8vB1nL7pR4tY6uW0cA5dEhGsX-iOqMzTb"


def make(**overrides) -> Settings:
    values = dict(  # noqa: C408
        _env_file=None,
        database_url="postgresql+psycopg://u:p@host/db",
        secret_key=GOOD_KEY,
        cors_origins="https://app.example.com",
        app_env="production",
        rate_limit_enabled=True,
    )
    values.update(overrides)
    return Settings(**values)


def test_valid_production_settings_are_accepted():
    s = make()
    assert s.app_env == "production"


def test_short_secret_rejected_in_production():
    with pytest.raises(ValidationError):
        make(secret_key="short")


def test_placeholder_secret_rejected_in_production():
    with pytest.raises(ValidationError):
        make(secret_key="change-me-" + "x" * 40)


def test_http_origin_rejected_in_production():
    with pytest.raises(ValidationError):
        make(cors_origins="http://app.example.com")


def test_rate_limit_cannot_be_disabled_in_production():
    with pytest.raises(ValidationError):
        make(rate_limit_enabled=False)


def test_wrong_database_driver_rejected_in_production():
    with pytest.raises(ValidationError):
        make(database_url="postgresql://u:p@host/db")


def test_development_allows_weak_settings():
    s = make(
        app_env="development", secret_key="short", cors_origins="http://localhost:5173"
    )
    assert s.secret_key == "short"
