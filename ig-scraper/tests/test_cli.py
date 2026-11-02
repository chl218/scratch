from pathlib import Path

import pytest

from igdl import cli, downloader


def test_defaults():
    args = cli.parse_args(["someuser"])
    assert args.username == "someuser"
    assert args.output == Path("downloads")
    assert args.login is None
    assert args.limit is None
    assert not args.no_videos and not args.no_metadata and not args.quiet


def test_strips_at_sign():
    assert cli.parse_args(["@someuser"]).username == "someuser"


def test_all_flags():
    args = cli.parse_args(
        ["u", "-o", "out", "--login", "me", "--limit", "5", "--no-videos", "--no-metadata", "-q"]
    )
    assert args.output == Path("out")
    assert args.login == "me"
    assert args.limit == 5
    assert args.no_videos and args.no_metadata and args.quiet


@pytest.mark.parametrize("bad", ["0", "-3", "abc"])
def test_limit_must_be_positive(bad):
    with pytest.raises(SystemExit):
        cli.parse_args(["u", "--limit", bad])


def test_build_loader_paths(tmp_path):
    loader = downloader.build_loader(tmp_path, videos=False, metadata=False)
    assert loader.dirname_pattern == str(tmp_path / "{target}")
    assert loader.download_videos is False
    assert loader.save_metadata is False
    assert loader.post_metadata_txt_pattern == ""


def test_cookies_flag():
    args = cli.parse_args(["u", "--cookies", "Firefox"])
    assert args.cookies == "firefox"


def test_unknown_browser_rejected():
    with pytest.raises(SystemExit):
        cli.parse_args(["u", "--cookies", "netscape"])


def test_login_methods_are_exclusive():
    with pytest.raises(SystemExit):
        cli.parse_args(["u", "--cookies", "firefox", "--login", "me"])
    with pytest.raises(SystemExit):
        cli.parse_args(["u", "--sessionid", "--login", "me"])


def test_cookie_file_needs_cookies():
    with pytest.raises(SystemExit):
        cli.parse_args(["u", "--cookie-file", "x.sqlite"])


def test_login_with_cookies_requires_sessionid(tmp_path):
    from instaloader.exceptions import LoginException

    loader = downloader.build_loader(tmp_path)
    with pytest.raises(LoginException):
        downloader.login_with_cookies(loader, {"csrftoken": "abc"})


def test_main_rejects_bad_sessionid(tmp_path, monkeypatch):
    monkeypatch.setenv(cli.SESSIONID_ENV, "not-a-real-session")
    monkeypatch.setattr(downloader.instaloader.Instaloader, "test_login", lambda self: None)
    assert cli.main(["u", "--sessionid", "-o", str(tmp_path), "-q"]) == cli.EXIT_LOGIN
