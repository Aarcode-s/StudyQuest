from starlette.requests import Request

from app.core.config import settings
from app.core.rate_limit import client_ip


def make_request(xff: str | None = None, host: str = "10.0.0.1") -> Request:
    headers = [] if xff is None else [(b"x-forwarded-for", xff.encode())]
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "query_string": b"",
        "headers": headers,
        "client": (host, 1234),
    }
    return Request(scope)


def test_header_ignored_when_proxy_not_trusted(monkeypatch):
    monkeypatch.setattr(settings, "trust_proxy_headers", False)
    assert client_ip(make_request("1.1.1.1, 2.2.2.2")) == "10.0.0.1"


def test_one_hop_uses_rightmost_entry(monkeypatch):
    monkeypatch.setattr(settings, "trust_proxy_headers", True)
    monkeypatch.setattr(settings, "trusted_proxy_hops", 1)
    # A client forging "9.9.9.9" cannot influence the rightmost entry.
    assert client_ip(make_request("9.9.9.9, 2.2.2.2")) == "2.2.2.2"


def test_two_hops_skips_the_last_proxy(monkeypatch):
    monkeypatch.setattr(settings, "trust_proxy_headers", True)
    monkeypatch.setattr(settings, "trusted_proxy_hops", 2)
    assert client_ip(make_request("9.9.9.9, 2.2.2.2, 3.3.3.3")) == "2.2.2.2"


def test_missing_header_falls_back_to_socket(monkeypatch):
    monkeypatch.setattr(settings, "trust_proxy_headers", True)
    assert client_ip(make_request(None)) == "10.0.0.1"


def test_header_shorter_than_hops_falls_back_to_socket(monkeypatch):
    monkeypatch.setattr(settings, "trust_proxy_headers", True)
    monkeypatch.setattr(settings, "trusted_proxy_hops", 2)
    assert client_ip(make_request("2.2.2.2")) == "10.0.0.1"