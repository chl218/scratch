"""Setup check that runs before anything else. Uses only the standard library.

ensure_ready() makes sure the program runs with a Python that has igdl and its
dependencies (instaloader, piexif):
  1. Python must be 3.10 or newer.
  2. The window needs tkinter.
  3. If ig-scheduler/.venv exists, the program re-launches itself inside it.
  4. If packages are missing, it offers to create .venv and install
     ../ig-scraper into it, then re-launches inside the venv.
     A scheduled (--run) start never asks: it reports the problem and exits.
"""

from __future__ import annotations

import importlib.util
import os
import subprocess
import sys
from pathlib import Path
from typing import Callable

from . import paths

MIN_PYTHON = (3, 10)
REQUIRED_MODULES = ("igdl", "instaloader", "piexif")
EXIT_SETUP = 3  # exit code when setup is incomplete


# ----------------------------------------------------------------- pure helpers

def venv_python(venv: Path, windowed: bool = False, platform: str = sys.platform) -> Path:
    """The Python executable inside a venv. windowed=True gives pythonw.exe on Windows."""
    if platform == "win32":
        return venv / "Scripts" / ("pythonw.exe" if windowed else "python.exe")
    return venv / "bin" / "python"


def in_venv(venv: Path, prefix: str | None = None) -> bool:
    """True if this Python is the one inside `venv`."""
    here = os.path.normcase(str(Path(prefix or sys.prefix).resolve()))
    return here == os.path.normcase(str(venv.resolve()))


def missing_modules(names=REQUIRED_MODULES) -> list[str]:
    """Names from `names` that this Python can't import."""
    missing = []
    for name in names:
        try:
            if importlib.util.find_spec(name) is None:
                missing.append(name)
        except (ImportError, ValueError):
            missing.append(name)
    return missing


def has_tkinter() -> bool:
    try:
        import tkinter  # noqa: F401
    except ImportError:
        return False
    return True


TKINTER_HELP = (
    "tkinter (Python's window toolkit) is missing.\n"
    "  Windows: re-run the Python installer and tick 'tcl/tk and IDLE'.\n"
    "  macOS:   brew install python-tk\n"
    "  Debian/Ubuntu: sudo apt install python3-tk\n"
    "  Fedora:  sudo dnf install python3-tkinter"
)


# ------------------------------------------------------------------- reporting

def report() -> tuple[bool, str]:
    """Setup status for `main-program.py --check`: (all good, text)."""
    ok = True
    lines = []

    def row(good: bool, text: str) -> None:
        nonlocal ok
        ok = ok and good
        lines.append(f"[{'ok' if good else '!!'}] {text}")

    py_ok = sys.version_info >= MIN_PYTHON
    row(py_ok, f"Python {sys.version.split()[0]} ({sys.executable})"
        + ("" if py_ok else f" - need {MIN_PYTHON[0]}.{MIN_PYTHON[1]}+"))
    row(paths.IGDL_DIR.is_dir(), f"igdl source folder: {paths.IGDL_DIR}")
    if paths.VENV.is_dir():
        inside = in_venv(paths.VENV)
        lines.append(f"[..] venv: {paths.VENV} ({'running inside it' if inside else 'exists, not active'})")
    else:
        lines.append(f"[..] venv: {paths.VENV} (not created yet)")
    tk_ok = has_tkinter()
    lines.append(f"[{'ok' if tk_ok else '!!'}] tkinter (needed for the window only)")
    missing = missing_modules()
    for name in REQUIRED_MODULES:
        row(name not in missing, f"module {name}")
    if missing:
        lines.append("Run `python main-program.py` to install the missing modules.")
    return ok, "\n".join(lines)


# --------------------------------------------------------------------- actions

def _relaunch(python: Path, argv: list[str]) -> int:
    """Run main-program.py again with another Python and return its exit code."""
    return subprocess.run([str(python), str(paths.SCRIPT), *argv]).returncode


def _ask_gui(question: str) -> bool | None:
    """Yes/no dialog. None if no window can be shown."""
    try:
        import tkinter as tk
        from tkinter import messagebox
        root = tk.Tk()
        root.withdraw()
        try:
            return messagebox.askyesno("ig-scheduler setup", question, parent=root)
        finally:
            root.destroy()
    except Exception:  # noqa: BLE001 - no tkinter or no display: fall back to the console
        return None


def _ask_console(question: str) -> bool | None:
    if not (sys.stdin and sys.stdin.isatty()):
        return None
    try:
        return input(f"{question} [y/N] ").strip().lower() in ("y", "yes")
    except EOFError:
        return None


def _install(say: Callable[[str], None]) -> Path | None:
    """Create .venv if needed and install igdl into it. Returns the venv's Python."""
    target = Path(sys.executable)
    if not in_venv(paths.VENV):
        if not venv_python(paths.VENV).exists():
            say(f"Creating virtual environment in {paths.VENV} ...")
            if subprocess.run([sys.executable, "-m", "venv", str(paths.VENV)]).returncode != 0:
                say("Could not create the virtual environment.")
                return None
        target = venv_python(paths.VENV)
    say(f"Installing igdl from {paths.IGDL_DIR} (this can take a minute) ...")
    cmd = [str(target), "-m", "pip", "install", "--disable-pip-version-check", "-e", str(paths.IGDL_DIR)]
    if subprocess.run(cmd).returncode != 0:
        say("pip install failed. See the messages above.")
        return None
    say("Setup complete.")
    return target


def ensure_ready(
    argv: list[str],
    ask: str | None,
    need_tk: bool,
    say: Callable[[str], None] = print,
) -> int | None:
    """Make sure igdl can be imported. Returns None to continue, or an exit code.

    ask: "gui" (dialog), "console" (y/N prompt) or None (never ask; for --run).
    """
    if sys.version_info < MIN_PYTHON:
        say(f"ig-scheduler needs Python {MIN_PYTHON[0]}.{MIN_PYTHON[1]} or newer "
            f"(this is {sys.version.split()[0]}).")
        return EXIT_SETUP
    if need_tk and not has_tkinter():
        say(TKINTER_HELP)
        return EXIT_SETUP

    # A venv exists but we were started with another Python: switch to it.
    if paths.VENV.is_dir() and not in_venv(paths.VENV) and venv_python(paths.VENV).exists():
        return _relaunch(venv_python(paths.VENV), argv)

    missing = missing_modules()
    if not missing:
        return None

    if not paths.IGDL_DIR.is_dir():
        say(f"Missing modules: {', '.join(missing)}.\n"
            f"ig-scheduler installs them from igdl, expected at {paths.IGDL_DIR}, "
            "but that folder doesn't exist.")
        return EXIT_SETUP

    question = (f"ig-scheduler needs these Python packages: {', '.join(missing)}.\n\n"
                f"Create a virtual environment in\n{paths.VENV}\n"
                f"and install igdl from\n{paths.IGDL_DIR}?")
    answer = None
    if ask == "gui":
        answer = _ask_gui(question)
    if answer is None and ask is not None:
        answer = _ask_console(question)
    if not answer:
        say(f"Setup incomplete: missing {', '.join(missing)}.\n"
            f"Install manually:\n    python -m venv \"{paths.VENV}\"\n"
            f"    \"{venv_python(paths.VENV)}\" -m pip install -e \"{paths.IGDL_DIR}\"")
        return EXIT_SETUP

    python = _install(say)
    if python is None:
        return EXIT_SETUP
    return _relaunch(python, argv)
