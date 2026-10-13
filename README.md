# StudyQuest frontend

Mobile-first installable PWA for group study accountability. Friends join
rooms with invite codes, run server-timed focus sessions, and see who is
Focusing, On break or Idle, with elapsed time and today's total.

> Recorded time is timer time. It shows when a timer ran, not what anyone
> was doing. It is not verified productivity.

React + TypeScript + Vite, React Router, vite-plugin-pwa. It talks only to the
StudyQuest API (see `../backend`). The server's UTC timestamps are the source
of truth; the client only displays them.

## Run locally

Requires Node 20+ and the backend running on http://127.0.0.1:8000.

    npm install
    cp .env.example .env      # Windows: copy .env.example .env
    npm run dev               # http://localhost:5173 (CORS allows only this origin)

`VITE_API_URL` is the only setting (default `http://127.0.0.1:8000/api/v1`).

To test the PWA build: `npm run build && npm run preview`.

## Implemented

- Register and log in (JWT, 30 minutes, no refresh token)
- Create, join and leave rooms; copy invite codes
- Live room status (polled every 5 s, paused while the tab is hidden)
- Focus timer: start, pause, resume, finish, with a 30 s heartbeat
- Timer pauses automatically when the app or tab is hidden
- Dock mode: landscape clock with Screen Wake Lock and Fullscreen
- PWA: web app manifest and service worker caching the app shell only

## Planned (not built)

- Daily and weekly stats
- XP, streaks and leaderboards
- Other timezones (currently India, Asia/Kolkata)

## Known limitations

- The access token is kept in localStorage so a reload keeps you signed in.
  Any XSS bug could read it; the token is short-lived (30 minutes).
- Room status uses polling, not WebSockets, so changes appear within ~5 s.
- The timer needs the server; there is no offline mode. Only the app shell is cached.
- Wake Lock, Fullscreen and orientation lock depend on the browser.
- Auto-pause uses the Page Visibility API. If the browser is killed outright,
  the server's heartbeat grace period (90 s) stops the clock instead.
- Installing on a phone needs HTTPS, so it works on the deployed site, not on a
  plain-HTTP local network address.