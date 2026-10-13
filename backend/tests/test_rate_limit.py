import pytest

from app.core.rate_limit import limiter

API = "/api/v1"


@pytest.fixture
def limits_on(monkeypatch):
    monkeypatch.setattr(limiter, "enabled", True)
    limiter.reset()
    yield
    limiter.reset()


def test_login_is_rate_limited_with_consistent_error(client, limits_on):
    body = {"email": "x@example.com", "password": "wrongwrong"}
    codes = [client.post(f"{API}/auth/login", json=body).status_code for _ in range(12)]
    assert codes[:10] == [401] * 10
    assert codes[10] == 429
    r = client.post(f"{API}/auth/login", json=body)
    assert r.status_code == 429
    assert "detail" in r.json()
    assert r.headers["retry-after"]