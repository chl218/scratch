#!/usr/bin/env python3
"""ig-scheduler: download the newest posts of a saved list of Instagram users.

Run it from anywhere:
    python main-program.py              open the window
    python main-program.py --run        download for every saved user, no window
                                        (this is what the daily schedule runs)
    python main-program.py --check      show the setup status
    python main-program.py --list | --add NAME | --remove NAME

On first start it checks its setup and, after asking, creates .venv and installs
igdl (from ../ig-scraper) into it. Only the standard library is used before that.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "src"))

from igsched import __version__, bootstrap, paths  # noqa: E402  (stdlib-only modules)


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        prog="main-program.py",
        description="Download the newest posts of a saved list of Instagram users.",
    )
    mode = p.add_mutually_exclusive_group()
    mode.add_argument("--run", action="store_true", help="download for every saved user without a window")
    mode.add_argument("--check", action="store_true", help="show the setup status and exit")
    mode.add_argument("--list", action="store_true", help="print the saved users")
    mode.add_argument("--add", metavar="NAME", nargs="+", help="add users to the list")
    mode.add_argument("--remove", metavar="NAME", nargs="+", help="remove users from the list")
    p.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    return p.parse_args(argv)


def _headless_say(text: str) -> None:
    """Setup messages for --run: pythonw has no console, so also write them to the log."""
    try:
        paths.LOGS_DIR.mkdir(parents=True, exist_ok=True)
        from datetime import datetime
        with open(paths.LOGS_DIR / f"run-{datetime.now():%Y-%m-%d}.log", "a", encoding="utf-8") as f:
            f.write(f"{datetime.now():%H:%M:%S} setup: {text}\n")
    except OSError:
        pass
    if sys.stderr is not None:
        print(text, file=sys.stderr)


def main(argv: list[str] | None = None) -> int:
    argv = sys.argv[1:] if argv is None else argv
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(errors="replace")
        except (AttributeError, ValueError):
            pass
    args = parse_args(argv)

    if args.check:
        # Report on the Python the program would really use: the venv, if there is one.
        venv_py = bootstrap.venv_python(paths.VENV)
        if venv_py.exists() and not bootstrap.in_venv(paths.VENV):
            return bootstrap._relaunch(venv_py, argv)
        ok, text = bootstrap.report()
        print(text)
        try:
            from igsched import schedule
            print(f"[..] schedule: {schedule.status()[1]}")
        except Exception as e:  # noqa: BLE001
            print(f"[..] schedule: unknown ({e})")
        return 0 if ok else bootstrap.EXIT_SETUP

    gui = not (args.run or args.list or args.add or args.remove)
    if args.run:
        code = bootstrap.ensure_ready(argv, ask=None, need_tk=False, say=_headless_say)
    else:
        code = bootstrap.ensure_ready(argv, ask="gui" if gui else "console", need_tk=gui)
    if code is not None:
        return code

    # Setup is fine: igdl can be imported from here on.
    from igsched.store import Store, normalize_username
    store = Store(paths.STORE_FILE, paths.DEFAULT_OUTPUT)

    if args.run:
        from igsched import runner
        return runner.run_headless(store)
    if args.list:
        for user in store.users:
            print(f"{user['username']:<32} {user['last_run'] or 'never'}  {user['last_status'] or ''}")
        return 0
    if args.add:
        code = 0
        for name in args.add:
            try:
                clean = normalize_username(name)
                print(("added " if store.add_user(clean) else "already listed ") + clean)
            except ValueError as e:
                print(f"{name}: {e}", file=sys.stderr)
                code = 2
        return code
    if args.remove:
        for name in args.remove:
            print(("removed " if store.remove_user(name) else "not listed ") + name)
        return 0

    from igsched import gui as window
    return window.main(store)


if __name__ == "__main__":
    sys.exit(main())
