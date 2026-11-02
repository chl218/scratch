"""Thin wrapper around instaloader for downloading a user's posts.

This module does three things:
  - build_loader(): configure instaloader for our folder and file naming, images-only
    default, and sanitized console output.
  - Login: three ways to get a logged-in session (browser cookies, a pasted sessionid,
    or a password). Every path ends with the cookies scoped to *.instagram.com.
  - download_user(): list a profile's posts, filter and limit them, and save each one.

instaloader does the Instagram API calls, paging, retries and file writing.
"""

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


# --------------------------------------------------------------------------------------
# Setup
# --------------------------------------------------------------------------------------

def build_loader(
    output_dir: Path, videos: bool = False, metadata: bool = True, quiet: bool = False
) -> instaloader.Instaloader:
    """Create an Instaloader that saves posts to output_dir/<username>/.

    With videos=False (the default) only photos are saved: video posts are skipped by
    download_user, and video slides inside carousels are skipped here.
    """
    loader = instaloader.Instaloader(
        # instaloader fills {target} with the username passed to download_post().
        dirname_pattern=str(Path(output_dir) / "{target}"),
        # e.g. natgeo_2026-11-01_23-53-04_DfN9Oosk9s2. Carousel items get _1, _2, ...
        filename_pattern="{target}_{date_utc:%Y-%m-%d_%H-%M-%S}_{shortcode}",
        # Turning off both video files and video thumbnails makes instaloader skip
        # video slides in carousels entirely, instead of saving their cover image.
        download_videos=videos,
        download_video_thumbnails=videos,
        download_geotags=False,   # would need an extra request per post
        download_comments=False,  # would need many extra requests per post
        save_metadata=metadata,   # <name>.json with the post's full data
        compress_json=False,      # plain .json, not .json.xz
        # <name>.txt with the caption; an empty pattern disables the file.
        post_metadata_txt_pattern="{caption}" if metadata else "",
        quiet=quiet,
    )
    _install_safe_logging(loader.context)
    return loader


