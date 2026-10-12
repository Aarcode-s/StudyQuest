API = "/api/v1"


def _setup(client, make_user):
    a, b = make_user("alice"), make_user("bob")
    room = client.post(f"{API}/rooms", json={"name": "R"}, headers=a["headers"]).json()
    client.post(
        f"{API}/rooms/join",
        json={"invite_code": room["invite_code"]},
        headers=b["headers"],
    )
    return a, b, room["id"]


def _status(client, user, rid):
    r = client.get(f"{API}/rooms/{rid}/status", headers=user["headers"])
    assert r.status_code == 200
    return {m["username"]: m for m in r.json()["members"]}


def test_states_and_totals(client, make_user, clock):
    a, b, rid = _setup(client, make_user)
    s = _status(client, b, rid)
    assert s["alice"]["state"] == "idle" and s["bob"]["state"] == "idle"
    assert "email" not in s["alice"]

    sid = client.post(f"{API}/rooms/{rid}/sessions", headers=a["headers"]).json()["id"]
    clock.advance(40)
    client.post(f"{API}/sessions/{sid}/heartbeat", headers=a["headers"])
    s = _status(client, b, rid)
    assert s["alice"]["state"] == "focusing"
    assert s["alice"]["elapsed_seconds"] == 40
    assert s["alice"]["today_seconds"] == 40
    assert s["bob"]["today_seconds"] == 0

    client.post(f"{API}/sessions/{sid}/pause", headers=a["headers"])
    clock.advance(100)
    s = _status(client, b, rid)
    assert s["alice"]["state"] == "on_break"
    assert s["alice"]["elapsed_seconds"] == 100
    assert s["alice"]["today_seconds"] == 40


def test_other_rooms_not_leaked(client, make_user):
    a, b, rid = _setup(client, make_user)
    other = client.post(f"{API}/rooms", json={"name": "Other"}, headers=b["headers"]).json()
    client.post(f"{API}/rooms/{other['id']}/sessions", headers=b["headers"])
    s = _status(client, a, rid)
    assert s["bob"]["state"] == "idle"
    assert s["bob"]["today_seconds"] == 0


def test_stale_focusing_shows_idle(client, make_user, clock):
    a, b, rid = _setup(client, make_user)
    client.post(f"{API}/rooms/{rid}/sessions", headers=a["headers"])
    clock.advance(3600)
    assert _status(client, b, rid)["alice"]["state"] == "idle"