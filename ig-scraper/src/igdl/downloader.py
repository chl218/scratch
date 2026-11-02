"""Thin wrapper around instaloader for downloading a user's posts.

This module does three things:
  - build_loader(): configure instaloader for our folder and file naming, the
    images-only default, the optional caption/metadata files, and sanitized output.
  - Rate-limit pauses: report them and let the user stop during one.
  - download_user(): list a profile's posts, filter and limit them, save each one,
    and (with captions on) write the caption's hashtags into the images' Tags.

instaloader does the Instagram API calls, paging, retries and file writing.
There is no login: only public profiles can be downloaded.
"""

from __future__ import annotations

import time
from datetime import datetime, timedelta
from itertools import islice
from pathlib import Path
from typing import Callable

import instaloader
from instaloader.exceptions import PrivateProfileNotFollowedException

from .security import strip_control
from .tags import extract_hashtags, tag_post_images


# --------------------------------------------------------------------------------------
# Rate-limit pauses
# --------------------------------------------------------------------------------------

# Pauses shorter than this aren't reported. instaloader uses the same cutoff.
PAUSE_NOTICE_SECONDS = 15


class DownloadStopped(Exception):
    """Raised when the user asks to stop while instaloader is paused for the rate limit."""


def format_pause(secs: float, now: datetime | None = None) -> str:
    """Message shown when instaloader pauses because of Instagram's rate limit."""
    until = (now or datetime.now()) + timedelta(seconds=secs)
    length = f"{round(secs)} s" if secs < 90 else f"{round(secs / 60)} min"
    return (f"Instagram rate limit: pausing {length} (until {until:%H:%M}). "
            "The download continues on its own.")


class _PauseAwareRateController(instaloader.RateController):
    """instaloader's rate limiter, plus a pause notice and a way to stop mid-pause.

    instaloader calls sleep() for every rate-limit pause: both when it slows itself
    down to stay under its estimated limits and after Instagram answers 429.
    Overriding sleep() is the documented way to change that behavior.
    """

    def __init__(self, context, on_pause=None, should_stop=None):
        super().__init__(context)
        self._on_pause = on_pause
        self._should_stop = should_stop

    def sleep(self, secs: float) -> None:
        if self._on_pause and secs > PAUSE_NOTICE_SECONDS:
            self._on_pause(secs)
        if self._should_stop is None:
            super().sleep(secs)
            return
        # Sleep in short steps so a Stop request doesn't wait out the whole pause.
        deadline = time.monotonic() + secs
        while (left := deadline - time.monotonic()) > 0:
            if self._should_stop():
                raise DownloadStopped()
            time.sleep(min(left, 0.5))


# --------------------------------------------------------------------------------------
# Setup
# --------------------------------------------------------------------------------------

def build_loader(
    output_dir: Path,
    videos: bool = False,
    caption: bool = False,
    metadata: bool = False,
    quiet: bool = False,
    on_pause: Callable[[float], None] | None = None,
    should_stop: Callable[[], bool] | None = None,
) -> instaloader.Instaloader:
    """Create an Instaloader that saves posts to output_dir/<username>/.

    videos=False (default): only photos. Video posts are skipped by download_user,
        and video slides inside carousels are skipped here.
    caption=True: save <name>.txt with the caption, and download_user writes the
        caption's hashtags into each image's Tags.
    metadata=True: save <name>.json with the post's full data.

    on_pause(seconds) is called when a rate-limit pause starts (longer than
    PAUSE_NOTICE_SECONDS). It works even with quiet=True, which hides instaloader's
    own message about the pause. should_stop() is checked during pauses; if it
    returns True, the pause ends with DownloadStopped.
    """
    rate_controller = None
    if on_pause or should_stop:
        rate_controller = lambda ctx: _PauseAwareRateController(ctx, on_pause, should_stop)  # noqa: E731
    loader = instaloader.Instaloader(
        rate_controller=rate_controller,  # None = instaloader's default
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
        # download_user also reads this setting to decide whether to write Tags.
        post_metadata_txt_pattern="{caption}" if caption else "",
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
    To also stop during rate-limit pauses, pass the same function to build_loader.

    Video posts are skipped unless the loader was built with videos=True, and
    --limit counts only the posts that are kept. Pinned posts are downloaded like
    any other, but --limit picks the newest posts by date, so old pinned posts
    don't take up slots.
    """
    count = 0
    try:
        # One request: profile info (id, privacy, post count).
        profile = instaloader.Profile.from_username(loader.context, username)

        # Fail early with a clear message rather than an empty download.
        if profile.is_private:
            raise PrivateProfileNotFollowedException(
                f"Profile {profile.username} is private, so its posts can't be downloaded."
            )

        # Settings chosen in build_loader.
        include_videos = loader.download_videos
        write_tags = bool(loader.post_metadata_txt_pattern)  # caption option is on
        # build_loader set dirname_pattern to <output_dir>/{target}.
        folder = Path(loader.dirname_pattern).parent / profile.username

        # Work out the total for the "[i/total]" progress lines.
        known = profile.mediacount
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

        for post in posts:
            if should_stop():
                raise DownloadStopped()
            count += 1
            log(f"[{count}/{total}] {post.date_utc:%Y-%m-%d} {post.shortcode}")
            # Saves the media (+ .txt/.json). Files that already exist are skipped,
            # which is what makes re-running after an interruption safe.
            loader.download_post(post, target=profile.username)

            if write_tags:
                # "#portrait" in the caption -> "#portrait" in each image's Tags.
                # Also runs for images saved earlier, so a re-run adds missing tags.
                tags = extract_hashtags(post.caption)
                basename = loader.format_filename(post, target=profile.username)
                if tags and tag_post_images(folder, basename, tags):
                    log(f"    tags: {'; '.join(tags)}")
    except DownloadStopped:
        # From the check above, or from a rate-limit pause (see build_loader).
        log("Stopped.")
    return count
