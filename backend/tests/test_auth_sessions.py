from sqlalchemy import text

from app.core.security import create_access_token
from app.db.session import engine

API = "/api/v1"
PASSWORD = "longenough1"


def login(client, name):
    r = client.post(
        f"{API}/auth/login", json={"email": f"{name}@example.com", "password": PASSWORD}
    )
    assert r.status_code == 200, r.text
    return r.json()


def bearer(access_token):
    return {"Authorization": f"Bearer {access_token}"}


def me(client, headers):
    return client.get(f"{API}/auth/me", headers=headers)


def refresh(client, token):
    return client.post(f"{API}/auth/refresh", json={"refresh_token": token})


def session_rows():
    with engine.begin() as conn:
        return conn.execute(text("SELECT count(*) FROM auth_sessions")).scalar()


def test_login_returns_access_and_refresh_tokens(client, make_user):
    make_user("alice")
    tokens = login(client, "alice")
    assert tokens["token_type"] == "bearer"
    assert len(tokens["refresh_token"]) >= 20
    assert tokens["refresh_token"] != tokens["access_token"]
    assert me(client, bearer(tokens["access_token"])).status_code == 200


def test_new_login_signs_out_the_previous_device(client, make_user):
    alice = make_user("alice")
    phone = alice["headers"]  # the login made by the fixture

    laptop = login(client, "alice")

    old = me(client, phone)
    assert old.status_code == 401
    assert old.json()["detail"] == "Signed in on another device"
    assert me(client, bearer(laptop["access_token"])).status_code == 200
    assert session_rows() == 1  # still one signed-in device per user


def test_other_users_are_not_affected(client, make_user):
    alice, bob = make_user("alice"), make_user("bob")
    login(client, "alice")
    assert me(client, bob["headers"]).status_code == 200
    assert session_rows() == 2


def test_refresh_gives_a_new_access_token_and_signs_nobody_out(client, make_user):
    make_user("alice")
    tokens = login(client, "alice")
    old_access = bearer(tokens["access_token"])

    r = refresh(client, tokens["refresh_token"])
    assert r.status_code == 200, r.text
    new_access = bearer(r.json()["access_token"])
    assert "refresh_token" not in r.json()

    assert me(client, new_access).status_code == 200
    assert me(client, old_access).status_code == 200


def test_refresh_rejects_bad_replaced_and_expired_tokens(client, make_user):
    make_user("alice")

    assert refresh(client, "x" * 64).status_code == 401  # unknown
    assert refresh(client, "short").status_code == 422  # malformed

    first = login(client, "alice")
    second = login(client, "alice")
    rejected = refresh(client, first["refresh_token"])  # replaced by the second login
    assert rejected.status_code == 401
    assert rejected.json()["detail"] == "Session ended. Please log in again."
    assert refresh(client, second["refresh_token"]).status_code == 200

    with engine.begin() as conn:
        conn.execute(
            text("UPDATE auth_sessions SET expires_at = now() - interval '1 minute'")
        )
    assert refresh(client, second["refresh_token"]).status_code == 401
    assert me(client, bearer(second["access_token"])).status_code == 401


def test_logout_ends_the_session(client, make_user):
    make_user("alice")
    tokens = login(client, "alice")
    headers = bearer(tokens["access_token"])

    assert client.post(f"{API}/auth/logout", headers=headers).status_code == 204
    assert me(client, headers).status_code == 401
    assert refresh(client, tokens["refresh_token"]).status_code == 401
    assert session_rows() == 0
    assert client.post(f"{API}/auth/logout").status_code == 401


def test_tokens_without_a_matching_session_are_rejected(client, make_user):
    alice = make_user("alice")
    old_style = create_access_token(alice["id"])  # no session claim
    assert me(client, bearer(old_style)).status_code == 401
    forged = create_access_token(alice["id"], "not-the-real-key")
    assert me(client, bearer(forged)).status_code == 401
