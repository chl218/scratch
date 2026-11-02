"""Small helpers for handling secrets and untrusted text safely."""

from __future__ import annotations

import re

from requests.cookies import RequestsCookieJar

IG_DOMAIN = "instagram.com"
COOKIE_DOMAIN = "." + IG_DOMAIN

# Instagram usernames: letters, digits, "." and "_", up to 30 chars.
_USERNAME_RE = re.compile(r"[A-Za-z0-9._]{1,30}")
# sessionid looks like "1234567890%3AAbCd...%3A12%3AAY..." (sometimes URL-decoded).
_SESSIONID_RE = re.compile(r"[A-Za-z0-9%:_\-]{20,1024}")
# C0/C1 control chars except tab and newline. Stops ANSI escape injection from captions.
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b-\x1f\x7f-\x9f]")


def is_valid_username(name: str) -> bool:
    return bool(_USERNAME_RE.fullmatch(name))


def is_instagram_domain(domain: str) -> bool:
    """Exact match for instagram.com or a subdomain; rejects look-alikes like notinstagram.com."""
    host = domain.lstrip(".").lower()
    return host == IG_DOMAIN or host.endswith(COOKIE_DOMAIN)


def normalize_sessionid(raw: str) -> str | None:
    """Clean up a pasted sessionid. Returns None if it doesn't look like one."""
    value = raw.strip().strip("\"'")
    if value.lower().startswith("sessionid="):
        value = value.split("=", 1)[1]
    if not _SESSIONID_RE.fullmatch(value):
        return None
    return value


def scoped_cookie_jar(values: dict[str, str]) -> RequestsCookieJar:
    """Cookies that are only sent to *.instagram.com over HTTPS."""
    jar = RequestsCookieJar()
    for name, value in values.items():
        jar.set(name, value, domain=COOKIE_DOMAIN, path="/", secure=True)
    return jar


def strip_control(text: str) -> str:
    return _CONTROL_RE.sub("", text)
