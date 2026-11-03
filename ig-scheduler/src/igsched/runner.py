"""Download the newest posts of every saved user, one user at a time.

Used by both the window (on a background thread) and `main-program.py --run`
(the daily scheduled run). Downloading itself is igdl's job: this module only
loops over the users, keeps going when one user fails, and records results.
"""

from __future__ import annotations

import os
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Callable

from . import paths
from .store import Store

EXIT_OK = 0
EXIT_SOME_FAILED = 1
EXIT_RATE_LIMIT = 4    # same code igdl uses
EXIT_BUSY = 5          # another run is already in progress
KEEP_LOGS = 30
MEDIA_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".mp4"}
STALE_LOCK_SECONDS = 24 * 3600


@dataclass
class UserResult:
    username: str
    ok: bool
    new_files: int = 0
    status: str = ""
    code: int | None = None  # igdl exit code for failures


# ------------------------------------------------------------------- run lock

def pid_alive(pid: int) -> bool:
    """True if a process with this PID is running."""
    if pid <= 0:
        return False
    if sys.platform == "win32":
        # os.kill(pid, 0) would terminate the process on Windows; ask the OS instead.
        import ctypes
        kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
        handle = kernel32.OpenProcess(0x1000, False, pid)  # PROCESS_QUERY_LIMITED_INFORMATION
        if not handle:
            return ctypes.get_last_error() == 5  # access denied: it exists
        try:
            code = ctypes.c_ulong()
            if not kernel32.GetExitCodeProcess(handle, ctypes.byref(code)):
                return True
            return code.value == 259  # STILL_ACTIVE
        finally:
            kernel32.CloseHandle(handle)
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    except PermissionError:
        return True
    return True


