# StudyQuest

A mobile-first, installable web app (PWA) for **group study accountability**. Friends join a room with an invite code, start focus timers, and see who is **Focusing**, **On break** or **Idle**, with today's totals, a leaderboard and a GitHub-style streak grid.

> Times are **recorded timer time, not verified productivity**. The app cannot know what you do on your device.

- Frontend (live): https://study-quest-lemon-alpha.vercel.app
- Backend (live): https://studyquest-i0x2.onrender.com  (API docs at `/docs`)
- Free-tier stack: **Neon** (Postgres) + **Render** (API) + **Vercel** (frontend)

---

## 1. What it does

| Feature | Notes |
|---|---|
| Accounts | Register / log in with email + password (Argon2 hashed) |
| One device at a time | Logging in elsewhere signs the old device out ("Signed in on another device") |
| Delete account | Password-confirmed; owned rooms pass to the earliest-joined member (or are deleted if you were alone); history is erased |
| Stay signed in | 30-minute access token + 30-day refresh token, renewed silently |
| Rooms | Create, join by invite code, leave. Non-members get 404 (rooms are invisible to outsiders) |
| Focus timer | Start / pause / resume / finish. **The server owns the clock**; the phone only sends actions |
| Live status | Room page polls every 5 s: Focusing / On break / Idle, elapsed, today total |
| Leaderboard | Today / this week / this month per room |
| Streak grid | Last 12 months, current and longest streak (a day counts at >= 10 min) |
| Dock mode | Black screen with only the clock (OLED friendly), screen stays awake |
| Themes | System / Light (warm pastel) / Dark (black, grey, white + red accent) |
| Keep awake | Screen Wake Lock so the phone does not sleep while a timer runs |
| Auto-pause | Leaving the app (tab hidden) pauses the timer so you cannot cheat by switching apps |
| PWA | Install to the home screen, works as a standalone app |

"Today" always means **India time (Asia/Kolkata)**. There is no midnight reset job: today's total is computed from stored sessions, and each session counts for the day it started.

### How the timer stays honest
- Client sends a heartbeat every **30 s**. If none arrives for **90 s**, the server stops counting.
- A database rule (partial unique index) allows **only one active session per user**.
- Pausing, resuming and finishing are validated on the server, never trusted from the client.

---

## 2. Tech stack

**Backend** (`backend/`): Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic v2, Alembic (migrations), psycopg 3, Argon2, PyJWT, slowapi (rate limits), pytest, uv.

**Frontend** (`frontend/`): React + TypeScript (strict), Vite, react-router, vite-plugin-pwa, plain CSS variables for theming. Fonts: Sora + DM Sans.

**Hosting**: Neon (database), Render (API), Vercel (static frontend).

### What is a PWA?
A website that can be installed like an app: it has a manifest (name, icons, colours) and a service worker (caches the app shell). It needs HTTPS, which Vercel provides.

---

## 3. Project layout

```
studyquest/
  render.yaml
  backend/
    app/
      core/          config, security (JWT/Argon2), rate limiting
      db/            engine + session
      models/        users, rooms, room_members, focus_sessions, auth_sessions
      schemas/       request/response shapes
      services/      business rules (sessions, stats, auth_sessions, status)
      routers/       auth, rooms, sessions, health
      dependencies/  current-user / membership checks
    alembic/versions/   migrations
    tests/              pytest suite (needs its own test database)
    scripts/            PowerShell smoke tests
  frontend/
    src/  auth/ components/ hooks/ lib/ pages/ session/ styles/
    public/             icons
    vercel.json  vite.config.ts
```

---

## 4. API summary

| Method | Path | Purpose |
|---|---|---|
| GET | `/healthz` | Liveness (does not touch the DB) |
| POST | `/auth/register`, `/auth/login` | Create account / sign in (login returns access + refresh token) |
| POST | `/auth/refresh` | Swap a refresh token for a new access token |
| POST | `/auth/logout` | End this device's session |
| POST | `/auth/delete-account` | Permanently delete your account (needs `password`; 403 if wrong) |
| GET | `/auth/me` | Current user |
| GET/POST | `/rooms`, `/rooms/join` | List / create / join |
| GET | `/rooms/{id}`, `/rooms/{id}/status` | Room info / live member states |
| POST | `/rooms/{id}/leave` | Leave a room |
| GET | `/rooms/{id}/leaderboard?period=today\|week\|month` | Ranking |
| POST | `/rooms/{id}/sessions` | Start a focus session |
| GET | `/sessions/active` | My running/paused session |
| POST | `/sessions/{id}/heartbeat \| pause \| resume \| finish` | Timer actions |
| GET | `/stats/daily?days=365` | Per-day totals + streaks |

