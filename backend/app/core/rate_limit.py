from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.core.config import settings


def client_ip(request: Request) -> str:
    """The address used as the rate-limit key.

    Behind a trusted proxy the real visitor is the Nth entry from the RIGHT of
    X-Forwarded-For (N = TRUSTED_PROXY_HOPS). Entries further left can be forged
    by the client, so they are never used. If the header is missing or shorter
    than expected, fall back to the socket address.
    """
    if settings.trust_proxy_headers:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            parts = [p.strip() for p in forwarded.split(",") if p.strip()]
            hops = max(1, settings.trusted_proxy_hops)
            if len(parts) >= hops:
                return parts[-hops]
    return get_remote_address(request)


limiter = Limiter(key_func=client_ip, enabled=settings.rate_limit_enabled)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"detail": "Too many requests. Please wait and try again."},
        headers={"Retry-After": "60"},
    )