# StudyQuest

A mobile-first PWA for group study accountability. Friends join rooms, run focus
sessions, and see who is focusing and for how long.

> **Note:** focus times are *recorded timer time*, not verified productivity.
> The server cannot know what someone is doing while their timer runs.

## Status

**Implemented (backend v1)**
- Accounts: register, login (Argon2 hashing, short-lived JWT access tokens)
- Rooms with invite codes; join, list, detail, leave
- Focus sessions: start, pause, resume, heartbeat, finish, timed only by the server
- Live room status (Focusing / On break / Idle) and today's totals (India time)
- Rate limiting on sensitive endpoints, CORS limited to the frontend origin
- Automated tests (pytest) against a separate Postgres database

**Planned**
- Frontend (React + TypeScript + Vite PWA, dock-mode clock screen)
- Deployment
- v2: WebSockets, daily/weekly stats
- v3: XP, streaks, leaderboards
- Refresh tokens, ownership transfer, invite code rotation, per-user timezones

## Tech

Python, FastAPI, SQLAlchemy 2.0 (sync), Pydantic v2, Alembic, PostgreSQL (Neon),
pytest.

## Run locally

Requires [uv](https://docs.astral.sh/uv/) and a PostgreSQL database.

    cd backend
    copy .env.example .env      # then fill in the values
    uv sync
    uv run python -m alembic upgrade head
    uv run python -m uvicorn app.main:app --reload

API docs: http://127.0.0.1:8000/docs

## Tests

Tests need a separate database (its name must contain `test`) set as
`TEST_DATABASE_URL` in `backend/.env`. Tables are wiped before every test.

    uv run python -m pytest -v

## Design notes

- Clients send actions, never durations. The server stamps every action with UTC.
- A heartbeat every ~30s keeps a session counting; after 90s of silence it stops.
- One active session per user, enforced by a partial unique index in Postgres.
- Room data is visible only to members; non-members get 404.