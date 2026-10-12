from sqlalchemy import text

from app.db.session import engine

API = "/api/v1"


def test_register_returns_user_without_password(client):
    r = client.post(
        f"{API}/auth/register",
        json={"email": "A@Example.com", "username": "alice", "password": "longenough1"},
    )
    assert r.status_code == 201
    body = r.json()
    assert body["email"] == "a@example.com"
    assert "password" not in body and "password_hash" not in body


def test_duplicate_email_and_case_insensitive_username_rejected(client):
    data = {"email": "a@example.com", "username": "alice", "password": "longenough1"}
    assert client.post(f"{API}/auth/register", json=data).status_code == 201
    assert client.post(f"{API}/auth/register", json=data).status_code == 409
    other = {"email": "b@example.com", "username": "ALICE", "password": "longenough1"}
    assert client.post(f"{API}/auth/register", json=other).status_code == 409


def test_invalid_input_rejected(client):
    r = client.post(
        f"{API}/auth/register",
        json={"email": "nope", "username": "a b", "password": "short"},
    )
    assert r.status_code == 422


def test_login_failures_look_identical(client, make_user):
    make_user("alice")
    wrong_pw = client.post(
        f"{API}/auth/login", json={"email": "alice@example.com", "password": "wrongwrong"}
    )
    unknown = client.post(
        f"{API}/auth/login", json={"email": "nobody@example.com", "password": "wrongwrong"}
    )
    assert wrong_pw.status_code == unknown.status_code == 401
    assert wrong_pw.json() == unknown.json()


def test_me_requires_valid_token(client, make_user):
    assert client.get(f"{API}/auth/me").status_code == 401
    bad = client.get(f"{API}/auth/me", headers={"Authorization": "Bearer garbage"})
    assert bad.status_code == 401
    alice = make_user("alice")
    r = client.get(f"{API}/auth/me", headers=alice["headers"])
    assert r.status_code == 200
    assert r.json()["username"] == "alice"


def test_token_for_deleted_user_stops_working(client, make_user):
    alice = make_user("alice")
    with engine.begin() as conn:
        conn.execute(text("DELETE FROM users"))
    assert client.get(f"{API}/auth/me", headers=alice["headers"]).status_code == 401