# StudyQuest

**Focus together.** StudyQuest is a small web app for group study accountability.
Friends join a *room* with an invite code, start a focus timer, and everyone in
the room can see who is **Focusing**, **On break** or **Idle**, for how long, and
how much they have focused today.

> **Honesty note:** the times in StudyQuest are *recorded timer time*. They show
> when a timer ran, **not** what anyone was actually doing. The app does not and
> cannot verify productivity.

It is a **PWA** (Progressive Web App): you open it in a browser, and it can be
*installed* on a phone or laptop like a normal app, with no app store.

This repository is both a working project and a learning guide. If you have never
built a full-stack app, read it top to bottom.

You can try it here 
https://study-quest-lemon-alpha.vercel.app/login

<img width="300" height="500" alt="image" src="https://github.com/user-attachments/assets/18a7e108-ac45-4a47-b62e-08e88071870b" />
<img width="300" height="500" alt="image" src="https://github.com/user-attachments/assets/6e0d5a96-12ee-40b2-a8e7-317cc3105c6f" />
<img width="1040" height="894" alt="image" src="https://github.com/user-attachments/assets/5a34bbfb-47be-432f-9c90-ccc0bccef153" />
<img width="1176" height="962" alt="image" src="https://github.com/user-attachments/assets/d6d7a28a-86bf-4417-9a7e-516c261560db" />
<img width="1000" height="900" alt="image" src="https://github.com/user-attachments/assets/48339ecf-b6ec-47ed-811f-423879d98e6e" />







---

## Contents

