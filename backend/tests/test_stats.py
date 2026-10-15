from datetime import datetime, timezone

API = "/api/v1"
DAY = 86_400

# Wednesday 2026-03-18, 12:00 in India (06:30 UTC). Week starts Monday 2026-03-16.
NOON_WED = datetime(2026, 3, 18, 6, 30, tzinfo=timezone.utc)


def make_room(client, user, name="Study"):
    r = client.post(f"{API}/rooms", json={"name": name}, headers=user["headers"])
    assert r.status_code == 201, r.text
    return r.json()


def join(client, user, room):
    r = client.post(
        f"{API}/rooms/join",
        json={"invite_code": room["invite_code"]},
        headers=user["headers"],
    )
    assert r.status_code == 200, r.text


def focus(client, clock, user, room_id, seconds):
    """Record exactly `seconds` of focus time, then finish the session."""
    h = user["headers"]
    r = client.post(f"{API}/rooms/{room_id}/sessions", headers=h)
    assert r.status_code == 201, r.text
    sid = r.json()["id"]
    left = seconds
    while left > 0:
        step = min(60, left)  # stay inside the 90 s heartbeat grace window
        clock.advance(step)
        left -= step
        r = client.post(f"{API}/sessions/{sid}/heartbeat", headers=h)
        assert r.status_code == 200, r.text
    r = client.post(f"{API}/sessions/{sid}/finish", headers=h)
    assert r.status_code == 200, r.text
    assert r.json()["focus_seconds"] == seconds


def board(client, user, room_id, period):
    r = client.get(
        f"{API}/rooms/{room_id}/leaderboard",
        params={"period": period},
        headers=user["headers"],
    )
    assert r.status_code == 200, r.text
    return r.json()


def rows(data):
    return [(m["username"], m["seconds"], m["rank"]) for m in data["members"]]


def daily(client, user, days=365):
    r = client.get(f"{API}/stats/daily", params={"days": days}, headers=user["headers"])
    assert r.status_code == 200, r.text
    return r.json()


# ---------------------------------------------------------------- leaderboard


def test_leaderboard_ranks_members_for_each_period(client, make_user, clock):
    clock.now = NOON_WED
    alice, bob = make_user("alice"), make_user("bob")
    room = make_room(client, alice)
    join(client, bob, room)

    focus(client, clock, alice, room["id"], 1800)
    focus(client, clock, bob, room["id"], 900)

    data = board(client, alice, room["id"], "today")
    assert rows(data) == [("alice", 1800, 1), ("bob", 900, 2)]
    assert data["since"] == "2026-03-18"

    clock.advance(DAY)  # Thursday
    focus(client, clock, bob, room["id"], 600)

    assert rows(board(client, alice, room["id"], "today")) == [
        ("bob", 600, 1),
        ("alice", 0, None),
    ]
    week = board(client, alice, room["id"], "week")
    assert week["since"] == "2026-03-16"
    assert rows(week) == [("alice", 1800, 1), ("bob", 1500, 2)]

    clock.advance(5 * DAY)  # Tuesday 24th: a new week, same month
    week = board(client, alice, room["id"], "week")
    assert week["since"] == "2026-03-23"
    assert rows(week) == [("alice", 0, None), ("bob", 0, None)]
    month = board(client, alice, room["id"], "month")
    assert month["since"] == "2026-03-01"
    assert rows(month) == [("alice", 1800, 1), ("bob", 1500, 2)]


def test_equal_totals_share_a_rank(client, make_user, clock):
    clock.now = NOON_WED
    alice, bob, cara = make_user("alice"), make_user("bob"), make_user("cara")
    room = make_room(client, alice)
    join(client, bob, room)
    join(client, cara, room)

    focus(client, clock, alice, room["id"], 600)
    focus(client, clock, bob, room["id"], 600)
    focus(client, clock, cara, room["id"], 300)

    assert rows(board(client, cara, room["id"], "today")) == [
        ("alice", 600, 1),
        ("bob", 600, 1),
        ("cara", 300, 3),
    ]


def test_leaderboard_only_counts_this_room(client, make_user, clock):
    clock.now = NOON_WED
    alice = make_user("alice")
    room_a = make_room(client, alice, "A")
    room_b = make_room(client, alice, "B")
    focus(client, clock, alice, room_a["id"], 600)
    focus(client, clock, alice, room_b["id"], 300)

    assert rows(board(client, alice, room_a["id"], "today")) == [("alice", 600, 1)]
    assert rows(board(client, alice, room_b["id"], "today")) == [("alice", 300, 1)]


def test_leaderboard_includes_a_running_timer(client, make_user, clock):
    clock.now = NOON_WED
    alice = make_user("alice")
    room = make_room(client, alice)
    r = client.post(f"{API}/rooms/{room['id']}/sessions", headers=alice["headers"])
    assert r.status_code == 201
    clock.advance(45)
    assert rows(board(client, alice, room["id"], "today")) == [("alice", 45, 1)]


