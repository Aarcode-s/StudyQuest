# StudyQuest

A mobile-first, installable web app (PWA) for **group study accountability**. Friends join a room with an invite code, start focus timers (with a built-in Pomodoro), and see who is **Focusing**, **On break** or **Idle**. Rooms have a minimum daily commitment, and the dashboard shows daily / weekly / monthly goals, trends and when you study best. Designed for adults: no points, levels or badges, only honest trackers.

> Times are **recorded timer time, not verified productivity**. The app cannot know what you do on your device.

- Frontend (live): https://study-quest-lemon-alpha.vercel.app
- Backend (live): https://studyquest-i0x2.onrender.com  (API docs at `/docs`)
- Free-tier stack: **Neon** (Postgres) + **Render** (API) + **Vercel** (frontend)

---

## 1. What it does

| Feature | Notes |
|---|---|
| Accounts | Register / log in with email + password (Argon2 hashed). Change password in Settings > Account |
| One device at a time | Logging in elsewhere signs the old device out ("Signed in on another device") |
| Delete account | Password-confirmed; owned rooms pass to the earliest-joined member (or are deleted if you were alone); history is erased |
| Stay signed in | 30-minute access token + 30-day refresh token, renewed silently |
| **Focus screen** | Big dotted ring clock = **total focus** (count-up) with "% of daily goal"; small orb = **Pomodoro**. Tap the orb to swap which one is big |
| **Pomodoro** | Presets 25/5, 50/10, 90/20, rounds before the long break, auto-start toggle, beep + vibration. A break **pauses the server session**, so friends see "On break" |
| **Session tags + rating** | Pick a tag (Study, Project, Revision, Reading or your own); when you finish, rate how focused you felt (1-5, optional) |
| **Dashboard** | Day / Week / Month circles toward your goals; tap a circle for a trend graph (goal line, best / lowest day, vs previous period) |
| **Insights** | When you study best (hour strip), average and longest session, breaks per hour vs the anonymous room average, times you left the app, best weekday |
| **Weekly review** | Shareable image card (week total, change vs last week, 7 bars, active days) |
| **Rooms** | Create (name, daily minimum 10/20/30/45/60 min, optional weekly room goal), join by invite code, leave. Non-members get 404 |
| **Room page** | Live (who is focusing), Race (each member runs toward **their own** daily goal), Week (who "showed up" each day) |
| **Minimum commitment** | A day counts as "showed up" when you record at least the room's minimum in that room |
| **Figures** | 12 stick-figure poses as profile picture; existing users are asked once to pick |
| **Privacy** | "Hide my detailed stats" (rooms see totals only, and you are left out of room averages) and a weekly **rest day** that never counts as missed |
| Export | Download all your sessions as CSV |
| Dock mode | Black screen with only the clock (OLED friendly), screen stays awake |
| Themes | System / Light / Dark. Dot-matrix type (Doto), red as the only accent |
| Auto-pause | Leaving the app (tab hidden) pauses the timer (reason "left app"); there is no background tracking |
| PWA | Install to the home screen, works as a standalone app |

"Today" always means **India time (Asia/Kolkata)**. There is no midnight reset job: today's total is computed from stored sessions, and each session counts for the day it started.

### How the timer stays honest
- Client sends a heartbeat every **30 s**. If none arrives for **90 s**, the server stops counting.
- A database rule (partial unique index) allows **only one active session per user**.
- Pausing, resuming and finishing are validated on the server, never trusted from the client.

---

## 2. Tech stack

**Backend** (`backend/`): Python 3.12, FastAPI, SQLAlchemy 2.0, Pydantic v2, Alembic (migrations), psycopg 3, Argon2, PyJWT, slowapi (rate limits), pytest, uv.

