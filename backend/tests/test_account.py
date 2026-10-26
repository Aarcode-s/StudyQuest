from sqlalchemy import text

from app.db.session import engine

API = "/api/v1"
PASSWORD = "longenough1"


def count(sql: str, **params) -> int:
    with engine.begin() as conn:
        return conn.execute(text(sql), params).scalar()


def delete(client, headers, password=PASSWORD):
    return client.post(
        f"{API}/auth/delete-account", json={"password": password}, headers=headers
    )


def create_room(client, headers, name="Study"):
    r = client.post(f"{API}/rooms", json={"name": name}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def join(client, headers, code):
    r = client.post(f"{API}/rooms/join", json={"invite_code": code}, headers=headers)
    assert r.status_code in (200, 201), r.text


def test_requires_login(client):
    r = client.post(f"{API}/auth/delete-account", json={"password": PASSWORD})
    assert r.status_code == 401


def test_wrong_password_keeps_the_account(client, make_user):
    alice = make_user("alice")
    r = delete(client, alice["headers"], password="not-the-password")
    assert r.status_code == 403
    assert count("SELECT count(*) FROM users") == 1
    # still signed in: a wrong password must not log the user out
    assert client.get(f"{API}/auth/me", headers=alice["headers"]).status_code == 200


def test_delete_removes_user_and_login(client, make_user):
    alice = make_user("alice")
    assert delete(client, alice["headers"]).status_code == 204
    assert count("SELECT count(*) FROM users") == 0
    assert count("SELECT count(*) FROM auth_sessions") == 0
    assert client.get(f"{API}/auth/me", headers=alice["headers"]).status_code == 401
    login = client.post(
        f"{API}/auth/login",
        json={"email": "alice@example.com", "password": PASSWORD},
    )
    assert login.status_code == 401


def test_owner_alone_deletes_the_empty_room(client, make_user):
    alice = make_user("alice")
    create_room(client, alice["headers"])
    assert delete(client, alice["headers"]).status_code == 204
    assert count("SELECT count(*) FROM rooms") == 0
    assert count("SELECT count(*) FROM room_members") == 0


def test_owner_with_members_hands_the_room_over(client, make_user):
    alice = make_user("alice")
    bob = make_user("bob")
    carol = make_user("carol")
    room = create_room(client, alice["headers"])
    join(client, bob["headers"], room["invite_code"])  # joined first
    join(client, carol["headers"], room["invite_code"])

    assert delete(client, alice["headers"]).status_code == 204

    rooms = client.get(f"{API}/rooms", headers=bob["headers"]).json()
    assert len(rooms) == 1
    assert rooms[0]["role"] == "owner"
    assert rooms[0]["member_count"] == 2
    carol_rooms = client.get(f"{API}/rooms", headers=carol["headers"]).json()
    assert carol_rooms[0]["role"] == "member"
    assert count("SELECT count(*) FROM rooms") == 1


def test_member_leaving_via_delete_keeps_the_room(client, make_user):
    alice = make_user("alice")
    bob = make_user("bob")
    room = create_room(client, alice["headers"])
    join(client, bob["headers"], room["invite_code"])

    assert delete(client, bob["headers"]).status_code == 204

    rooms = client.get(f"{API}/rooms", headers=alice["headers"]).json()
    assert rooms[0]["role"] == "owner"
    assert rooms[0]["member_count"] == 1


def test_focus_history_is_deleted_too(client, make_user):
    alice = make_user("alice")
    bob = make_user("bob")
    room = create_room(client, alice["headers"])
    join(client, bob["headers"], room["invite_code"])
    started = client.post(f"{API}/rooms/{room['id']}/sessions", headers=bob["headers"])
    assert started.status_code in (200, 201), started.text
    assert count("SELECT count(*) FROM focus_sessions") == 1

    assert delete(client, bob["headers"]).status_code == 204
    assert count("SELECT count(*) FROM focus_sessions") == 0
    assert count("SELECT count(*) FROM users") == 1