def _install_safe_logging(context: instaloader.InstaloaderContext) -> None:
    """Strip terminal control characters from instaloader's output.

    instaloader prints the start of each caption while it downloads. A caption is
    written by the post's author and could hide ANSI escape codes that change the
    terminal (title, colors, clearing the screen). We wrap its two print functions.
    """
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
    send to any host, including over plain HTTP. Called after every login path.
    """
    session = loader.context._session  # no public accessor
    session.cookies = scoped_cookie_jar(session.cookies.get_dict())


# --------------------------------------------------------------------------------------
# Login, option 3: password (--login). Saves a session file for later runs.
# --------------------------------------------------------------------------------------

def _ask_password_in_terminal(ig_user: str) -> str:
    return getpass.getpass(f"Instagram password for {ig_user}: ")


def _ask_2fa_in_terminal() -> str:
    return input("Two-factor code: ")


def _interactive_login(
    loader: instaloader.Instaloader,
    ig_user: str,
    ask_password: Callable[[str], str],
    ask_2fa: Callable[[], str],
) -> None:
    """Ask for the password and, if Instagram wants it, a 2FA code.

    The ask_* functions are terminal prompts by default; the GUI passes dialogs.
    """
    password = ask_password(ig_user)
    try:
        loader.login(ig_user, password)
    except TwoFactorAuthRequiredException:
        code = ask_2fa().strip()
        loader.two_factor_login(code)


def login(
    loader: instaloader.Instaloader,
    ig_user: str,
    ask_password: Callable[[str], str] = _ask_password_in_terminal,
    ask_2fa: Callable[[], str] = _ask_2fa_in_terminal,
    log: Callable[[str], None] = print,
) -> None:
    """Log in, reusing a saved session when one exists and is still valid.

    1. Session file exists and still works -> use it, no prompt.
    2. Session file exists but expired      -> delete it, prompt, save a new one.
    3. No session file                      -> prompt, save a new one.

    The file lives in instaloader's config folder (%LOCALAPPDATA%\\Instaloader on
    Windows), not in this repo. It is not encrypted.
    """
    session_file = get_default_session_filename(ig_user)
    try:
        loader.load_session_from_file(ig_user)
        scope_session_cookies(loader)
    except FileNotFoundError:
        _interactive_login(loader, ig_user, ask_password, ask_2fa)  # case 3
    else:
        # test_login() asks Instagram who we are; None means the session is dead.
        if loader.test_login() is None:      # case 2
            log("Saved session expired, logging in again.")
            try:
                os.remove(session_file)
            except OSError:
                pass
            _interactive_login(loader, ig_user, ask_password, ask_2fa)
        else:                                 # case 1
            return
    # Cases 2 and 3 only: we have a fresh login, so save it for next time.
    loader.save_session_to_file()
    scope_session_cookies(loader)


# --------------------------------------------------------------------------------------
# Login, options 1 and 2: reuse an existing browser session. Nothing is saved to disk.
# --------------------------------------------------------------------------------------

def read_browser_cookies(browser: str, cookie_file: str | None = None) -> dict[str, str]:
    """Read instagram.com cookies from a local browser profile (--cookies).

    browser_cookie3 opens the browser's cookie database (and decrypts it on
    Chromium browsers). Any failure becomes a LoginException with a hint.
    """
    try:
        import browser_cookie3  # imported here so other login paths don't need it
    except ImportError as e:  # pragma: no cover
        raise LoginException("browser_cookie3 is not installed (pip install browser_cookie3)") from e

    reader = getattr(browser_cookie3, browser)  # e.g. browser_cookie3.firefox
    try:
        # domain_name narrows the query, but it's a substring match ...
        jar = reader(cookie_file=cookie_file, domain_name="instagram.com")
    except Exception as e:  # locked DB, decryption failure, profile not found, ...
        raise LoginException(
            f"could not read {browser} cookies ({e}). Close the browser and retry, "
            "or use --sessionid instead (see README)."
        ) from e
    # ... so filter again with an exact check. Otherwise a cookie from a look-alike
    # site such as notinstagram.com could replace the real sessionid.
    return {c.name: c.value for c in jar if is_instagram_domain(c.domain)}


def login_with_cookies(loader: instaloader.Instaloader, cookies: dict[str, str]) -> str:
    """Use an existing browser session. Nothing is written to disk. Returns the username.

    The sessionid cookie is what proves the login; the others are optional extras.
    """
    if not cookies.get("sessionid"):
        raise LoginException(
            "no Instagram session found. Log in at https://www.instagram.com in that browser first."
        )
    # instaloader's load_session() expects a csrftoken key, even if it's empty.
    cookies = {**cookies, "csrftoken": cookies.get("csrftoken", "")}
    loader.load_session("", cookies)  # username unknown yet; filled in below
    scope_session_cookies(loader)
    # Ask Instagram which account the cookie belongs to. This also checks it works.
    username = loader.test_login()
    if not username:
        loader.context.username = None  # don't leave the loader marked as logged in
        raise LoginException("the session cookie is invalid or expired. Log in again in your browser.")
    # instaloader treats "username is set" as "logged in".
    loader.context.username = username
    return username


def login_with_sessionid(loader: instaloader.Instaloader, raw: str) -> str:
    """Log in with a pasted sessionid cookie value (--sessionid). Returns the username.

    The value is checked first, so stray text like "; other=1" or a line break
    can't add extra cookies or headers to requests.
    """
    sessionid = normalize_sessionid(raw)
    if sessionid is None:
        raise LoginException(
            "that doesn't look like a sessionid value. Copy only the Value cell (see README)."
        )
    return login_with_cookies(loader, {"sessionid": sessionid})


# --------------------------------------------------------------------------------------
# Downloading
# --------------------------------------------------------------------------------------

# Instagram lets a profile pin up to 3 posts, which it always lists first.
MAX_PINNED = 3


def download_user(
    loader: instaloader.Instaloader,
    username: str,
    limit: int | None = None,
    log: Callable[[str], None] = print,
    should_stop: Callable[[], bool] = lambda: False,
) -> int:
    """Download a user's posts, newest first. Returns how many were saved.

    should_stop is checked before each post; returning True ends the run early
    (the GUI's Stop button uses it). The post being saved is always finished first.

    Video posts are skipped unless the loader was built with videos=True, and
    --limit counts only the posts that are kept. Pinned posts are downloaded like
    any other, but --limit picks the newest posts by date, so old pinned posts
    don't take up slots.
    """
    # One request: profile info (id, privacy, post count).
    profile = instaloader.Profile.from_username(loader.context, username)

    # Fail early with a clear message rather than an empty or partial download.
    if profile.is_private and not profile.followed_by_viewer:
        raise PrivateProfileNotFollowedException(
            f"Profile {profile.username} is private and you don't follow it."
        )

    # Work out the total for the "[i/total]" progress lines.
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

    # Build the list of posts lazily. get_posts() fetches pages of ~12 posts from
    # Instagram only as the loop below asks for them, so --limit avoids fetching more.
    posts = profile.get_posts()
    if not include_videos:
        # Images-only: drop video and reel posts before --limit counts anything.
        posts = (p for p in posts if not p.is_video)
    if limit is not None:
        # Up to MAX_PINNED pinned posts come first regardless of date. Read that many
        # extra posts, then keep the newest `limit` by date.
        candidates = list(islice(posts, limit + MAX_PINNED))
        posts = sorted(candidates, key=lambda p: p.date_utc, reverse=True)[:limit]

    count = 0
    for post in posts:
        if should_stop():
            log("Stopped.")
            break
        count += 1
        log(f"[{count}/{total}] {post.date_utc:%Y-%m-%d} {post.shortcode}")
        # Saves the media (+ .txt/.json). Files that already exist are skipped,
        # which is what makes re-running after an interruption safe.
        loader.download_post(post, target=profile.username)
    return count
