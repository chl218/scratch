"""Small helpers for handling secrets and untrusted text safely.

Everything here is a pure function with no network or file access, so it is easy
to test (see tests/test_security.py). Used by cli.py and downloader.py.
"""

from __future__ import annotations

import re

from requests.cookies import RequestsCookieJar

IG_DOMAIN = "instagram.com"
# Leading dot = "this domain and all its subdomains" (www., i., ...).
COOKIE_DOMAIN = "." + IG_DOMAIN

# Instagram usernames: letters, digits, "." and "_", up to 30 chars.
# Anything else (slashes, "..") is rejected, which also rules out path tricks
# like "../evil" when the name is used as a folder.
_USERNAME_RE = re.compile(r"[A-Za-z0-9._]{1,30}")
# sessionid looks like "1234567890%3AAbCd...%3A12%3AAY..." (sometimes URL-decoded).
# The allowed characters exclude ";", spaces and line breaks, which could otherwise
# inject extra cookies or HTTP headers.
_SESSIONID_RE = re.compile(r"[A-Za-z0-9%:_\-]{20,1024}")
# C0/C1 control chars except tab (\x09) and newline (\x0a). Covers ESC (\x1b), which
# starts ANSI escape sequences, and BEL (\x07). Stops escape injection from captions.
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b-\x1f\x7f-\x9f]")


def is_valid_username(name: str) -> bool:
    """True if name could be an Instagram username."""
    return bool(_USERNAME_RE.fullmatch(name))


def is_instagram_domain(domain: str) -> bool:
    """Exact match for instagram.com or a subdomain; rejects look-alikes like notinstagram.com.

    A plain `"instagram.com" in domain` check would also accept notinstagram.com and
    instagram.com.evil.io.
    """
    host = domain.lstrip(".").lower()
    return host == IG_DOMAIN or host.endswith(COOKIE_DOMAIN)


def normalize_sessionid(raw: str) -> str | None:
    """Clean up a pasted sessionid. Returns None if it doesn't look like one.

    Forgives common copy-paste extras: surrounding spaces/newlines, quotes, and a
    leading "sessionid=" (from copying the whole cookie instead of just its value).
    """
    value = raw.strip().strip("\"'")
    if value.lower().startswith("sessionid="):
        value = value.split("=", 1)[1]
    if not _SESSIONID_RE.fullmatch(value):
        return None
    return value


def scoped_cookie_jar(values: dict[str, str]) -> RequestsCookieJar:
    """Cookies that are only sent to *.instagram.com over HTTPS.

    requests only attaches a cookie to a request when the URL's host matches the
    cookie's domain, and secure=True keeps it off plain-HTTP requests.
    """
    jar = RequestsCookieJar()
    for name, value in values.items():
        jar.set(name, value, domain=COOKIE_DOMAIN, path="/", secure=True)
    return jar


def strip_control(text: str) -> str:
    """Remove control characters (see _CONTROL_RE) so text is safe to print."""
    return _CONTROL_RE.sub("", text)