class RunLock:
    """A lock file so the window and a scheduled run never download at the same time."""

    def __init__(self, path: Path) -> None:
        self.path = Path(path)
        self.held = False

    def acquire(self) -> bool:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        for _ in range(2):
            try:
                fd = os.open(self.path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            except FileExistsError:
                if self._is_stale():
                    try:
                        self.path.unlink()
                    except FileNotFoundError:
                        pass
                    continue
                return False
            with os.fdopen(fd, "w") as f:
                f.write(str(os.getpid()))
            self.held = True
            return True
        return False

    def _is_stale(self) -> bool:
        try:
            pid = int(self.path.read_text().strip() or 0)
            age = time.time() - self.path.stat().st_mtime
        except (OSError, ValueError):
            return True
        return age > STALE_LOCK_SECONDS or not pid_alive(pid)

    def release(self) -> None:
        if self.held:
            try:
                self.path.unlink()
            except FileNotFoundError:
                pass
            self.held = False

    def __enter__(self):
        return self

    def __exit__(self, *_exc):
        self.release()


# -------------------------------------------------------------------- the run

def _media_files(folder: Path) -> set[str]:
    try:
        return {p.name for p in folder.iterdir() if p.suffix.lower() in MEDIA_SUFFIXES}
    except OSError:
        return set()


_SHORT_ERRORS = {1: "not found", 2: "private", 4: "rate-limited"}


def run_all(
    store: Store,
    log: Callable[[str], None] = print,
    should_stop: Callable[[], bool] = lambda: False,
    on_pause: Callable[[float], None] | None = None,
    on_user_done: Callable[[UserResult], None] | None = None,
    only: list[str] | None = None,
    build_loader=None,
    download_user=None,
    describe_error=None,
) -> list[UserResult]:
    """Download the newest `limit` posts of each saved user (or just `only`).

    One user failing doesn't stop the others, except a rate-limit/connection
    error: the remaining users would hit the same block, so the run ends there.
    build_loader / download_user / describe_error default to igdl's; tests pass fakes.
    """
    if build_loader is None or download_user is None or describe_error is None:
        from igdl import cli, downloader
        build_loader = build_loader or downloader.build_loader
        download_user = download_user or downloader.download_user
        describe_error = describe_error or cli.describe_error

    s = store.settings
    names = store.usernames()
    if only is not None:
        names = [n for n in names if n in set(only)]
    if not names:
        log("No users in the list.")
        return []

    output = Path(s["output_dir"])
    loader = build_loader(
        output, videos=s["videos"], caption=s["caption"], metadata=s["metadata"],
        quiet=True, on_pause=on_pause, should_stop=should_stop,
    )
    # Send instaloader's non-fatal warnings to our log too (as ig-scraper's GUI does).
    try:
        loader.context.error = lambda msg, repeat_at_end=True: log(f"warning: {msg}")
    except AttributeError:
        pass

    results: list[UserResult] = []
    for i, name in enumerate(names, 1):
        if should_stop():
            log("Stopped.")
            break
        log(f"=== [{i}/{len(names)}] @{name} (newest {s['limit']}) ===")
        folder = output / name
        before = _media_files(folder)
        try:
            download_user(loader, name, s["limit"], log=log, should_stop=should_stop)
        except Exception as e:  # noqa: BLE001 - record every failure and keep going
            known = describe_error(e, name)
            code, message = known if known else (None, f"unexpected error: {e!r}")
            result = UserResult(name, ok=False, status=_SHORT_ERRORS.get(code, "error"), code=code)
            log(f"error: {message}")
        else:
            new = len(_media_files(folder) - before)
            stopped = should_stop()
            result = UserResult(name, ok=not stopped, new_files=new,
                                status=f"stopped, {new} new" if stopped else f"ok, {new} new")
            log(f"@{name}: {new} new file(s)")
        store.record_result(name, result.status)
        results.append(result)
        if on_user_done:
            on_user_done(result)
        if result.code == EXIT_RATE_LIMIT:
            log("Instagram is blocking requests; skipping the remaining users until the next run.")
            break
    return results


def exit_code(results: list[UserResult]) -> int:
    if any(r.code == EXIT_RATE_LIMIT for r in results):
        return EXIT_RATE_LIMIT
    if any(not r.ok for r in results):
        return EXIT_SOME_FAILED
    return EXIT_OK


# ------------------------------------------------------------- headless --run

def open_log(logs_dir: Path = paths.LOGS_DIR):
    """Today's log file (appended to), after deleting all but the newest KEEP_LOGS."""
    logs_dir.mkdir(parents=True, exist_ok=True)
    old = sorted(logs_dir.glob("run-*.log"))
    for stale in old[:-KEEP_LOGS]:
        try:
            stale.unlink()
        except OSError:
            pass
    return open(logs_dir / f"run-{datetime.now():%Y-%m-%d}.log", "a", encoding="utf-8")


def make_logger(file) -> Callable[[str], None]:
    """Write to the log file, and to the console if there is one (pythonw has none)."""
    from igdl.security import strip_control

    def log(text: str) -> None:
        line = f"{datetime.now():%H:%M:%S} {strip_control(str(text))}"
        file.write(line + "\n")
        file.flush()
        if sys.stdout is not None:
            try:
                print(line)
            except (UnicodeEncodeError, OSError):
                pass
    return log


def run_headless(store: Store) -> int:
    """The scheduled daily run: no window, results in logs/run-YYYY-MM-DD.log."""
    from igdl import downloader

    with open_log() as f:
        log = make_logger(f)
        lock = RunLock(paths.LOCK_FILE)
        if not lock.acquire():
            log("Another download is already running; skipping this run.")
            return EXIT_BUSY
        with lock:
            log(f"Scheduled run started for {len(store.usernames())} user(s).")
            try:
                results = run_all(store, log=log, on_pause=lambda secs: log(downloader.format_pause(secs)))
            except Exception as e:  # noqa: BLE001 - always leave a trace in the log
                log(f"error: run failed: {e!r}")
                return EXIT_SOME_FAILED
            code = exit_code(results)
            ok = sum(r.ok for r in results)
            log(f"Finished: {ok}/{len(results)} user(s) OK, "
                f"{sum(r.new_files for r in results)} new file(s). Exit code {code}.")
            return code
