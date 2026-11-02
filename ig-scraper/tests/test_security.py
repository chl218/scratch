import io
import sys

import pytest
import requests

from igdl import downloader, security


@pytest.mark.parametrize("domain,ok", [
    ("instagram.com", True),
    (".instagram.com", True),
    ("www.instagram.com", True),
    ("i.instagram.com", True),
    ("notinstagram.com", False),
    ("instagram.com.evil.io", False),
    (".evil-instagram.com", False),
    ("", False),
])
def test_is_instagram_domain(domain, ok):
    assert security.is_instagram_domain(domain) is ok


@pytest.mark.parametrize("raw,expected", [
    ("1234567890%3AAbCdEfGhIjKl%3A12%3AAYx", "1234567890%3AAbCdEfGhIjKl%3A12%3AAYx"),
    ('  "1234567890%3AAbCdEfGhIjKl%3A12"\n', "1234567890%3AAbCdEfGhIjKl%3A12"),
    ("sessionid=1234567890%3AAbCdEfGhIjKl", "1234567890%3AAbCdEfGhIjKl"),
    ("short", None),
    ("1234567890abcdefghij; ds_user_id=1", None),  # cookie injection
    ("1234567890abcdefghij\r\nX-Evil: 1", None),   # header injection
])
def test_normalize_sessionid(raw, expected):
    assert security.normalize_sessionid(raw) == expected


@pytest.mark.parametrize("name,ok", [
    ("natgeo", True), ("a.b_c9", True), ("../etc", False),
    ("a/b", False), ("a\b", False), ("", False), ("x" * 31, False),
])
def test_is_valid_username(name, ok):
    assert security.is_valid_username(name) is ok


def _cookie_header(session, url):
    req = requests.Request("GET", url).prepare()
    return requests.cookies.get_cookie_header(session.cookies, req)


def test_cookies_only_sent_to_instagram_over_https(tmp_path, monkeypatch):
    loader = downloader.build_loader(tmp_path, quiet=True)
    monkeypatch.setattr(type(loader), "test_login", lambda self: "me")
    downloader.login_with_cookies(loader, {"sessionid": "SECRETSECRETSECRET1234"})
    session = loader.context._session

    assert "SECRETSECRET" in (_cookie_header(session, "https://www.instagram.com/") or "")
    assert "SECRETSECRET" in (_cookie_header(session, "https://i.instagram.com/api/") or "")
    assert not _cookie_header(session, "https://evil.example.com/")
    assert not _cookie_header(session, "https://notinstagram.com/")
    assert not _cookie_header(session, "http://www.instagram.com/")  # no plain HTTP


def test_read_browser_cookies_filters_lookalike_domains(monkeypatch):
    class C:
        def __init__(self, name, value, domain):
            self.name, self.value, self.domain = name, value, domain

    fake = [C("sessionid", "real", ".instagram.com"), C("sessionid", "attacker", "notinstagram.com")]
    import browser_cookie3
    monkeypatch.setattr(browser_cookie3, "firefox", lambda **kw: fake)
    assert downloader.read_browser_cookies("firefox") == {"sessionid": "real"}


def test_logging_strips_terminal_escapes(tmp_path, monkeypatch):
    out = io.StringIO()
    monkeypatch.setattr(sys, "stdout", out)
    loader = downloader.build_loader(tmp_path)
    loader.context.log("[caption \x1b]0;pwned\x07 \x1b[2J]")
    assert "\x1b" not in out.getvalue() and "\x07" not in out.getvalue()
    assert "caption" in out.getvalue()
