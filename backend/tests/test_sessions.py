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


def _start(client, user, rid):
    return client.post(f"{API}/rooms/{rid}/sessions", headers=user["headers"])


def _act(client, user, sid, action):
    return client.post(f"{API}/sessions/{sid}/{action}", headers=user["headers"])


def _status(client, user, rid):
    r = client.get(f"{API}/rooms/{rid}/status", headers=user["headers"])
    assert r.status_code == 200
    return {m["username"]: m for m in r.json()["members"]}


def test_server_counts_time_and_breaks_do_not_count(client, make_user, clock):
    a, _, rid = _setup(client, make_user)
    sid = _start(client, a, rid).json()["id"]
    clock.advance(30)
    _act(client, a, sid, "heartbeat")
    clock.advance(30)
    r = _act(client, a, sid, "pause")
    assert r.json()["focus_seconds"] == 60
    clock.advance(600)  # a long break
    assert client.get(f"{API}/sessions/active", headers=a["headers"]).json()["focus_seconds"] == 60
    _act(client, a, sid, "resume")
    clock.advance(20)
    r = _act(client, a, sid, "finish")
    assert r.json()["focus_seconds"] == 80


def test_one_active_session_per_user(client, make_user):
    a, _, rid = _setup(client, make_user)
    assert _start(client, a, rid).status_code == 201
    assert _start(client, a, rid).status_code == 409


def test_invalid_transitions_rejected(client, make_user):
    a, _, rid = _setup(client, make_user)
    sid = _start(client, a, rid).json()["id"]
    assert _act(client, a, sid, "resume").status_code == 409
    assert _act(client, a, sid, "pause").status_code == 200
    assert _act(client, a, sid, "pause").status_code == 409
    assert _act(client, a, sid, "heartbeat").status_code == 409
    assert _act(client, a, sid, "finish").status_code == 200
    assert _act(client, a, sid, "pause").status_code == 409


def test_duplicate_finish_is_idempotent(client, make_user, clock):
    a, _, rid = _setup(client, make_user)
    sid = _start(client, a, rid).json()["id"]
    clock.advance(10)
    _act(client, a, sid, "heartbeat")
    first = _act(client, a, sid, "finish").json()
    clock.advance(500)
    second = _act(client, a, sid, "finish")
    assert second.status_code == 200
    assert second.json()["focus_seconds"] == first["focus_seconds"]


def test_others_cannot_touch_my_session(client, make_user):
    a, b, rid = _setup(client, make_user)
    c = make_user("carol")
    sid = _start(client, a, rid).json()["id"]
    for who in (b, c):
        for action in ("pause", "resume", "heartbeat", "finish"):
            assert _act(client, who, sid, action).status_code == 404


def test_missing_heartbeat_stops_counting(client, make_user, clock):
    a, _, rid = _setup(client, make_user)
    sid = _start(client, a, rid).json()["id"]
    clock.advance(30)
    _act(client, a, sid, "heartbeat")
    clock.advance(3600)  # app died, no more heartbeats
    r = client.get(f"{API}/sessions/active", headers=a["headers"]).json()
    assert r["focus_seconds"] == 30 + 90  # last heartbeat + grace, nothing more
    assert _act(client, a, sid, "heartbeat").status_code == 409


def test_stale_session_does_not_block_new_start(client, make_user, clock):
    a, _, rid = _setup(client, make_user)
    _start(client, a, rid)
    clock.advance(3600)
    assert _start(client, a, rid).status_code == 201


def test_leaving_room_ends_session(client, make_user):
    a, b, rid = _setup(client, make_user)
    _start(client, b, rid)
    client.post(f"{API}/rooms/{rid}/leave", headers=b["headers"])
    assert client.get(f"{API}/sessions/active", headers=b["headers"]).json() is None