from pathlib import Path

import pytest

from igdl import cli, downloader


def test_defaults():
    args = cli.parse_args(["someuser"])
    assert args.username == "someuser"
    assert args.output == Path("downloads")
    assert args.limit is None
    # Only images by default: no videos, no caption, no metadata.
    assert not args.videos and not args.caption and not args.metadata and not args.quiet


def test_strips_at_sign():
    assert cli.parse_args(["@someuser"]).username == "someuser"


def test_all_flags():
    args = cli.parse_args(
        ["u", "-o", "out", "--limit", "5", "--videos", "--caption", "--metadata", "-q"]
    )
    assert args.output == Path("out")
    assert args.limit == 5
    assert args.videos and args.caption and args.metadata and args.quiet


@pytest.mark.parametrize("removed", [["--login", "me"], ["--cookies", "firefox"], ["--sessionid"],
                                     ["--no-metadata"]])
def test_removed_options_are_rejected(removed):
    with pytest.raises(SystemExit):
        cli.parse_args(["u", *removed])


@pytest.mark.parametrize("bad", ["0", "-3", "abc"])
def test_limit_must_be_positive(bad):
    with pytest.raises(SystemExit):
        cli.parse_args(["u", "--limit", bad])


def test_build_loader_paths(tmp_path):
    loader = downloader.build_loader(tmp_path)  # defaults: images only, no extras
    assert loader.dirname_pattern == str(tmp_path / "{target}")
    assert loader.download_videos is False
    assert loader.download_video_thumbnails is False  # carousel video slides skipped
    assert loader.filename_pattern.startswith("{target}_")  # username prefix
    assert downloader.build_loader(tmp_path, videos=True).download_videos is True
    assert loader.save_metadata is False
    assert loader.post_metadata_txt_pattern == ""
    both = downloader.build_loader(tmp_path, caption=True, metadata=True)
    assert both.post_metadata_txt_pattern == "{caption}" and both.save_metadata is True
    only_caption = downloader.build_loader(tmp_path, caption=True)
    assert only_caption.post_metadata_txt_pattern == "{caption}" and only_caption.save_metadata is False








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


def test_should_stop_ends_run_before_next_post(tmp_path, monkeypatch):
    loader, saved = _fake_feed(monkeypatch, tmp_path, _posts(), videos=True)
    downloader_calls = iter([False, False, True])  # stop before the 3rd post
    count = downloader.download_user(
        loader, "u", log=lambda m: None, should_stop=lambda: next(downloader_calls)
    )
    assert count == 2 and saved == ["i20", "v19"]


@pytest.mark.parametrize("exc,code", [
    ("ProfileNotExistsException", cli.EXIT_NOT_FOUND),
    ("PrivateProfileNotFollowedException", cli.EXIT_PRIVATE),
    ("LoginRequiredException", cli.EXIT_PRIVATE),
    ("TooManyRequestsException", cli.EXIT_RATE_LIMIT),  # subclass of ConnectionException
    ("ConnectionException", cli.EXIT_RATE_LIMIT),
])
def test_describe_error_maps_instaloader_errors(exc, code):
    from instaloader import exceptions

    result = cli.describe_error(getattr(exceptions, exc)("boom"), "someone")
    assert result is not None and result[0] == code and result[1]


def test_describe_error_ignores_unexpected_errors():
    assert cli.describe_error(ValueError("bug"), "someone") is None



def test_format_pause():
    from datetime import datetime

    now = datetime(2026, 11, 2, 14, 0)
    assert downloader.format_pause(42, now) == (
        "Instagram rate limit: pausing 42 s (until 14:00). The download continues on its own."
    )
    assert "pausing 11 min (until 14:11)" in downloader.format_pause(666, now)


def _rate_controller(tmp_path, monkeypatch, **hooks):
    import instaloader.instaloadercontext as ctx_mod

    slept = []
    monkeypatch.setattr(ctx_mod.time, "sleep", slept.append)  # shared time module
    loader = downloader.build_loader(tmp_path, quiet=True, **hooks)
    return loader.context._rate_controller, slept


def test_rate_limit_pause_is_announced_even_when_quiet(tmp_path, monkeypatch):
    notices = []
    rc, slept = _rate_controller(tmp_path, monkeypatch, on_pause=notices.append)
    rc.sleep(5)       # short pause: not announced
    rc.sleep(300)     # long pause: announced
    assert notices == [300]
    assert slept == [5, 300]


def test_stop_ends_rate_limit_pause(tmp_path, monkeypatch):
    rc, slept = _rate_controller(tmp_path, monkeypatch, should_stop=lambda: True)
    with pytest.raises(downloader.DownloadStopped):
        rc.sleep(600)
    assert slept == []  # didn't wait out the 10 minutes


def test_default_loader_keeps_instaloaders_rate_controller(tmp_path):
    import instaloader

    rc = downloader.build_loader(tmp_path).context._rate_controller
    assert type(rc) is instaloader.RateController


def test_stop_during_pause_inside_download_returns_count(tmp_path, monkeypatch):
    loader, saved = _fake_feed(monkeypatch, tmp_path, _posts(), videos=True)

    def download_post(post, target):
        saved.append(post.shortcode)
        if len(saved) == 2:
            raise downloader.DownloadStopped()  # as if Stop hit during a pause

    monkeypatch.setattr(loader, "download_post", download_post)
    logs = []
    assert downloader.download_user(loader, "u", log=logs.append) == 2
    assert logs[-1] == "Stopped."


def test_quiet_cli_prints_pause_notice(tmp_path, monkeypatch, capsys):
    captured = {}
    real_build = downloader.build_loader

    def spy_build(*a, **kw):
        captured["on_pause"] = kw.get("on_pause")
        return real_build(*a, **kw)

    monkeypatch.setattr(downloader, "build_loader", spy_build)
    monkeypatch.setattr(downloader, "download_user", lambda *a, **k: 0)
    assert cli.main(["u", "-q", "-o", str(tmp_path)]) == cli.EXIT_OK
    captured["on_pause"](120)
    assert "Instagram rate limit: pausing 2 min" in capsys.readouterr().err


def test_unprintable_characters_dont_crash_output(tmp_path, monkeypatch):
    import io
    import sys

    # A console that can only show Western European text, like Windows' cp1252.
    console = io.TextIOWrapper(io.BytesIO(), encoding="cp1252")
    monkeypatch.setattr(sys, "stdout", console)
    monkeypatch.setattr(downloader, "download_user", lambda loader, u, limit, log: log("tags: #필름스냅") or 1)
    assert cli.main(["u", "-o", str(tmp_path)]) == cli.EXIT_OK
    console.flush()
    assert b"tags: #????" in console.buffer.getvalue()
