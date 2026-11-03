"""Register, remove and check the daily run.

  Windows:       a Task Scheduler task named "ig-scheduler" (schtasks.exe)
  macOS / Linux: one line in the user's crontab, tagged "# ig-scheduler"

Both run `<python> <ig-scheduler>/main-program.py --run` once a day.
The pure functions (command, schtasks arguments, cron line, crontab merge) are
tested; only install() / uninstall() / status() call the system tools.
"""

from __future__ import annotations

import shlex
import shutil
import subprocess
import sys
from pathlib import Path

from . import paths

TASK_NAME = "ig-scheduler"
CRON_TAG = "# ig-scheduler"


# ----------------------------------------------------------------- pure helpers

def scheduled_python(executable: str = sys.executable, platform: str = sys.platform) -> Path:
    """The Python to schedule. On Windows, pythonw.exe so no console window pops up."""
    exe = Path(executable)
    if platform == "win32" and exe.name.lower() == "python.exe":
        windowed = exe.with_name("pythonw.exe")
        if windowed.exists():
            return windowed
    return exe


def build_command(python: Path, script: Path = paths.SCRIPT) -> list[str]:
    return [str(python), str(script), "--run"]


def parse_time(hhmm: str) -> tuple[int, int]:
    """'08:30' -> (8, 30). Raises ValueError for anything else."""
    try:
        h, m = (int(x) for x in hhmm.strip().split(":"))
    except ValueError:
        raise ValueError("Use a 24-hour time like 08:00.") from None
    if not (0 <= h <= 23 and 0 <= m <= 59):
        raise ValueError("Use a 24-hour time like 08:00.")
    return h, m


def schtasks_create_args(cmd: list[str], hhmm: str) -> list[str]:
    h, m = parse_time(hhmm)
    task_cmd = " ".join(f'"{part}"' if part != "--run" else part for part in cmd)
    return ["schtasks", "/Create", "/SC", "DAILY", "/TN", TASK_NAME,
            "/TR", task_cmd, "/ST", f"{h:02d}:{m:02d}", "/F"]


def cron_line(cmd: list[str], hhmm: str, workdir: Path = paths.APP_DIR) -> str:
    h, m = parse_time(hhmm)
    # Output goes to logs/ already; discard cron's own copy so it doesn't send mail.
    return (f"{m} {h} * * * cd {shlex.quote(str(workdir))} && {shlex.join(cmd)} "
            f">/dev/null 2>&1 {CRON_TAG}")


def merge_crontab(existing: str, line: str | None) -> str:
    """Remove our old line from a crontab and add `line` (None = just remove)."""
    kept = [ln for ln in existing.splitlines() if CRON_TAG not in ln]
    while kept and not kept[-1].strip():
        kept.pop()
    if line:
        kept.append(line)
    return "\n".join(kept) + ("\n" if kept else "")


def find_cron_line(crontab: str) -> str | None:
    for ln in crontab.splitlines():
        if CRON_TAG in ln:
            return ln
    return None


# --------------------------------------------------------------- system calls

def _run(args: list[str], input_text: str | None = None) -> subprocess.CompletedProcess:
    kwargs = {"capture_output": True, "text": True, "input": input_text}
    if sys.platform == "win32":
        kwargs["creationflags"] = subprocess.CREATE_NO_WINDOW
    return subprocess.run(args, **kwargs)


def _read_crontab() -> str:
    result = _run(["crontab", "-l"])
    return result.stdout if result.returncode == 0 else ""  # nonzero = no crontab yet


def install(hhmm: str, python: Path | None = None) -> tuple[bool, str]:
    """Register the daily run at hhmm (local time). Replaces an existing one."""
    try:
        parse_time(hhmm)
    except ValueError as e:
        return False, str(e)
    cmd = build_command(python or scheduled_python())
    if sys.platform == "win32":
        result = _run(schtasks_create_args(cmd, hhmm))
        if result.returncode != 0:
            return False, (result.stderr or result.stdout).strip() or "schtasks failed."
        return True, f"Scheduled daily at {hhmm} (Task Scheduler task '{TASK_NAME}')."
    if not shutil.which("crontab"):
        return False, "crontab isn't available on this system."
    result = _run(["crontab", "-"], merge_crontab(_read_crontab(), cron_line(cmd, hhmm)))
    if result.returncode != 0:
        return False, result.stderr.strip() or "crontab failed."
    return True, f"Scheduled daily at {hhmm} (crontab)."


def uninstall() -> tuple[bool, str]:
    if sys.platform == "win32":
        if not status()[0]:
            return True, "No daily schedule was set."
        result = _run(["schtasks", "/Delete", "/TN", TASK_NAME, "/F"])
        if result.returncode != 0:
            return False, (result.stderr or result.stdout).strip() or "schtasks failed."
        return True, "Daily schedule removed."
    if not shutil.which("crontab"):
        return True, "No daily schedule was set."
    current = _read_crontab()
    if find_cron_line(current) is None:
        return True, "No daily schedule was set."
    result = _run(["crontab", "-"], merge_crontab(current, None))
    if result.returncode != 0:
        return False, result.stderr.strip() or "crontab failed."
    return True, "Daily schedule removed."


def status() -> tuple[bool, str]:
    """(is scheduled, description)."""
    if sys.platform == "win32":
        result = _run(["schtasks", "/Query", "/TN", TASK_NAME, "/FO", "LIST"])
        if result.returncode != 0:
            return False, "Not scheduled."
        for ln in result.stdout.splitlines():
            if ln.lower().startswith("next run time:"):
                return True, f"Scheduled. Next run: {ln.split(':', 1)[1].strip()}"
        return True, "Scheduled."
    if not shutil.which("crontab"):
        return False, "Not scheduled (crontab not available)."
    line = find_cron_line(_read_crontab())
    if line is None:
        return False, "Not scheduled."
    minute, hour = line.split()[:2]
    return True, f"Scheduled daily at {int(hour):02d}:{int(minute):02d} (crontab)."