**Frontend** (`frontend/`): React + TypeScript (strict), Vite, react-router, vite-plugin-pwa, plain CSS variables for theming. Fonts (npm, bundled, no Google request): Doto (dot-matrix numbers/headings), Space Grotesk (body), Space Mono (small labels). The dot-matrix `%` sign and `:` are drawn by the app because Doto's own glyphs look like an X / a cross.

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
      services/      business rules (sessions, stats, insights, profile, auth_sessions, status, account)
      routers/       auth, rooms, sessions, health
      dependencies/  current-user / membership checks
    alembic/versions/   migrations
    tests/              pytest suite (needs its own test database)
    scripts/            PowerShell smoke tests
  frontend/
    src/  auth/ components/ hooks/ lib/ pages/ session/ styles/
                  (session/pomodoro.ts = the Pomodoro cycle)
    public/             icons
    vercel.json  vite.config.ts
```

---

## 4. API summary

| Method | Path | Purpose |
|---|---|---|
| GET | `/healthz` | Liveness (does not touch the DB) |
| POST | `/auth/register`, `/auth/login` | Create account / sign in (login returns access + refresh token) |
| POST | `/auth/refresh`, `/auth/logout` | Renew access token / end this device's session |
| GET, PATCH | `/auth/me` | Profile. PATCH: `avatar_key`, `daily/weekly/monthly_goal_minutes`, `rest_day` (0 = Mon, null clears), `hide_details` |
| POST | `/auth/change-password` | `current_password`, `new_password` (403 if wrong) |
| GET | `/auth/export` | All your sessions as CSV |
| POST | `/auth/delete-account` | Permanently delete your account (needs `password`; 403 if wrong) |
| GET/POST | `/rooms`, `/rooms/join` | List / create (`name`, `min_daily_minutes`, `weekly_goal_minutes`) / join |
| GET | `/rooms/{id}`, `/rooms/{id}/status` | Room info / live member states (with figure + daily goal) |
| PATCH | `/rooms/{id}` | Owner only: change `min_daily_minutes` / `weekly_goal_minutes` (403 for members, 404 for outsiders) |
| GET | `/rooms/{id}/week` | "Who showed up" matrix for this week (1 showed, 0 missed, -1 not yet, 2 rest day) |
| GET | `/rooms/{id}/leaderboard?period=today\|week\|month` | Ranking |
| POST | `/rooms/{id}/leave` | Leave a room |
| POST | `/rooms/{id}/sessions` | Start a focus session (optional body `{tag}`) |
| GET | `/sessions/active` | My running/paused session |
| POST | `/sessions/{id}/heartbeat \| pause \| resume \| finish` | Timer actions. `pause` takes an optional `{reason: manual\|left_app\|pomodoro}` |
| PATCH | `/sessions/{id}` | Set `tag` and/or `rating` (1-5) |
| GET | `/stats/daily?days=365` | Per-day totals + streaks |
| GET | `/stats/insights` | Peak hours, average/longest session, breaks per hour, room averages (anonymous, needs 2+ other members) |
| GET | `/stats/review?weeks_ago=0` | Weekly review numbers |

Migrations, in order: `dc9ae80d3fc8` (users, rooms, members) -> `a24b73365126` (focus sessions + constraints) -> `b3c9e17a52d4` (auth sessions) -> `c5e1a9d2f4b8` (profiles, goals, room commitment, session tags and break stats; all new columns have defaults, so existing data is untouched).

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
npm install   # also installs the bundled fonts
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
- Password reset by email
- Background-safe timing (a notification-based approach) if pause-on-leave proves too strict

## 9. Troubleshooting
| Symptom | Cause / fix |
|---|---|
| "Can't reach the server" | `VITE_API_URL` missing at build time, or Render is waking up |
| CORS error | `CORS_ORIGINS` must match the Vercel URL exactly |
| `psycopg2` import error | `DATABASE_URL` must start with `postgresql+psycopg://` |
| `password authentication failed` | Stale password in `.env`; copy a fresh string from Neon |
| pytest refuses to run | No `TEST_DATABASE_URL` (intentional safety); create a test DB |
| Logged out on phone | You signed in on another device |
