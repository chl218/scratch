"""Where ig-scheduler keeps its files. Everything lives inside the ig-scheduler folder.

All paths are absolute and based on this file's location, not the current folder,
because Task Scheduler and cron start the program from somewhere else.
"""

from __future__ import annotations

from pathlib import Path

APP_DIR = Path(__file__).resolve().parents[2]   # .../ig-scheduler
SCRIPT = APP_DIR / "main-program.py"
VENV = APP_DIR / ".venv"
DATA_DIR = APP_DIR / "data"
STORE_FILE = DATA_DIR / "igsched.json"
LOCK_FILE = DATA_DIR / "run.lock"
LOGS_DIR = APP_DIR / "logs"
DEFAULT_OUTPUT = APP_DIR / "downloads"
IGDL_DIR = APP_DIR.parent / "ig-scraper"        # the igdl package this tool uses