def test_leaderboard_is_members_only_and_validates_period(client, make_user, clock):
    clock.now = NOON_WED
    alice, mallory = make_user("alice"), make_user("mallory")
    room = make_room(client, alice)

    r = client.get(
        f"{API}/rooms/{room['id']}/leaderboard", headers=mallory["headers"]
    )
    assert r.status_code == 404
    r = client.get(f"{API}/rooms/99999/leaderboard", headers=alice["headers"])
    assert r.status_code == 404
    r = client.get(
        f"{API}/rooms/{room['id']}/leaderboard",
        params={"period": "decade"},
        headers=alice["headers"],
    )
    assert r.status_code == 422
    r = client.get(f"{API}/rooms/{room['id']}/leaderboard")
    assert r.status_code == 401


# ------------------------------------------------------------------ daily stats


def test_daily_stats_empty_for_a_new_user(client, make_user, clock):
    clock.now = NOON_WED
    alice = make_user("alice")
    data = daily(client, alice)
    assert len(data["days"]) == 365
    assert data["days"][-1]["day"] == "2026-03-18"
    assert data["days"][0]["day"] == "2025-03-19"
    assert data["current_streak"] == 0
    assert data["longest_streak"] == 0
    assert data["active_days"] == 0
    assert data["total_seconds"] == 0
    assert data["streak_min_seconds"] == 600


def test_streaks_and_cross_room_totals(client, make_user, clock):
    clock.now = NOON_WED
    alice = make_user("alice")
    room_a = make_room(client, alice, "A")
    room_b = make_room(client, alice, "B")

    # Wed: two rooms, 400 + 400 = 800 s counts as one qualifying day
    focus(client, clock, alice, room_a["id"], 400)
    focus(client, clock, alice, room_b["id"], 400)
    clock.advance(DAY)  # Thu
    focus(client, clock, alice, room_a["id"], 700)
    clock.advance(DAY)  # Fri: nothing, the streak breaks
    clock.advance(DAY)  # Sat
    focus(client, clock, alice, room_a["id"], 700)
    clock.advance(DAY)  # Sun: too short to count
    focus(client, clock, alice, room_a["id"], 300)
    clock.advance(DAY)  # Mon
    focus(client, clock, alice, room_a["id"], 700)

    data = daily(client, alice)
    by_day = {d["day"]: d["seconds"] for d in data["days"]}
    assert by_day["2026-03-18"] == 800
    assert by_day["2026-03-19"] == 700
    assert by_day["2026-03-20"] == 0
    assert by_day["2026-03-22"] == 300
    assert by_day["2026-03-23"] == 700
    assert data["days"][-1]["day"] == "2026-03-23"
    assert data["longest_streak"] == 2  # Wed + Thu
    assert data["current_streak"] == 1  # Mon only: Sunday was below the minimum
    assert data["active_days"] == 4
    assert data["total_seconds"] == 800 + 700 + 700 + 300 + 700


def test_current_streak_survives_until_the_day_ends(client, make_user, clock):
    clock.now = NOON_WED
    alice = make_user("alice")
    room = make_room(client, alice)
    focus(client, clock, alice, room["id"], 700)  # Wed
    clock.advance(DAY)  # Thu
    focus(client, clock, alice, room["id"], 700)

    assert daily(client, alice)["current_streak"] == 2
    clock.advance(DAY)  # Fri, nothing recorded yet: still alive
    assert daily(client, alice)["current_streak"] == 2
    clock.advance(DAY)  # Sat: Friday was missed
    assert daily(client, alice)["current_streak"] == 0
    assert daily(client, alice)["longest_streak"] == 2


def test_session_counts_for_the_day_it_started(client, make_user, clock):
    # 23:50 in India on Wed 18 March, then 20 minutes: ends after midnight.
    clock.now = datetime(2026, 3, 18, 18, 20, tzinfo=timezone.utc)
    alice = make_user("alice")
    room = make_room(client, alice)
    focus(client, clock, alice, room["id"], 1200)

    by_day = {d["day"]: d["seconds"] for d in daily(client, alice)["days"]}
    assert by_day["2026-03-18"] == 1200
    assert by_day["2026-03-19"] == 0


def test_daily_stats_are_private_and_validated(client, make_user, clock):
    clock.now = NOON_WED
    alice, bob = make_user("alice"), make_user("bob")
    room = make_room(client, alice)
    focus(client, clock, alice, room["id"], 700)

    assert daily(client, bob)["total_seconds"] == 0
    assert daily(client, alice)["total_seconds"] == 700

    h = alice["headers"]
    assert client.get(f"{API}/stats/daily", params={"days": 6}, headers=h).status_code == 422
    assert client.get(f"{API}/stats/daily", params={"days": 401}, headers=h).status_code == 422
    assert len(daily(client, alice, days=7)["days"]) == 7
    assert client.get(f"{API}/stats/daily").status_code == 401
