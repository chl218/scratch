"""Thin wrapper around instaloader for downloading a user's posts."""

from __future__ import annotations

import getpass
import os
from itertools import islice
from pathlib import Path
from typing import Callable

import instaloader
from instaloader.instaloader import get_default_session_filename
from instaloader.exceptions import (
    LoginException,
    PrivateProfileNotFollowedException,
    TwoFactorAuthRequiredException,
)

from .security import (
    is_instagram_domain,
    normalize_sessionid,
    scoped_cookie_jar,
    strip_control,
)


def build_loader(
    output_dir: Path, videos: bool = False, metadata: bool = True, quiet: bool = False
) -> instaloader.Instaloader:
    """Create an Instaloader that saves posts to output_dir/<username>/.

    With videos=False (the default) only photos are saved: video posts are skipped by
    download_user, and video slides inside carousels are skipped here.
    """
    loader = instaloader.Instaloader(
        dirname_pattern=str(Path(output_dir) / "{target}"),
        filename_pattern="{target}_{date_utc:%Y-%m-%d_%H-%M-%S}_{shortcode}",
        download_videos=videos,
        download_video_thumbnails=videos,
        download_geotags=False,
        download_comments=False,
        save_metadata=metadata,
        compress_json=False,
        post_metadata_txt_pattern="{caption}" if metadata else "",
        quiet=quiet,
    )
    _install_safe_logging(loader.context)
    return loader


def _install_safe_logging(context: instaloader.InstaloaderContext) -> None:
    """Strip terminal control characters from instaloader's output (it prints captions)."""
    raw_log, raw_error = context.log, context.error

    def log(*msg, sep="", end="\n", flush=False):
        raw_log(*(strip_control(str(m)) for m in msg), sep=sep, end=end, flush=flush)

    def error(msg, repeat_at_end=True):
        raw_error(strip_control(str(msg)), repeat_at_end=repeat_at_end)

    context.log = log
    context.error = error


def scope_session_cookies(loader: instaloader.Instaloader) -> None:
    """Restrict the session's cookies to *.instagram.com over HTTPS.

    instaloader loads sessions with domain-less cookies, which requests would
    send to any host, including over plain HTTP.
    """
    session = loader.context._session  # no public accessor
    session.cookies = scoped_cookie_jar(session.cookies.get_dict())


def _interactive_login(loader: instaloader.Instaloader, ig_user: str) -> None:
    password = getpass.getpass(f"Instagram password for {ig_user}: ")
    try:
        loader.login(ig_user, password)
    except TwoFactorAuthRequiredException:
        code = input("Two-factor code: ").strip()
        loader.two_factor_login(code)


def login(loader: instaloader.Instaloader, ig_user: str) -> None:
    """Log in, reusing a saved session when one exists and is still valid."""
    session_file = get_default_session_filename(ig_user)
    try:
        loader.load_session_from_file(ig_user)
        scope_session_cookies(loader)
    except FileNotFoundError:
        _interactive_login(loader, ig_user)
    else:
        if loader.test_login() is None:
            print("Saved session expired, logging in again.")
            try:
                os.remove(session_file)
            except OSError:
                pass
            _interactive_login(loader, ig_user)
        else:
            return
    loader.save_session_to_file()
    scope_session_cookies(loader)


def read_browser_cookies(browser: str, cookie_file: str | None = None) -> dict[str, str]:
    """Read instagram.com cookies from a local browser profile."""
    try:
        import browser_cookie3
    except ImportError as e:  # pragma: no cover
        raise LoginException("browser_cookie3 is not installed (pip install browser_cookie3)") from e

    reader = getattr(browser_cookie3, browser)
    try:
        jar = reader(cookie_file=cookie_file, domain_name="instagram.com")
    except Exception as e:  # locked DB, decryption failure, profile not found, ...
        raise LoginException(
            f"could not read {browser} cookies ({e}). Close the browser and retry, "
            "or use --sessionid instead (see README)."
        ) from e
    return {c.name: c.value for c in jar if is_instagram_domain(c.domain)}


def login_with_cookies(loader: instaloader.Instaloader, cookies: dict[str, str]) -> str:
    """Use an existing browser session. Nothing is written to disk. Returns the username."""
    if not cookies.get("sessionid"):
        raise LoginException(
            "no Instagram session found. Log in at https://www.instagram.com in that browser first."
        )
    cookies = {**cookies, "csrftoken": cookies.get("csrftoken", "")}
    loader.load_session("", cookies)
    scope_session_cookies(loader)
    username = loader.test_login()
    if not username:
        loader.context.username = None
        raise LoginException("the session cookie is invalid or expired. Log in again in your browser.")
    loader.context.username = username
    return username


def login_with_sessionid(loader: instaloader.Instaloader, raw: str) -> str:
    """Log in with a pasted sessionid cookie value. Returns the username."""
    sessionid = normalize_sessionid(raw)
    if sessionid is None:
        raise LoginException(
            "that doesn't look like a sessionid value. Copy only the Value cell (see README)."
        )
    return login_with_cookies(loader, {"sessionid": sessionid})


# Instagram lets a profile pin up to 3 posts, which it always lists first.
MAX_PINNED = 3


def download_user(
    loader: instaloader.Instaloader,
    username: str,
    limit: int | None = None,
    log: Callable[[str], None] = print,
) -> int:
    """Download a user's posts, newest first. Returns how many were saved.

    Video posts are skipped unless the loader was built with videos=True, and
    --limit counts only the posts that are kept. Pinned posts are downloaded like
    any other, but --limit picks the newest posts by date, so old pinned posts
    don't take up slots.
    """
    profile = instaloader.Profile.from_username(loader.context, username)

    if profile.is_private and not profile.followed_by_viewer:
        raise PrivateProfileNotFollowedException(
            f"Profile {profile.username} is private and you don't follow it."
        )

    include_videos = loader.download_videos
    known = profile.mediacount  # can be None when not logged in
    if limit is not None:
        total = str(limit) if known is None else str(min(limit, known))
    elif include_videos and known is not None:
        total = str(known)
    else:
        total = "?"  # unknown until we've seen which posts are videos
    kind = "post(s)" if include_videos else "image post(s)"
    log(f"Downloading {total} {kind} from @{profile.username}")

    posts = profile.get_posts()
    if not include_videos:
        posts = (p for p in posts if not p.is_video)
    if limit is not None:
        # Up to MAX_PINNED pinned posts come first regardless of date. Read that many
        # extra posts, then keep the newest `limit` by date.
        candidates = list(islice(posts, limit + MAX_PINNED))
        posts = sorted(candidates, key=lambda p: p.date_utc, reverse=True)[:limit]

    count = 0
    for post in posts:
        count += 1
        log(f"[{count}/{total}] {post.date_utc:%Y-%m-%d} {post.shortcode}")
        loader.download_post(post, target=profile.username)
    return count
