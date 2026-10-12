API = "/api/v1"


def _room(client, user, name="Room"):
    r = client.post(f"{API}/rooms", json={"name": name}, headers=user["headers"])
    assert r.status_code == 201, r.text
    return r.json()


def _join(client, user, code):
    return client.post(
        f"{API}/rooms/join", json={"invite_code": code}, headers=user["headers"]
    )


def test_create_and_join_flow(client, make_user):
    a, b = make_user("alice"), make_user("bob")
    room = _room(client, a)
    assert room["role"] == "owner" and room["member_count"] == 1
    assert _join(client, b, room["invite_code"].lower()).status_code == 200
    assert _join(client, b, room["invite_code"]).status_code == 409
    assert _join(client, b, "ZZZZZZZZ").status_code == 404


def test_rooms_require_auth(client):
    assert client.get(f"{API}/rooms").status_code == 401
    assert client.post(f"{API}/rooms", json={"name": "x"}).status_code == 401


def test_outsider_cannot_see_or_touch_room(client, make_user):
    a, c = make_user("alice"), make_user("carol")
    room = _room(client, a)
    rid = room["id"]
    for method, path in [
        ("get", f"/rooms/{rid}"),
        ("get", f"/rooms/{rid}/status"),
        ("post", f"/rooms/{rid}/leave"),
        ("post", f"/rooms/{rid}/sessions"),
    ]:
        r = getattr(client, method)(f"{API}{path}", headers=c["headers"])
        assert r.status_code == 404, (method, path)
    assert client.get(f"{API}/rooms", headers=c["headers"]).json() == []
    assert client.get(f"{API}/rooms/999999", headers=c["headers"]).status_code == 404


def test_member_list_has_no_email(client, make_user):
    a, b = make_user("alice"), make_user("bob")
    room = _room(client, a)
    _join(client, b, room["invite_code"])
    r = client.get(f"{API}/rooms/{room['id']}", headers=a["headers"])
    assert len(r.json()["members"]) == 2
    assert all("email" not in m for m in r.json()["members"])


def test_owner_leave_rules(client, make_user):
    a, b = make_user("alice"), make_user("bob")
    room = _room(client, a)
    _join(client, b, room["invite_code"])
    rid = room["id"]
    assert client.post(f"{API}/rooms/{rid}/leave", headers=a["headers"]).status_code == 409
    assert client.post(f"{API}/rooms/{rid}/leave", headers=b["headers"]).status_code == 204
    assert client.post(f"{API}/rooms/{rid}/leave", headers=b["headers"]).status_code == 404
    assert client.post(f"{API}/rooms/{rid}/leave", headers=a["headers"]).status_code == 204
    assert client.get(f"{API}/rooms/{rid}", headers=a["headers"]).status_code == 404