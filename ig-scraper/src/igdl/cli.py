"""Command-line entry point for igdl.

Flow of a run (see main()):
  1. Parse and validate the arguments.
  2. Build an instaloader instance configured for our file layout.
  3. Download the user's posts (public profiles only; there is no login).
  4. Turn any failure into a short message and an exit code.

The `igdl` console command (defined in pyproject.toml) calls main().
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from instaloader.exceptions import (
    ConnectionException,
    LoginRequiredException,
    PrivateProfileNotFollowedException,
    ProfileNotExistsException,
    TooManyRequestsException,
)

from . import __version__
from .security import is_valid_username, strip_control

# Exit codes, documented in the README so scripts can react to them.
# (3 was "login failed" when igdl had login options; it's no longer used.)
EXIT_OK = 0
EXIT_NOT_FOUND = 1      # profile doesn't exist
EXIT_PRIVATE = 2        # private profile
EXIT_RATE_LIMIT = 4     # rate-limited, blocked, or another network error
EXIT_INTERRUPTED = 130  # Ctrl+C (the usual shell convention: 128 + SIGINT)


def positive_int(value: str) -> int:
    """argparse type for --limit: an integer of 1 or more."""
    n = int(value)
    if n < 1:
        raise argparse.ArgumentTypeError("must be 1 or more")
    return n


def build_parser() -> argparse.ArgumentParser:
    """Define every command-line option. Help texts show up in `igdl --help`."""
    p = argparse.ArgumentParser(
        prog="igdl",
        description="Download all posts from a public Instagram profile to a directory.",
    )
    p.add_argument("username", help="Instagram username to download (without @)")
    p.add_argument(
        "-o", "--output", type=Path, default=Path("downloads"),
        help="base directory; posts go in OUTPUT/<username>/ (default: ./downloads)",
    )

    # What to download. Everything extra is off by default: just the images.
    p.add_argument("--limit", type=positive_int, help="only download the newest N posts")
    p.add_argument(
        "--videos", action="store_true",
        help="also download video posts and videos inside carousels (default: images only)",
    )
    p.add_argument(
        "--caption", action="store_true",
        help="save each caption as .txt and write its #hashtags into the images' Tags",
    )
    p.add_argument("--metadata", action="store_true", help="save each post's full data as .json")
    p.add_argument("-q", "--quiet", action="store_true", help="less output")
    p.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    return p


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse arguments and check the rules argparse can't express on its own.

    argv defaults to sys.argv; tests pass their own list.
    """
    parser = build_parser()
    args = parser.parse_args(argv)
    # Accept "@name" as well as "name".
    args.username = args.username.strip().lstrip("@")
    # Reject anything that isn't a valid Instagram username, e.g. "../evil",
    # before it can be used in a request or a folder name.
    if not is_valid_username(args.username):
        parser.error("invalid username: use only letters, digits, '.' and '_' (max 30)")
    return args


def describe_error(e: BaseException, username: str) -> tuple[int, str] | None:
    """Map an exception to (exit code, user-facing message), or None if unexpected.

    Shared by the terminal (main below) and the GUI (main-program.py), so both
    explain failures the same way.
    """
    # Order matters: TooManyRequestsException is a kind of ConnectionException.
    if isinstance(e, ProfileNotExistsException):
        return EXIT_NOT_FOUND, f"profile '{username}' does not exist."
    if isinstance(e, (PrivateProfileNotFollowedException, LoginRequiredException)):
        return EXIT_PRIVATE, f"profile '{username}' is private, so its posts can't be downloaded."
    if isinstance(e, TooManyRequestsException):
        return EXIT_RATE_LIMIT, (
            "Instagram is rate-limiting requests. Wait a while and re-run; "
            "already-downloaded posts are skipped."
        )
    if isinstance(e, ConnectionException):
        # instaloader reports blocks (401 Unauthorized / 429 Too Many Requests)
        # as generic connection errors, so look for the status code in the message.
        msg = str(e)
        if any(code in msg for code in ("401", "429")):
            return EXIT_RATE_LIMIT, "Instagram blocked the request (401/429). Wait a while and retry."
        return EXIT_RATE_LIMIT, f"connection problem: {msg}"
    return None


def _err(msg: str) -> None:
    """Print an error to stderr. Messages can contain text from Instagram, so
    control characters are stripped to keep it from sending terminal escape codes."""
    print(f"error: {strip_control(msg)}", file=sys.stderr)


def main(argv: list[str] | None = None) -> int:
    """Run igdl and return an exit code (see the EXIT_* constants)."""
    # Captions and hashtags can be in any language. If the terminal's encoding
    # can't show a character (e.g. Korean on a cp1252 console), print "?" instead
    # of crashing mid-download. The files themselves always keep the real text.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(errors="replace")
        except (AttributeError, ValueError):  # not a normal text stream (e.g. in tests)
            pass
    args = parse_args(argv)
    # Imported after parsing so bad arguments fail before any setup work.
    from . import downloader

    # Rate-limit pauses can last minutes. Without -q instaloader announces them itself;
    # -q hides that, so announce them on stderr ourselves (never hide a long wait).
    on_pause = (lambda secs: print(downloader.format_pause(secs), file=sys.stderr)) if args.quiet else None
    loader = downloader.build_loader(
        args.output, videos=args.videos, caption=args.caption, metadata=args.metadata,
        quiet=args.quiet, on_pause=on_pause,
    )
    # Progress output. Silent with -q; otherwise sanitized like errors are.
    log = (lambda _m: None) if args.quiet else (lambda m: print(strip_control(m)))
    try:
        count = downloader.download_user(loader, args.username, args.limit, log=log)
    except KeyboardInterrupt:
        print("\nInterrupted. Files saved so far are kept; re-run to continue.", file=sys.stderr)
        return EXIT_INTERRUPTED
    except Exception as e:
        # Known instaloader errors become one readable line plus an exit code,
        # instead of a traceback. Already-saved files are always kept.
        known = describe_error(e, args.username)
        if known is None:
            raise  # a bug, not a user problem: show the full traceback
        code, msg = known
        _err(msg)
        return code

    log(f"Done. {count} post(s) saved to {args.output / args.username}")
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
