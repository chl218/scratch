from pathlib import Path

import pytest

from igdl import cli, downloader


def test_defaults():
    args = cli.parse_args(["someuser"])
    assert args.username == "someuser"
    assert args.output == Path("downloads")
    assert args.login is None
    assert args.limit is None
    assert not args.videos and not args.no_metadata and not args.quiet


def test_strips_at_sign():
    assert cli.parse_args(["@someuser"]).username == "someuser"


def test_all_flags():
    args = cli.parse_args(
        ["u", "-o", "out", "--login", "me", "--limit", "5", "--videos", "--no-metadata", "-q"]
    )
    assert args.output == Path("out")
    assert args.login == "me"
    assert args.limit == 5
    assert args.videos and args.no_metadata and args.quiet


@pytest.mark.parametrize("bad", ["0", "-3", "abc"])
def test_limit_must_be_positive(bad):
    with pytest.raises(SystemExit):
        cli.parse_args(["u", "--limit", bad])


def test_build_loader_paths(tmp_path):
    loader = downloader.build_loader(tmp_path, metadata=False)
    assert loader.dirname_pattern == str(tmp_path / "{target}")
    assert loader.download_videos is False
    assert loader.download_video_thumbnails is False  # carousel video slides skipped
    assert loader.filename_pattern.startswith("{target}_")  # username prefix
    assert downloader.build_loader(tmp_path, videos=True).download_videos is True
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


def test_limit_skips_old_pinned_posts(tmp_path, monkeypatch):
    from datetime import datetime
    from types import SimpleNamespace

    def post(code, day, is_video=False):
        return SimpleNamespace(shortcode=code, date_utc=datetime(2026, 1, day), is_video=is_video)

    # Feed order: 2 old pinned posts, then the rest newest-first.
    feed = [post("pin_old1", 1), post("pin_old2", 2)] + [post(f"p{d}", d) for d in range(20, 10, -1)]
    profile = SimpleNamespace(
        username="u", is_private=False, followed_by_viewer=False, mediacount=len(feed),
        get_posts=lambda: iter(feed),
    )
    monkeypatch.setattr(downloader.instaloader.Profile, "from_username", lambda ctx, name: profile)
    loader = downloader.build_loader(tmp_path, quiet=True)
    saved = []
    monkeypatch.setattr(loader, "download_post", lambda p, target: saved.append(p.shortcode))

    assert downloader.download_user(loader, "u", limit=3, log=lambda m: None) == 3
    assert saved == ["p20", "p19", "p18"]


def _fake_feed(monkeypatch, tmp_path, feed, videos):
    from types import SimpleNamespace

    profile = SimpleNamespace(
        username="u", is_private=False, followed_by_viewer=False, mediacount=len(feed),
        get_posts=lambda: iter(feed),
    )
    monkeypatch.setattr(downloader.instaloader.Profile, "from_username", lambda ctx, name: profile)
    loader = downloader.build_loader(tmp_path, videos=videos, quiet=True)
    saved = []
    monkeypatch.setattr(loader, "download_post", lambda p, target: saved.append(p.shortcode))
    return loader, saved


def _posts():
    from datetime import datetime
    from types import SimpleNamespace

    return [
        SimpleNamespace(shortcode=f"{'v' if d % 2 else 'i'}{d}", date_utc=datetime(2026, 1, d),
                        is_video=bool(d % 2))
        for d in range(20, 10, -1)
    ]


def test_images_only_by_default_and_limit_counts_images(tmp_path, monkeypatch):
    loader, saved = _fake_feed(monkeypatch, tmp_path, _posts(), videos=False)
    assert downloader.download_user(loader, "u", limit=3, log=lambda m: None) == 3
    assert saved == ["i20", "i18", "i16"]


def test_videos_flag_includes_video_posts(tmp_path, monkeypatch):
    loader, saved = _fake_feed(monkeypatch, tmp_path, _posts(), videos=True)
    assert downloader.download_user(loader, "u", limit=3, log=lambda m: None) == 3
    assert saved == ["i20", "v19", "i18"]



def test_limit_includes_pinned_post_when_recent_enough(tmp_path, monkeypatch):
    from datetime import datetime
    from types import SimpleNamespace

    def post(code, day, is_video=False):
        return SimpleNamespace(shortcode=code, date_utc=datetime(2026, 1, day), is_video=is_video)

    # Three pinned posts: two old, one newer than some regular posts.
    feed = [post("pin_old", 1), post("pin_new", 18), post("pin_old2", 2)] + [
        post(f"p{d}", d) for d in (20, 19, 17, 16, 15)
    ]
    loader, saved = _fake_feed(monkeypatch, tmp_path, feed, videos=False)
    assert downloader.download_user(loader, "u", limit=4, log=lambda m: None) == 4
    assert saved == ["p20", "p19", "pin_new", "p17"]


def test_no_limit_downloads_pinned_posts_too(tmp_path, monkeypatch):
    from datetime import datetime
    from types import SimpleNamespace

    feed = [SimpleNamespace(shortcode=c, date_utc=datetime(2026, 1, d), is_video=False)
            for c, d in (("pin", 1), ("p3", 3), ("p2", 2))]
    loader, saved = _fake_feed(monkeypatch, tmp_path, feed, videos=False)
    assert downloader.download_user(loader, "u", log=lambda m: None) == 3
    assert sorted(saved) == ["p2", "p3", "pin"]
