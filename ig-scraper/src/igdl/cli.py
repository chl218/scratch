"""Command-line entry point for igdl."""

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

# Browsers supported by browser_cookie3.
BROWSERS = (
    "firefox", "chrome", "edge", "brave", "chromium",
    "opera", "opera_gx", "vivaldi", "librewolf", "safari",
)
SESSIONID_ENV = "IGDL_SESSIONID"

EXIT_OK = 0
EXIT_NOT_FOUND = 1
EXIT_PRIVATE = 2
EXIT_LOGIN = 3
EXIT_RATE_LIMIT = 4
EXIT_INTERRUPTED = 130


def positive_int(value: str) -> int:
    n = int(value)
    if n < 1:
        raise argparse.ArgumentTypeError("must be 1 or more")
    return n


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="igdl",
        description="Download all posts from an Instagram user to a directory.",
    )
    p.add_argument("username", help="Instagram username to download (without @)")
    p.add_argument(
        "-o", "--output", type=Path, default=Path("downloads"),
        help="base directory; posts go in OUTPUT/<username>/ (default: ./downloads)",
    )
    auth = p.add_mutually_exclusive_group()
    auth.add_argument(
        "--cookies", metavar="BROWSER", type=str.lower, choices=BROWSERS,
        help="reuse your Instagram login from this browser (recommended; e.g. firefox)",
    )
    auth.add_argument(
        "--sessionid", action="store_true",
        help=f"use a sessionid cookie, read from ${SESSIONID_ENV} or a hidden prompt",
    )
    auth.add_argument("--login", metavar="IG_USER", help="log in with a password (fallback)")
    p.add_argument(
        "--cookie-file", metavar="PATH",
        help="path to the browser's cookie database, if it isn't in the default profile",
    )
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
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.cookie_file and not args.cookies:
        parser.error("--cookie-file requires --cookies")
    args.username = args.username.strip().lstrip("@")
    if not is_valid_username(args.username):
        parser.error("invalid username: use only letters, digits, '.' and '_' (max 30)")
    return args


def _err(msg: str) -> None:
    print(f"error: {strip_control(msg)}", file=sys.stderr)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    # Imported here so --help works fast and tests don't need the network.
    from . import downloader

    loader = downloader.build_loader(
        args.output, videos=args.videos, metadata=not args.no_metadata, quiet=args.quiet
    )
    log = (lambda _m: None) if args.quiet else (lambda m: print(strip_control(m)))
    count = 0
    try:
        if args.cookies:
            cookies = downloader.read_browser_cookies(args.cookies, args.cookie_file)
            who = downloader.login_with_cookies(loader, cookies)
            log(f"Using {args.cookies} session for @{who}")
        elif args.sessionid:
            # pop() so the secret isn't inherited by any child process.
            sid = os.environ.pop(SESSIONID_ENV, "") or getpass.getpass("Paste sessionid (hidden): ")
            who = downloader.login_with_sessionid(loader, sid)
            log(f"Using session for @{who}")
        elif args.login:
            downloader.login(loader, args.login)
        count = downloader.download_user(loader, args.username, args.limit, log=log)
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
