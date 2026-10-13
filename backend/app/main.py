from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from slowapi.errors import RateLimitExceeded

from app.core.config import settings
from app.core.rate_limit import limiter, rate_limit_exceeded_handler
from app.routers import auth, health, rooms, sessions

DESCRIPTION = """
StudyQuest API: group study accountability with focus timers.

**Important:** all focus times are *recorded timer time*, measured by the server
from the actions a user sent (start, pause, resume, heartbeat, finish).
They are **not verified productivity**. The server cannot know what someone
was actually doing while their timer ran.

- Clients never send durations or timestamps; the server uses its own UTC clock.
- If heartbeats stop, the server stops counting after a short grace period.
- "Today" means the current day in India time (Asia/Kolkata).
- Room data is visible only to room members; non-members receive 404.
"""

app = FastAPI(title=settings.app_name, version="0.1.0", description=DESCRIPTION)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

prefix = "/api/v1"
app.include_router(health.router, prefix=prefix)
app.include_router(auth.router, prefix=prefix)
app.include_router(rooms.router, prefix=prefix)
app.include_router(sessions.router, prefix=prefix)


@app.get("/healthz", include_in_schema=False)
def healthz() -> dict[str, str]:
    """Liveness check for the hosting platform. Never touches the database,
    so frequent pings cannot keep the database awake."""
    return {"status": "ok"}