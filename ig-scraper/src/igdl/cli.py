"""Command-line entry point for igdl.

Flow of a run (see main()):
  1. Parse and validate the arguments.
  2. Build an instaloader instance configured for our file layout.
  3. Log in with the chosen method, if any (--cookies, --sessionid or --login).
  4. Download the user's posts.
  5. Turn any failure into a short message and an exit code.

The `igdl` console command (defined in pyproject.toml) calls main().
"""

from __future__ import annotations

import argparse
import getpass
import os
import sys
from pathlib import Path

from instaloader.exceptions import (
    BadCredentialsException,
    ConnectionException,
    LoginException,
    LoginRequiredException,
    PrivateProfileNotFollowedException,
    ProfileNotExistsException,
    TooManyRequestsException,
)

from . import __version__
from .security import is_valid_username, strip_control

# Browsers that browser_cookie3 can read cookies from (values for --cookies).
BROWSERS = (
    "firefox", "chrome", "edge", "brave", "chromium",
    "opera", "opera_gx", "vivaldi", "librewolf", "safari",
)
# Environment variable that --sessionid reads before falling back to a prompt.
SESSIONID_ENV = "IGDL_SESSIONID"

# Exit codes, documented in the README so scripts can react to them.
EXIT_OK = 0
EXIT_NOT_FOUND = 1      # profile doesn't exist
EXIT_PRIVATE = 2        # private profile, or Instagram requires login
EXIT_LOGIN = 3          # bad password, or missing/expired session cookie
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
        description="Download all posts from an Instagram user to a directory.",
    )
    p.add_argument("username", help="Instagram username to download (without @)")
    p.add_argument(
        "-o", "--output", type=Path, default=Path("downloads"),
        help="base directory; posts go in OUTPUT/<username>/ (default: ./downloads)",
    )

    # Login methods. Only one can be used per run, so argparse rejects combinations.
    auth = p.add_mutually_exclusive_group()
    auth.add_argument(
        "--cookies", metavar="BROWSER", type=str.lower, choices=BROWSERS,
        help="reuse your Instagram login from this browser (recommended; e.g. firefox)",
    )
    # A flag, not a value option: the secret is never typed on the command line,
    # where it would end up in shell history and process lists.
    auth.add_argument(
        "--sessionid", action="store_true",
        help=f"use a sessionid cookie, read from ${SESSIONID_ENV} or a hidden prompt",
    )
    auth.add_argument("--login", metavar="IG_USER", help="log in with a password (fallback)")
    p.add_argument(
        "--cookie-file", metavar="PATH",
        help="path to the browser's cookie database, if it isn't in the default profile",
    )

    # What to download.
    p.add_argument("--limit", type=positive_int, help="only download the newest N posts")
    p.add_argument(
        "--videos", action="store_true",
        help="also download video posts and videos inside carousels (default: images only)",
    )
    p.add_argument("--no-metadata", action="store_true", help="skip caption .txt and .json files")
    p.add_argument("-q", "--quiet", action="store_true", help="less output")
    p.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    return p


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    """Parse arguments and check the rules argparse can't express on its own.

    argv defaults to sys.argv; tests pass their own list.
    """
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.cookie_file and not args.cookies:
        parser.error("--cookie-file requires --cookies")
    # Accept "@name" as well as "name".
    args.username = args.username.strip().lstrip("@")
    # Reject anything that isn't a valid Instagram username, e.g. "../evil",
    # before it can be used in a request or a folder name.
    if not is_valid_username(args.username):
        parser.error("invalid username: use only letters, digits, '.' and '_' (max 30)")
    return args


def _err(msg: str) -> None:
    """Print an error to stderr. Messages can contain text from Instagram, so
    control characters are stripped to keep it from sending terminal escape codes."""
    print(f"error: {strip_control(msg)}", file=sys.stderr)


def main(argv: list[str] | None = None) -> int:
    """Run igdl and return an exit code (see the EXIT_* constants)."""
    args = parse_args(argv)
    # Imported after parsing so bad arguments fail before any setup work.
    from . import downloader

    loader = downloader.build_loader(
        args.output, videos=args.videos, metadata=not args.no_metadata, quiet=args.quiet
    )
    # Progress output. Silent with -q; otherwise sanitized like errors are.
    log = (lambda _m: None) if args.quiet else (lambda m: print(strip_control(m)))
    count = 0
    try:
        # Step 1: log in, if asked. With no login option the session stays
        # anonymous, which works for public profiles but Instagram may limit results.
        if args.cookies:
            # Reuse the login from the browser. Nothing is written to disk.
            cookies = downloader.read_browser_cookies(args.cookies, args.cookie_file)
            who = downloader.login_with_cookies(loader, cookies)
            log(f"Using {args.cookies} session for @{who}")
        elif args.sessionid:
            # pop() so the secret isn't inherited by any child process.
            sid = os.environ.pop(SESSIONID_ENV, "") or getpass.getpass("Paste sessionid (hidden): ")
            who = downloader.login_with_sessionid(loader, sid)
            log(f"Using session for @{who}")
        elif args.login:
            # Password login; reuses or saves a session file on disk.
            downloader.login(loader, args.login)

        # Step 2: download the posts.
        count = downloader.download_user(loader, args.username, args.limit, log=log)

    # Each instaloader error becomes one readable line plus an exit code,
    # instead of a traceback. Already-saved files are always kept.
    except ProfileNotExistsException:
        _err(f"profile '{args.username}' does not exist.")
        return EXIT_NOT_FOUND
    except (PrivateProfileNotFollowedException, LoginRequiredException) as e:
        _err(f"{e}\nhint: use --cookies BROWSER (or --sessionid) with an account that can see this profile.")
        return EXIT_PRIVATE
    except (BadCredentialsException, LoginException) as e:
        _err(f"login failed: {e}")
        return EXIT_LOGIN
    except TooManyRequestsException:
        _err("Instagram is rate-limiting requests. Wait a while and re-run; "
             "already-downloaded posts are skipped.")
        return EXIT_RATE_LIMIT
    except ConnectionException as e:
        # instaloader reports blocks (401 Unauthorized / 429 Too Many Requests)
        # as generic connection errors, so look for the status code in the message.
        msg = str(e)
        if any(code in msg for code in ("401", "429")):
            _err("Instagram blocked the request (401/429). Wait and retry, or use --cookies.")
            return EXIT_RATE_LIMIT
        _err(f"connection problem: {msg}")
        return EXIT_RATE_LIMIT
    except KeyboardInterrupt:
        print("\nInterrupted. Files saved so far are kept; re-run to continue.", file=sys.stderr)
        return EXIT_INTERRUPTED

    log(f"Done. {count} post(s) saved to {args.output / args.username}")
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())
