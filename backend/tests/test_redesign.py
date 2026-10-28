from datetime import timedelta
from zoneinfo import ZoneInfo

API = "/api/v1"
PASSWORD = "longenough1"


def room(client, headers, **extra):
    r = client.post(f"{API}/rooms", json={"name": "Study", **extra}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def join(client, headers, code):
    r = client.post(f"{API}/rooms/join", json={"invite_code": code}, headers=headers)
    assert r.status_code in (200, 201), r.text
    return r.json()


def tick(client, clock, headers, sid, seconds):
    while seconds > 0:
        step = min(seconds, 60)
        clock.advance(step)
        seconds -= step
        client.post(f"{API}/sessions/{sid}/heartbeat", headers=headers)


def focus(client, clock, headers, room_id, seconds, tag=None, finish=True):
    body = {"tag": tag} if tag else None
    r = client.post(f"{API}/rooms/{room_id}/sessions", json=body, headers=headers)
    assert r.status_code == 201, r.text
    sid = r.json()["id"]
    left = seconds
    while left > 0:  # heartbeats keep the server counting
        step = min(left, 60)
        clock.advance(step)
        left -= step
        client.post(f"{API}/sessions/{sid}/heartbeat", headers=headers)
    if finish:
        r = client.post(f"{API}/sessions/{sid}/finish", headers=headers)
        assert r.status_code == 200, r.text
        return r.json()
    return {"id": sid}


# ---- profile, goals, figures ---------------------------------------------

def test_new_users_have_default_goals_and_no_figure(client, make_user):
    me = client.get(f"{API}/auth/me", headers=make_user("alice")["headers"]).json()
    assert me["avatar_key"] is None
    assert (me["daily_goal_minutes"], me["weekly_goal_minutes"], me["monthly_goal_minutes"]) == (120, 600, 2400)
    assert me["rest_day"] is None and me["hide_details"] is False


def test_update_profile_changes_only_sent_fields(client, make_user):
    h = make_user("alice")["headers"]
    r = client.patch(f"{API}/auth/me", json={"avatar_key": "zen", "daily_goal_minutes": 90}, headers=h)
    assert r.status_code == 200
    assert r.json()["avatar_key"] == "zen" and r.json()["daily_goal_minutes"] == 90
    r = client.patch(f"{API}/auth/me", json={"hide_details": True, "rest_day": 6}, headers=h)
    me = r.json()
    assert me["avatar_key"] == "zen" and me["hide_details"] is True and me["rest_day"] == 6
    r = client.patch(f"{API}/auth/me", json={"rest_day": None}, headers=h)
    assert r.json()["rest_day"] is None


def test_update_profile_rejects_bad_values(client, make_user):
    h = make_user("alice")["headers"]
    assert client.patch(f"{API}/auth/me", json={"avatar_key": "dragon"}, headers=h).status_code == 422
    assert client.patch(f"{API}/auth/me", json={"daily_goal_minutes": 1}, headers=h).status_code == 422
    assert client.patch(f"{API}/auth/me", json={"rest_day": 7}, headers=h).status_code == 422


def test_change_password(client, make_user):
    alice = make_user("alice")
    r = client.post(f"{API}/auth/change-password", json={"current_password": "wrongwrong", "new_password": "brandnew123"}, headers=alice["headers"])
    assert r.status_code == 403
    r = client.post(f"{API}/auth/change-password", json={"current_password": PASSWORD, "new_password": "brandnew123"}, headers=alice["headers"])
    assert r.status_code == 204
    assert client.post(f"{API}/auth/login", json={"email": "alice@example.com", "password": PASSWORD}).status_code == 401
    assert client.post(f"{API}/auth/login", json={"email": "alice@example.com", "password": "brandnew123"}).status_code == 200


def test_export_csv_lists_sessions_and_neutralises_formulas(client, make_user, clock):
    alice = make_user("alice")
    rm = client.post(f"{API}/rooms", json={"name": "=HYPERLINK(1)"}, headers=alice["headers"]).json()
    focus(client, clock, alice["headers"], rm["id"], 120, tag="Study")
    r = client.get(f"{API}/auth/export", headers=alice["headers"])
    assert r.status_code == 200 and r.headers["content-type"].startswith("text/csv")
    lines = r.text.strip().splitlines()
    assert lines[0].startswith("started_at,ended_at,room")
    assert len(lines) == 2 and "'=HYPERLINK(1)" in lines[1] and "Study" in lines[1]
    assert client.get(f"{API}/auth/export").status_code == 401


# ---- rooms: minimum commitment -------------------------------------------

def test_room_options_and_defaults(client, make_user):
    h = make_user("alice")["headers"]
    assert room(client, h)["min_daily_minutes"] == 10
    r = room(client, h, min_daily_minutes=30, weekly_goal_minutes=1200)
    assert (r["min_daily_minutes"], r["weekly_goal_minutes"]) == (30, 1200)
    bad = client.post(f"{API}/rooms", json={"name": "x", "min_daily_minutes": 1}, headers=h)
    assert bad.status_code == 422


def test_showed_up_today_and_focusing_now(client, make_user, clock):
    alice, bob = make_user("alice"), make_user("bob")
    rm = room(client, alice["headers"], min_daily_minutes=10)
    join(client, bob["headers"], rm["invite_code"])
    focus(client, clock, alice["headers"], rm["id"], 11 * 60)
    focus(client, clock, bob["headers"], rm["id"], 5 * 60, finish=False)
    got = client.get(f"{API}/rooms", headers=alice["headers"]).json()[0]
    assert got["showed_up_today"] == 1 and got["focusing_now"] == 1
    detail = client.get(f"{API}/rooms/{rm['id']}", headers=alice["headers"]).json()
    assert detail["min_daily_minutes"] == 10 and detail["showed_up_today"] == 1


def test_status_includes_figure_goal_and_hidden(client, make_user):
    alice, bob = make_user("alice"), make_user("bob")
    rm = room(client, alice["headers"])
    join(client, bob["headers"], rm["invite_code"])
    client.patch(f"{API}/auth/me", json={"avatar_key": "run", "daily_goal_minutes": 60, "hide_details": True}, headers=bob["headers"])
    members = client.get(f"{API}/rooms/{rm['id']}/status", headers=alice["headers"]).json()["members"]
    by = {m["username"]: m for m in members}
    assert by["bob"]["avatar_key"] == "run" and by["bob"]["daily_goal_minutes"] == 60 and by["bob"]["hidden"] is True
    assert by["alice"]["avatar_key"] is None and by["alice"]["hidden"] is False


def test_week_matrix(client, make_user, clock):
    alice, bob = make_user("alice"), make_user("bob")
    rm = room(client, alice["headers"], min_daily_minutes=10)
    join(client, bob["headers"], rm["invite_code"])
    focus(client, clock, alice["headers"], rm["id"], 12 * 60)
    wk = client.get(f"{API}/rooms/{rm['id']}/week", headers=alice["headers"]).json()
    today = clock.now.astimezone(ZoneInfo("Asia/Kolkata")).weekday()
    rows = {m["username"]: m["days"] for m in wk["members"]}
    assert rows["alice"][today] == 1 and rows["bob"][today] == -1
    assert all(d == -1 for d in rows["alice"][today + 1:])
    assert all(d == 0 for d in rows["bob"][:today])
    assert wk["week_seconds"] >= 12 * 60 and wk["min_daily_minutes"] == 10
    client.patch(f"{API}/auth/me", json={"rest_day": 0}, headers=bob["headers"])
    wk = client.get(f"{API}/rooms/{rm['id']}/week", headers=alice["headers"]).json()
    assert {m["username"]: m["days"] for m in wk["members"]}["bob"][0] == 2


def test_week_matrix_is_members_only(client, make_user):
    alice, eve = make_user("alice"), make_user("eve")
    rm = room(client, alice["headers"])
    assert client.get(f"{API}/rooms/{rm['id']}/week", headers=eve["headers"]).status_code == 404


# ---- sessions: tags, ratings, breaks -------------------------------------

def test_tag_at_start_and_rating_at_end(client, make_user, clock):
    alice = make_user("alice")
    rm = room(client, alice["headers"])
    s = focus(client, clock, alice["headers"], rm["id"], 60, tag="Project")
    assert s["tag"] == "Project" and s["rating"] is None
    r = client.patch(f"{API}/sessions/{s['id']}", json={"tag": "Revision", "rating": 4}, headers=alice["headers"])
    assert r.status_code == 200 and r.json()["tag"] == "Revision" and r.json()["rating"] == 4
    r = client.patch(f"{API}/sessions/{s['id']}", json={"rating": 5}, headers=alice["headers"])
    assert r.json()["tag"] == "Revision" and r.json()["rating"] == 5


def test_session_update_validation_and_ownership(client, make_user, clock):
    alice, bob = make_user("alice"), make_user("bob")
    rm = room(client, alice["headers"])
    s = focus(client, clock, alice["headers"], rm["id"], 30)
    assert client.patch(f"{API}/sessions/{s['id']}", json={"rating": 6}, headers=alice["headers"]).status_code == 422
    assert client.patch(f"{API}/sessions/{s['id']}", json={"tag": "x" * 21}, headers=alice["headers"]).status_code == 422
    assert client.patch(f"{API}/sessions/{s['id']}", json={"rating": 3}, headers=bob["headers"]).status_code == 404


def test_pause_reasons_and_break_time_feed_insights(client, make_user, clock):
    alice = make_user("alice")
    rm = room(client, alice["headers"])
    h = alice["headers"]
    sid = client.post(f"{API}/rooms/{rm['id']}/sessions", headers=h).json()["id"]
    tick(client, clock, h, sid, 30 * 60)
    assert client.post(f"{API}/sessions/{sid}/pause", json={"reason": "left_app"}, headers=h).status_code == 200
    clock.advance(120)
    client.post(f"{API}/sessions/{sid}/resume", headers=h)
    tick(client, clock, h, sid, 30 * 60)
    client.post(f"{API}/sessions/{sid}/pause", headers=h)  # no body = manual
    clock.advance(60)
    client.post(f"{API}/sessions/{sid}/resume", headers=h)
    client.post(f"{API}/sessions/{sid}/finish", headers=h)
    ins = client.get(f"{API}/stats/insights", headers=h).json()
    assert ins["sessions"] == 1 and ins["left_app_count"] == 1
    assert ins["breaks_per_hour"] == 2.0  # 2 pauses in 1 hour of focus
    assert ins["avg_break_seconds"] == 90  # (120 + 60) / 2
    assert ins["focus_break_ratio"] == 20.0  # 3600 / 180


def test_bad_pause_reason_rejected(client, make_user):
    alice = make_user("alice")
    rm = room(client, alice["headers"])
    sid = client.post(f"{API}/rooms/{rm['id']}/sessions", headers=alice["headers"]).json()["id"]
    r = client.post(f"{API}/sessions/{sid}/pause", json={"reason": "bored"}, headers=alice["headers"])
    assert r.status_code == 422


# ---- insights ------------------------------------------------------------

def test_insights_empty(client, make_user):
    ins = client.get(f"{API}/stats/insights", headers=make_user("alice")["headers"]).json()
    assert ins["sessions"] == 0 and ins["peak_hours"] == [] and ins["hours"] == [0] * 24
    assert ins["room"]["breaks_per_hour"] is None and ins["best_weekday"] is None


def test_insights_peak_hours_and_lengths(client, make_user, clock):
    alice = make_user("alice")
    rm = room(client, alice["headers"])
    focus(client, clock, alice["headers"], rm["id"], 50 * 60)
    focus(client, clock, alice["headers"], rm["id"], 20 * 60)
    ins = client.get(f"{API}/stats/insights", headers=alice["headers"]).json()
    assert ins["sessions"] == 2 and sum(ins["hours"]) in range(4195, 4205)
    assert ins["longest_session_seconds"] == 50 * 60 and ins["avg_session_seconds"] == 35 * 60
    assert len(ins["peak_hours"]) == 2
    assert ins["best_weekday"] == clock.now.astimezone(ZoneInfo("Asia/Kolkata")).weekday()


def test_room_averages_are_anonymous_and_respect_hide(client, make_user, clock):
    alice, bob, cara, dan = (make_user(n) for n in ("alice", "bob", "cara", "dan"))
    rm = room(client, alice["headers"])
    for u in (bob, cara, dan):
        join(client, u["headers"], rm["invite_code"])
    for u in (bob, cara):
        focus(client, clock, u["headers"], rm["id"], 20 * 60)
    ins = client.get(f"{API}/stats/insights", headers=alice["headers"]).json()
    assert ins["room"]["members"] == 3 and ins["room"]["avg_session_seconds"] == 20 * 60
    assert "username" not in str(ins["room"])
    client.patch(f"{API}/auth/me", json={"hide_details": True}, headers=cara["headers"])
    client.patch(f"{API}/auth/me", json={"hide_details": True}, headers=dan["headers"])
    ins = client.get(f"{API}/stats/insights", headers=alice["headers"]).json()
    assert ins["room"]["members"] == 1 and ins["room"]["avg_session_seconds"] is None


# ---- weekly review -------------------------------------------------------

def test_weekly_review(client, make_user, clock):
    alice = make_user("alice")
    rm = room(client, alice["headers"])
    focus(client, clock, alice["headers"], rm["id"], 30 * 60, tag="Study")
    focus(client, clock, alice["headers"], rm["id"], 15 * 60, tag="Project")
    rv = client.get(f"{API}/stats/review", headers=alice["headers"]).json()
    today = clock.now.astimezone(ZoneInfo("Asia/Kolkata")).weekday()
    assert rv["total_seconds"] == 45 * 60 and rv["sessions"] == 2
    assert rv["days"][today] == 45 * 60 and sum(rv["days"]) == 45 * 60
    assert rv["best_day"] == today and rv["active_days"] == 1
    assert rv["top_tag"] == "Study" and rv["change_percent"] is None
    prev = client.get(f"{API}/stats/review?weeks_ago=1", headers=alice["headers"]).json()
    assert prev["total_seconds"] == 0 and prev["best_day"] is None


def test_weekly_review_compares_with_last_week(client, make_user, clock):
    alice = make_user("alice")
    rm = room(client, alice["headers"])
    clock.advance(-7 * 86400)
    focus(client, clock, alice["headers"], rm["id"], 20 * 60)
    clock.advance(7 * 86400 - 20 * 60)
    focus(client, clock, alice["headers"], rm["id"], 30 * 60)
    rv = client.get(f"{API}/stats/review", headers=alice["headers"]).json()
    assert rv["previous_seconds"] == 20 * 60 and rv["change_percent"] == 50


# ---- account deletion still clean ----------------------------------------

def test_delete_account_with_new_data(client, make_user, clock):
    alice = make_user("alice")
    rm = room(client, alice["headers"])
    s = focus(client, clock, alice["headers"], rm["id"], 120, tag="Study")
    client.patch(f"{API}/sessions/{s['id']}", json={"rating": 3}, headers=alice["headers"])
    r = client.post(f"{API}/auth/delete-account", json={"password": PASSWORD}, headers=alice["headers"])
    assert r.status_code == 204


# ---- owner can change room settings ---------------------------------------

def test_owner_changes_room_minimum_and_weekly_goal(client, make_user):
    alice = make_user("alice")
    rm = room(client, alice["headers"])
    r = client.patch(f"{API}/rooms/{rm['id']}", json={"min_daily_minutes": 30, "weekly_goal_minutes": 1200}, headers=alice["headers"])
    assert r.status_code == 200 and r.json()["min_daily_minutes"] == 30 and r.json()["weekly_goal_minutes"] == 1200
    r = client.patch(f"{API}/rooms/{rm['id']}", json={"weekly_goal_minutes": None}, headers=alice["headers"])
    assert r.json()["min_daily_minutes"] == 30 and r.json()["weekly_goal_minutes"] is None
    assert client.patch(f"{API}/rooms/{rm['id']}", json={"min_daily_minutes": 1}, headers=alice["headers"]).status_code == 422


def test_only_owner_can_change_room_settings(client, make_user):
    alice, bob, eve = make_user("alice"), make_user("bob"), make_user("eve")
    rm = room(client, alice["headers"])
    join(client, bob["headers"], rm["invite_code"])
    assert client.patch(f"{API}/rooms/{rm['id']}", json={"min_daily_minutes": 60}, headers=bob["headers"]).status_code == 403
    assert client.patch(f"{API}/rooms/{rm['id']}", json={"min_daily_minutes": 60}, headers=eve["headers"]).status_code == 404
    assert client.get(f"{API}/rooms/{rm['id']}", headers=alice["headers"]).json()["min_daily_minutes"] == 10


def test_only_owner_can_delete_room(client, make_user):
    alice, bob, eve = make_user("alice"), make_user("bob"), make_user("eve")
    rm = room(client, alice["headers"])
    join(client, bob["headers"], rm["invite_code"])
    assert client.delete(f"{API}/rooms/{rm['id']}", headers=bob["headers"]).status_code == 403
    assert client.delete(f"{API}/rooms/{rm['id']}", headers=eve["headers"]).status_code == 404
    assert client.delete(f"{API}/rooms/{rm['id']}", headers=alice["headers"]).status_code == 204
    assert client.get(f"{API}/rooms/{rm['id']}", headers=alice["headers"]).status_code == 404
    assert client.get(f"{API}/rooms/{rm['id']}", headers=bob["headers"]).status_code == 404
    assert client.get(f"{API}/rooms", headers=bob["headers"]).json() == []