Migrations, in order: `dc9ae80d3fc8` (users, rooms, members) -> `a24b73365126` (focus sessions + constraints) -> `b3c9e17a52d4` (auth sessions).

---

## 5. Run it on your computer

Prerequisites: Git, Python 3.12+, [uv](https://docs.astral.sh/uv/), Node 22+ and npm, and a Postgres database (a free Neon project works).

### Three databases, never mix them
| Purpose | Name | Used by |
|---|---|---|
| Production | the Neon DB the live site uses | Render only |
| Development | e.g. `studyquest_dev` (separate Neon project or branch) | your local server |
| Test | e.g. `studyquest_test` | pytest only |

**Tests wipe every table.** The test suite refuses to run unless `TEST_DATABASE_URL` is set and the database name contains `test`. Never point it at production. If you have no test database, leave `TEST_DATABASE_URL` out of `.env` entirely.

### Backend
```powershell
cd backend
uv sync
copy .env.example .env        # then edit .env
uv run python -m alembic upgrade head
uv run python -m uvicorn app.main:app --reload
```
Use `python -m ...` (not bare `uvicorn`/`pytest`) if Windows blocks .exe files.

`.env` values:
```
APP_ENV=development
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST/DBNAME?sslmode=require
SECRET_KEY=<long random string, different for every environment>
CORS_ORIGINS=http://localhost:5173
RATE_LIMIT_ENABLED=true
# Only when you have a dedicated test database:
# TEST_DATABASE_URL=postgresql+psycopg://...studyquest_test...
```
The URL must start with `postgresql+psycopg://`.

### Frontend
```powershell
cd frontend
npm install
echo VITE_API_URL=http://localhost:8000 > .env.local
npm run dev
```

### Tests
```powershell
cd backend
uv run python -m pytest
```

---

## 6. Deploy (free tier)

1. **Neon**: create a project, copy the connection string, change the prefix to `postgresql+psycopg://`.
2. **Render**: new Web Service from the GitHub repo (`render.yaml` is included). The start command runs `alembic upgrade head`, so migrations apply on every deploy. Environment variables:
   - `APP_ENV=production`
   - `DATABASE_URL` (Neon string)
   - `SECRET_KEY` (new random value, not the local one)
   - `CORS_ORIGINS=https://<your-vercel-domain>` (https, no trailing slash)
   - `RATE_LIMIT_ENABLED=true`
   - `TRUST_PROXY_HEADERS=true`, `TRUSTED_PROXY_HOPS=1` (client IP is read from `X-Forwarded-For`)
   In production the app refuses to start with a weak secret, non-https CORS, rate limiting off, or the wrong DB driver.
3. **Vercel**: import the repo, root directory `frontend`, set `VITE_API_URL=https://<your-render-domain>`. It is baked in at build time, so **redeploy after changing it**.
4. After a frontend change, if the old version keeps showing: unregister the service worker (DevTools > Application) and hard refresh.

### Free-tier realities
- Render sleeps after ~15 min idle; the first request takes about a minute. The login page pings `/healthz` to wake it.
- Neon free has 1 GB storage; compute hours are the real limit.

---

## 7. Security notes
- Never commit `.env`, database URLs or secrets. Run `git status` before every commit.
- Passwords: Argon2. Tokens: HS256 JWT; refresh tokens are stored hashed (sha256).
- Known limitation: tokens live in `localStorage` (standard for a simple SPA, readable by any script on the page).
- Rooms use 404 (not 403) for non-members so room IDs cannot be probed.

---

## 8. Roadmap
- WebSockets for instant status instead of 5 s polling
- Monthly recap (stats PDF) so old rows can be archived
- Optional keep-awake pinger for Render
- Gamification (levels, badges) on top of the existing totals

## 9. Troubleshooting
| Symptom | Cause / fix |
|---|---|
| "Can't reach the server" | `VITE_API_URL` missing at build time, or Render is waking up |
| CORS error | `CORS_ORIGINS` must match the Vercel URL exactly |
| `psycopg2` import error | `DATABASE_URL` must start with `postgresql+psycopg://` |
| `password authentication failed` | Stale password in `.env`; copy a fresh string from Neon |
| pytest refuses to run | No `TEST_DATABASE_URL` (intentional safety); create a test DB |
| Logged out on phone | You signed in on another device |