1. [What it does (and what it does not)](#1-what-it-does-and-what-it-does-not)
2. [Words you will meet](#2-words-you-will-meet)
3. [How the pieces fit together](#3-how-the-pieces-fit-together)
4. [What you need before you start](#4-what-you-need-before-you-start)
5. [Run the project on your computer](#5-run-the-project-on-your-computer)
6. [Project layout](#6-project-layout)
7. [Backend explained](#7-backend-explained)
8. [Frontend explained](#8-frontend-explained)
9. [What is a PWA, and how this one works](#9-what-is-a-pwa-and-how-this-one-works)
10. [Dock mode](#10-dock-mode)
11. [Security rules this project follows](#11-security-rules-this-project-follows)
12. [Tests](#12-tests)
13. [Deploying (Render + Vercel)](#13-deploying-render--vercel)
14. [Build it yourself, in order](#14-build-it-yourself-in-order)
15. [Troubleshooting](#15-troubleshooting)
16. [Implemented vs planned](#16-implemented-vs-planned)
17. [Known limitations](#17-known-limitations)

---

## 1. What it does (and what it does not)

**Does**
- Register and log in.
- Create a room, share its invite code, join a friend's room, leave a room.
- Start, pause, resume and finish a focus timer.
- Show every member of a room live: **Focusing / On break / Idle**, elapsed time
  and today's total (updates every 5 seconds).
- Pause your timer automatically when you leave the app or switch tabs.
- Dock mode: a big landscape clock that keeps the screen awake.
- Install on a phone or computer (PWA).

**Does not (yet)**
- Daily and weekly stats, the GitHub-style focus grid, streaks, XP, leaderboards.
- Verify what you actually do while the timer runs.
- Work offline. The timer lives on the server.
- Support timezones other than India (`Asia/Kolkata`) for "today".

---

## 2. Words you will meet

| Word | Plain-English meaning |
|---|---|
| **Frontend** | The part you see and tap. It runs in the browser. Here: React + TypeScript. |
| **Backend / API** | A program on a server that stores data and enforces the rules. The frontend asks it questions over the internet. Here: FastAPI (Python). |
| **Database** | Where data is kept permanently. Here: PostgreSQL, hosted on Neon. |
| **Endpoint** | One address the API answers, such as `POST /api/v1/auth/login`. |
| **JWT** | A signed token the server gives you after login. You send it with every request to prove who you are. It expires after 30 minutes. |
| **Migration** | A versioned script that changes the database structure (add a table, add a column). Alembic runs them, so the database never changes by hand. |
| **ORM** | A library that lets Python code talk to the database using classes instead of raw SQL. Here: SQLAlchemy. |
| **CORS** | A browser safety rule: a website may only call an API that explicitly allows that website. We allow only our own frontend. |
| **Rate limiting** | Refusing too many requests in a short time, so nobody can guess passwords at high speed. |
| **Heartbeat** | A tiny "I'm still here" message the app sends every 30 seconds while a timer runs. If they stop, the server stops counting. |
| **PWA** | A website that can be installed like an app. See [section 9](#9-what-is-a-pwa-and-how-this-one-works). |
| **Service worker** | A small script the browser runs in the background. It lets an installed app start fast. |
| **Environment variable / `.env`** | Settings and secrets kept *outside* the code, in a file that is never committed to Git. |

---

## 3. How the pieces fit together

```mermaid
flowchart LR
  P[Phone or laptop<br/>installed PWA] -->|HTTPS + JWT| F[Frontend<br/>React, served by Vercel]
  F -->|JSON requests| B[Backend API<br/>FastAPI, on Render]
  B -->|SQL| D[(PostgreSQL<br/>Neon)]
```

**The most important idea:** the server's clock is the source of truth.

When you press Start, your phone does *not* say "I focused for 25 minutes". It
only says "start". The server notes the moment on **its own UTC clock**, and
the elapsed time is computed from those server timestamps. The app can never
submit a duration, a role or a score. This stops cheating and keeps every
member's screen consistent.

---

## 4. What you need before you start

### Accounts (all have free options)
- **GitHub**: stores the code.
- **Neon** (neon.com): the PostgreSQL database.
- **Render** (render.com): runs the backend. *(for deployment)*
- **Vercel** (vercel.com): serves the frontend. *(for deployment)*

### Tools on your computer
| Tool | Used for | Check it works |
|---|---|---|
| **Git** | Version control | `git --version` |
| **VS Code** (or any editor) | Editing code | |
| **uv** (docs.astral.sh/uv) | Python version + packages for the backend | `uv --version` |
| **Node.js 20 or newer** (nodejs.org, "LTS") | Runs the frontend tools | `node -v` and `npm -v` |
| **Chrome** (or Brave/Edge) | Testing the PWA | |

Python 3.13 or newer is needed; `uv` downloads it for you when you first run the
backend.

### Windows note
Some Windows machines use *Application Control*, which blocks `.exe` launchers
(error `os error 4551`). The fix used throughout this project:
- Python tools: `uv run python -m uvicorn ...` instead of `uvicorn ...`
- npm: `npm.cmd` instead of `npm` in PowerShell.

On macOS or Linux use the normal commands (`npm`, and `cp` instead of `copy`).

---

## 5. Run the project on your computer

### 5.1 Get the code
```powershell
git clone https://github.com/Aarcode-s/StudyQuest.git
cd StudyQuest
```
(If your clone folder is named `studyquest`, use that name below.)

### 5.2 Create the database (Neon)
1. Sign up at neon.com and create a **project** (Postgres 16 or newer is fine).
2. Open **Connection details** and copy the connection string.
3. Change its beginning from `postgresql://` to **`postgresql+psycopg://`**. This
   tells SQLAlchemy to use the modern `psycopg` driver.
4. For the **test database** (so tests never touch real data): create a second
   database, e.g. `studyquest_test`, in the same project (or a separate branch)
   and copy its connection string the same way. The name must contain the word
   `test`; the test suite refuses to run otherwise.

### 5.3 Backend
```powershell
cd backend
copy .env.example .env
```
Open `backend/.env` and fill it in:

```
APP_NAME=StudyQuest
APP_ENV=development
SECRET_KEY=<a long random string, see below>
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST/neondb?sslmode=require
TEST_DATABASE_URL=postgresql+psycopg://USER:PASSWORD@HOST/studyquest_test?sslmode=require
CORS_ORIGINS=http://localhost:5173
RATE_LIMIT_ENABLED=true
TRUST_PROXY_HEADERS=false
```

Make a secret key (any long random value works):
```powershell
uv run python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Create the tables, then start the server:
```powershell
uv run python -m alembic upgrade head
uv run python -m uvicorn app.main:app --reload
```

Check it: open **http://127.0.0.1:8000/api/v1/health**. You should see
`{"status":"ok","database":"connected"}`. The interactive API documentation is at
**http://127.0.0.1:8000/docs**.

Leave this terminal running.

### 5.4 Frontend (new terminal)
```powershell
cd frontend
npm.cmd install
copy .env.example .env
npm.cmd run dev
```
`frontend/.env` contains one line:
```
VITE_API_URL=http://127.0.0.1:8000/api/v1
```
Open **http://localhost:5173**, register an account, create a room.

> The frontend **must** run on port 5173. The backend's CORS setting allows only
> that exact address.

### 5.5 Try it with two people
Open a second *private/incognito window*, register another account, and join the
first account's room with its invite code. Start a timer in one window and watch
the other window update within 5 seconds.

---

## 6. Project layout

```
StudyQuest/
├── README.md
├── render.yaml                  Render deployment recipe (backend)
├── backend/
│   ├── app/
│   │   ├── main.py              creates the app, CORS, rate limiter, routes
│   │   ├── core/                config (settings), security (hashing, JWT), rate limiting
│   │   ├── dependencies/        shared helpers: database session, "who is logged in"
│   │   ├── models/              database tables (users, rooms, room_members, focus_sessions)
│   │   ├── schemas/             the shapes of request and response JSON
│   │   ├── services/            the business rules (auth, rooms, sessions, status)
│   │   └── routers/             the URL endpoints that call the services
│   ├── alembic/                 database migrations
│   ├── tests/                   automated tests (pytest)
│   ├── scripts/                 PowerShell smoke tests against a running server
│   ├── .env.example             settings template (safe to commit)
│   └── pyproject.toml           Python dependencies
└── frontend/
    ├── public/                  app icons
    ├── index.html
    ├── vite.config.ts           build tool + PWA settings
    └── src/
        ├── styles/tokens.css    colours, fonts, spacing (the design system)
        ├── lib/                 api client, types, formatting helpers
        ├── auth/                login state shared by the whole app
        ├── session/             the running timer, shared by the whole app
        ├── hooks/               reusable behaviour (screen wake lock)
        ├── components/          reusable pieces (route guard, timer card)
        └── pages/               one file per screen
```

The backend is layered on purpose. A **router** receives the request and checks
the input; a **service** applies the rules; a **model** talks to the database.
Keeping rules out of the routers makes them easy to test.

---

## 7. Backend explained

**Stack:** FastAPI, SQLAlchemy 2, Pydantic v2, Alembic, PostgreSQL (Neon, via
`psycopg`), PyJWT, argon2-cffi, slowapi, pytest.

### 7.1 Data model
- **users**: email, username, password hash.
- **rooms**: name, invite code, owner.
- **room_members**: which user is in which room, and their role (`owner` or `member`).
- **focus_sessions**: one row per timer run: `accumulated_seconds`,
  `segment_started_at`, `last_heartbeat_at`, status and end time.

A database rule (a *partial unique index*) guarantees a user can have **only one
active session** at a time, even if two requests arrive at once.

### 7.2 How time is counted
While a timer is **focusing**:

```
focus time = accumulated_seconds
           + (min(now, last_heartbeat + 90 seconds) - segment_started_at)
```

- **Pause** stores the elapsed segment into `accumulated_seconds`; paused time is
  never counted.
- **Heartbeats** arrive every 30 s. If they stop (app killed, phone off), the
  server stops counting 90 seconds after the last one.
- A stale session is finished automatically when you start a new one.
- **Finish** is *idempotent*: calling it twice is harmless.

### 7.3 "Today"
"Today" means the current day in India time (`Asia/Kolkata`). A session counts
toward the day it **started**. Only the room's own sessions are counted in that
room's totals.

### 7.4 API reference
Base URL locally: `http://127.0.0.1:8000/api/v1`. Send
`Authorization: Bearer <token>` on every endpoint except register, login and health.

| Method and path | What it does |
|---|---|
| `GET /health` | Is the API up and is the database reachable? |
| `POST /auth/register` | Body `{email, username, password}`. Username 3 to 30 letters, digits or `_`; password 8 to 128 characters. Rate limited to 5 per minute. |
| `POST /auth/login` | Body `{email, password}`. Returns `{access_token, token_type}`. 10 per minute. |
| `GET /auth/me` | The logged-in user. |
| `POST /rooms` | Body `{name}`. Creates a room; you become its owner. |
| `POST /rooms/join` | Body `{invite_code}`. |
| `GET /rooms` | Your rooms. |
| `GET /rooms/{id}` | One room, with its members. |
| `POST /rooms/{id}/leave` | Leave a room. An owner cannot leave while others remain. |
| `GET /rooms/{id}/status` | Who is Focusing / On break / Idle, with elapsed and today's seconds. |
| `POST /rooms/{room_id}/sessions` | Start a timer in that room. |
| `GET /sessions/active` | Your running or paused timer, or `null`. |
| `POST /sessions/{id}/pause` and `/resume` | Pause or continue. |
| `POST /sessions/{id}/heartbeat` | "Still here". A 409 means the session expired. |
| `POST /sessions/{id}/finish` | End the timer. |

Errors are always `{"detail": ...}`. Status codes you will see: `401` not logged
in, `404` not found **or not allowed** (see below), `409` conflict, `422` invalid
input, `429` too many requests.

### 7.5 Database migrations
Never change tables by hand. Change a model, then:
```powershell
uv run python -m alembic revision --autogenerate -m "describe the change"
uv run python -m alembic upgrade head
```
Always read the generated file in `alembic/versions/` before applying it.

---

## 8. Frontend explained

**Stack:** React, TypeScript, Vite, React Router, `vite-plugin-pwa`.
No UI framework: the styling is plain CSS using design tokens.

### Screens
| Route | Screen |
|---|---|
| `/login` | Log in or register |
| `/rooms` | Your rooms: create, join, copy invite codes |
| `/rooms/:roomId` | Timer card, live "Who is in" list, leave room |
| `/rooms/:roomId/dock` | Dock mode (landscape clock) |

### Key ideas in the code
- **`src/lib/api.ts`**: one `fetch` wrapper. It attaches the token, turns backend
  errors into readable messages, and logs you out on a 401.
- **`src/auth/`**: login state in a React *context*, so every screen can ask "who
  am I?". The token is kept in `localStorage` so a reload keeps you signed in.
- **`src/session/`**: the timer lives in a provider that wraps all logged-in
  screens. This matters: heartbeats must keep going even if you open another
  screen, or the server would expire your timer after 90 seconds.
- **Live clock:** the screen shows the server's `focus_seconds` plus a local
  one-second tick. Every server response resets it, so it can never drift far.
- **Polling:** the room list refreshes every 5 seconds and pauses while the tab is
  hidden, to save battery and database time.
- **Auto-pause:** when the page becomes hidden (you switch app or tab, or the
  screen locks), a running timer is paused immediately using a `keepalive`
  request, so it can finish even as the page goes away. When you return, the app
  re-syncs and you press Resume.

### Design
Dark theme with colourful accents, designed to grow into XP and leaderboards.
Colours, fonts and radii are defined once in `src/styles/tokens.css`.
Focusing is lime, On break is amber, Idle is muted violet. Text uses the Sora and
DM Sans fonts. Touch targets are at least 44 px.

---

## 9. What is a PWA, and how this one works

A **Progressive Web App** is a normal website with three extra ingredients that
let a browser treat it as an installable app:

1. **A web app manifest**: a small JSON file with the app's name, colours, icons
   and `display: standalone` (open in its own window with no browser bar).
2. **A service worker**: a background script. Here it caches the *app shell* (the
   HTML, JavaScript, CSS and icons) so the app opens instantly.
3. **HTTPS**: browsers only offer installation on secure sites. (`localhost` also
   counts as secure for testing.)

`vite-plugin-pwa` generates the manifest and the service worker during
`npm run build`. Configuration is in `frontend/vite.config.ts`. The icons are in
`frontend/public/`:

| File | Used for |
|---|---|
| `pwa-192x192.png`, `pwa-512x512.png` | Standard app icons |
| `maskable-512x512.png` | Android adaptive icon (the logo sits inside a safe zone so any mask shape works) |
| `apple-touch-icon.png` | iPhone home-screen icon |

**What is cached:** only the app shell. API calls are never cached, so room
status and timers are always live. That is also why the app does not work
offline: the timer needs the server.

**Test the PWA locally**
```powershell
cd frontend
npm.cmd run build
npm.cmd run preview
```
The dev server (`npm run dev`) has no service worker; only the built version does.
Open http://localhost:5173, then in Chrome press F12 → **Application** →
*Manifest* and *Service Workers*. The address bar shows an install icon.

**Install on a phone:** Chrome on Android only offers installation over HTTPS, so
this works on the deployed site, not on `http://192.168...` addresses. Open the
deployed URL in Chrome, then menu → *Install app*.

---

## 10. Dock mode

Dock mode turns a phone into a desk clock for your focus session: a huge
landscape timer that keeps the screen on.

- **Screen Wake Lock API** asks the browser not to dim or lock the screen. The
  browser drops the lock whenever the page is hidden, so the app asks again when
  it becomes visible.
- **Fullscreen API** hides the browser bars. It must be started by a tap, which
  is why there is a fullscreen button. On Android it also tries to lock the
  screen to landscape.
- Support depends on the browser. If Wake Lock is unavailable, the screen says
  so instead of pretending.

Leaving the app (switching app, locking the screen) still pauses the timer. That
is intentional: the timer measures time you stayed in the app.

---

## 11. Security rules this project follows

| Rule | How |
|---|---|
| Server decides, never the client | Times come from the server's UTC clock. Clients cannot send durations, roles or scores. |
| Passwords | Hashed with **Argon2**. Never stored or returned in plain text. |
| Short-lived tokens | JWT valid for 30 minutes, signed with `SECRET_KEY`. |
| Safe errors | Login failures look identical whether the email or the password was wrong. |
| Room data only for members | Non-members and other people's sessions get **404**, not 403, so existence is not leaked. |
| Authorization on every protected endpoint | Checked in a shared dependency, covered by tests. |
| CORS | Only the configured frontend origin is allowed. |
| Rate limiting | Register 5/min, login 10/min per client IP. |
| Migrations only | Alembic changes the database schema, nothing else does. |
| No secrets in Git | `.env` files are git-ignored; `.env.example` holds placeholders. |
| Production checks (Checkpoint 10.1) | With `APP_ENV=production` the backend refuses to start with a weak `SECRET_KEY`, non-HTTPS CORS origins, or rate limiting turned off. |

If a secret is ever committed by accident, treat it as leaked: rotate it (new
Neon password, new `SECRET_KEY`); deleting the file is not enough.

---

## 12. Tests

The backend has 23 automated tests (authentication, rooms, sessions, status,
rate limiting). They run against the **separate test database** from section 5.2,
which is wiped between tests. A guard stops the suite if the database name does
not contain `test`.

```powershell
cd backend
uv run python -m pytest -v
```
The suite takes a few minutes because every query travels to a hosted database.
Expect: `23 passed`.

`backend/scripts/*.ps1` are *smoke tests*: PowerShell scripts that call a running
server end to end. They are useful against a live deployment. One timing
assertion in `smoke_sessions.ps1` can fail on a slow network without meaning
anything is broken.

The frontend has no automated tests yet; it was checked by hand against a real
backend using a written checklist for each feature.

---

## 13. Deploying (Render + Vercel)

> **Status:** the code is deployment-ready (Checkpoint 10.1). The live URLs will
> be added here once deployment is complete.

Plan: **Neon** (database) + **Render** (backend) + **Vercel** (frontend).

1. **Production database.** Create a *new* database or branch in Neon for
   production. Never reuse the development or test database.
2. **Backend on Render.** Create a Web Service from the GitHub repo (or use the
   included `render.yaml`). Root directory `backend`. Environment variables (set
   in Render's dashboard, never in Git):
   `APP_ENV=production`, `SECRET_KEY` (a new strong key), `DATABASE_URL`,
   `CORS_ORIGINS` (the exact Vercel URL, `https://study-quest-lemon-alpha.vercel.app`),
   `TRUST_PROXY_HEADERS=true`, `TRUSTED_PROXY_HOPS=1`, `PYTHON_VERSION=3.13.5`.
   (`TRUSTED_PROXY_HOPS` is how many proxies sit in front of the app; it decides
   which entry of `X-Forwarded-For` is the real visitor address for rate
   limiting. Verify it after deploying: see the README section in the deploy notes.)
   The start command runs `alembic upgrade head` before starting the server.
3. **Frontend on Vercel.** Import the repo, set the root directory to `frontend`,
   and set `VITE_API_URL` to `https://studyquest-i0x2.onrender.com`.
   `frontend/vercel.json` makes every path load `index.html`, so reloading
   `/rooms/8` works.
4. **Connect them.** Put the final Vercel URL into Render's `CORS_ORIGINS`.
5. **Verify on a real phone:** open the Vercel URL in Chrome, register, install
   the app, start a timer, and watch it from a second device.

**Free-tier behaviour to expect:** Render's free service sleeps after about 15
idle minutes and takes around a minute to wake, so the first login after a quiet
period is slow. Neon's free database sleeps after 5 idle minutes and has monthly
compute-hour and 1 GB storage limits. Active timers send heartbeats, so a session
in progress keeps everything awake.

---

## 14. Build it yourself, in order

The project was built as ten checkpoints. Each one ends with a way to *prove* it
works. Rebuilding it in this order, writing the files yourself and checking each
step before moving on, is the best way to learn it. The finished code in this
repository is your answer key.

| # | Checkpoint | You learn | Proof it works |
|---|---|---|---|
| 1 | Project skeleton: `uv`, FastAPI, a `/health` endpoint | Python projects, running a web server | `/health` returns ok |
| 2 | Settings and `.env` | Configuration without secrets in code | App reads settings |
| 3 | Database connection (Neon) and models | Tables as Python classes, relationships | `/health` shows `database: connected` |
| 4 | Alembic migrations | Versioned schema changes | Tables visible in Neon |
| 5 | Authentication: register, login, `/auth/me` | Argon2, JWT, dependencies | Smoke script passes |
| 6 | Rooms: create, join, list, detail, leave | Authorization, 404-instead-of-403 | Outsiders cannot see rooms |
| 7 | Focus sessions: start, pause, resume, heartbeat, finish | Server-side time, constraints, idempotency | Time counts correctly, one active session |
| 8 | Room status and "today" totals | Aggregation, timezones | Status matches the timer |
| 9 | Tests, rate limiting, CORS | pytest, a safe test database, limits | `23 passed` |
| 10 | Frontend, then deploy | React, API client, PWA, hosting | App installed and working on a phone |

Frontend build order (each step is a working app):
1. Vite + React + TypeScript scaffold, design tokens, routes.
2. API client, login and register, protected routes.
3. Rooms list, create, join, copy invite code.
4. Room screen with live status polling.
5. Timer controls, heartbeat, auto-pause.
6. Dock mode.
7. PWA manifest, icons, service worker.
8. README, then deploy.

**Habits that make this go well**
- Build one small thing, run it, and only then continue.
- When something fails, read the *whole* error and the first line that names your
  own file. Most errors are a typo, a missing file or a wrong folder.
- Commit after every working step: `git add`, `git commit`, `git push`.
- Always check `git status` before committing and make sure no `.env` appears.

---

## 15. Troubleshooting

| Symptom | Likely cause and fix |
|---|---|
| `os error 4551` / blocked `.exe` | Windows Application Control. Use `uv run python -m ...` and `npm.cmd`. |
| `ModuleNotFoundError: psycopg2` | `DATABASE_URL` must start with `postgresql+psycopg://`. Restart the server after editing `.env`. |
| `uv` says no `pyproject.toml` | You are in the wrong folder. Run backend commands from `backend/`. |
| `/health` gives 404 | The path is `/api/v1/health`, with the prefix. |
| Browser shows a CORS error | Frontend must run on exactly `http://localhost:5173`, or `CORS_ORIGINS` must list the real frontend URL. Restart the backend after changing it. |
| Frontend: "Can't reach the server" | The backend is not running, or `VITE_API_URL` is wrong. Restart `npm run dev` after editing `.env`. |
| Vite: `Failed to resolve import "./pages/X"` | The file name is different (`RoomPage` vs `RoomsPage`). Names are case- and letter-exact. |
| Tests: `KeyError: 'TEST_DATABASE_URL'` | You ran pytest outside `backend/`, or the variable is missing from `.env`. |
| Manifest: "Icon failed to load" | The four icons are not in `frontend/public/` with the exact names. Rebuild after adding them. |
| 429 Too Many Requests | The rate limiter working as intended. Wait a minute. |
| Timer stopped by itself | Switching tab or app pauses it by design; or the heartbeat was lost for more than 90 seconds. |

---

## 16. Implemented vs planned

**Implemented**
- Authentication (Argon2, 30 minute JWT)
- Rooms, invite codes, membership and roles
- Server-timed focus sessions with heartbeat and auto-expiry
- Live room status with today's totals
- Rate limiting, CORS, authorization on every protected endpoint
- 23 automated backend tests
- Frontend: login and register, rooms, room screen, timer, dock mode
- PWA manifest, icons and service worker (app shell only)
- Production configuration checks (Checkpoint 10.1)

**In progress**
- Deployment to Render and Vercel (Checkpoint 10)

**Planned (not built)**
- v2: daily and weekly stats, GitHub-style focus grid
- v3: XP, streaks, leaderboards
- Timezones other than India

---

## 17. Known limitations

- **Recorded time is not verified productivity.** No app can know that.
- **Token in `localStorage`:** a reload keeps you signed in, but any cross-site
  scripting bug could read it. The token lives only 30 minutes and there is no
  refresh token, so you log in again after it expires.
- **Polling, not WebSockets:** changes in a room appear within about 5 seconds.
- **Rate-limit counters are kept in memory:** they reset when the server restarts,
  and they are per server instance.
- **No offline mode:** only the app shell is cached.
- **Wake Lock, Fullscreen and orientation lock** depend on the browser.
- **If the browser is killed outright,** the server's 90 second heartbeat grace
  stops the clock instead of the app pausing it.
- **Free hosting:** sleeping services and monthly usage limits (see section 13).
- **No frontend automated tests** yet.
