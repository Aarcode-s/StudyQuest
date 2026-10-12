import os
import subprocess
import sys
from pathlib import Path

import pytest
from dotenv import dotenv_values

BACKEND_DIR = Path(__file__).resolve().parent.parent

# --- Choose the test database BEFORE the app is imported -------------------
_env = {**dotenv_values(BACKEND_DIR / ".env"), **os.environ}
_test_url = _env.get("TEST_DATABASE_URL")
if not _test_url:
    raise RuntimeError("TEST_DATABASE_URL is not set (see backend/.env).")

_db_name = _test_url.split("?")[0].rsplit("/", 1)[-1]
if "test" not in _db_name.lower():
    raise RuntimeError(
        f"Refusing to run: database name '{_db_name}' does not contain 'test'."
    )

os.environ["DATABASE_URL"] = _test_url
os.environ["RATE_LIMIT_ENABLED"] = "false"

# --- Only now import the app ------------------------------------------------
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.db.session import engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _migrated_database():
    """Build the schema once per run using the real Alembic migrations."""
    subprocess.run(
        [sys.executable, "-m", "alembic", "upgrade", "head"],
        cwd=BACKEND_DIR,
        check=True,
        env=os.environ.copy(),
    )
    yield


@pytest.fixture(autouse=True)
def _clean_tables():
    """Blank slate before every test."""
    with engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE focus_sessions, room_members, rooms, users "
                "RESTART IDENTITY CASCADE"
            )
        )
    yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _register_and_login(client: TestClient, name: str) -> dict:
    password = "longenough1"
    r = client.post(
        "/api/v1/auth/register",
        json={"email": f"{name}@example.com", "username": name, "password": password},
    )
    assert r.status_code == 201, r.text
    user_id = r.json()["id"]
    r = client.post(
        "/api/v1/auth/login",
        json={"email": f"{name}@example.com", "password": password},
    )
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    return {
        "id": user_id,
        "name": name,
        "headers": {"Authorization": f"Bearer {token}"},
    }


@pytest.fixture
def make_user(client):
    """Call make_user('alice') to get a registered, logged-in user."""
    return lambda name: _register_and_login(client, name)

from datetime import datetime, timedelta, timezone  # noqa: E402


class Clock:
    def __init__(self, monkeypatch):
        self.now = datetime.now(timezone.utc)
        for module in ("app.services.sessions", "app.services.status"):
            monkeypatch.setattr(f"{module}._now", lambda: self.now, raising=False)

    def advance(self, seconds: int):
        self.now += timedelta(seconds=seconds)


@pytest.fixture
def clock(monkeypatch):
    return Clock(monkeypatch)