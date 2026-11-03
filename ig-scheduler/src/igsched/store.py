"""The saved user list and settings, kept in data/igsched.json.

Every change re-reads the file, applies the change and writes it back, so the
window and a scheduled run (a separate process) don't overwrite each other's
results. Writes go to a temp file first and then replace the real one, so a
crash never leaves a half-written file.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import threading
from copy import deepcopy
from datetime import datetime
from pathlib import Path

from igdl.security import is_valid_username

DEFAULT_LIMIT = 5
_TIME_RE = re.compile(r"([01]\d|2[0-3]):[0-5]\d")


def default_settings(output_dir: Path) -> dict:
    return {
        "limit": DEFAULT_LIMIT,
        "output_dir": str(output_dir),
        "videos": False,
        "caption": False,
        "metadata": False,
        "schedule_time": "08:00",
    }


def normalize_username(name: str) -> str:
    """'  @NatGeo ' -> 'natgeo'. Raises ValueError if it can't be a username.

    Instagram usernames are case-insensitive and instaloader saves into the
    lowercase folder name, so the list stores them lowercase.
    """
    name = name.strip().lstrip("@").lower()
    if not is_valid_username(name):
        raise ValueError("Not a valid Instagram username (letters, digits, '.' and '_', max 30).")
    return name


def valid_time(text: str) -> bool:
    """True for a 24-hour 'HH:MM' time."""
    return bool(_TIME_RE.fullmatch(text))


def _clean(raw: object, output_dir: Path) -> dict:
    """Turn whatever was in the file into a valid store, dropping bad entries."""
    data = raw if isinstance(raw, dict) else {}
    settings = default_settings(output_dir)
    saved = data.get("settings") if isinstance(data.get("settings"), dict) else {}
    for key, default in settings.items():
        value = saved.get(key, default)
        if isinstance(default, bool):
            settings[key] = value if isinstance(value, bool) else default
        elif key == "limit":
            settings[key] = value if isinstance(value, int) and not isinstance(value, bool) and value >= 1 else default
        elif key == "schedule_time":
            settings[key] = value if isinstance(value, str) and valid_time(value) else default
        else:
            settings[key] = value if isinstance(value, str) and value.strip() else default

    users, seen = [], set()
    for entry in data.get("users", []) if isinstance(data.get("users"), list) else []:
        if not isinstance(entry, dict):
            continue
        try:
            name = normalize_username(str(entry.get("username", "")))
        except ValueError:
            continue
        if name in seen:
            continue
        seen.add(name)
        users.append({
            "username": name,
            "last_run": entry.get("last_run") if isinstance(entry.get("last_run"), str) else None,
            "last_status": entry.get("last_status") if isinstance(entry.get("last_status"), str) else None,
        })
    return {"settings": settings, "users": users}


class Store:
    """Thread-safe access to data/igsched.json."""

    def __init__(self, path: Path, default_output: Path) -> None:
        self.path = Path(path)
        self.default_output = Path(default_output)
        self._lock = threading.Lock()
        self._data = self._read()

    # ------------------------------------------------------------- file access

    def _read(self) -> dict:
        try:
            raw = json.loads(self.path.read_text(encoding="utf-8"))
        except FileNotFoundError:
            raw = {}
        except (OSError, ValueError):
            # Corrupt file: keep a copy so nothing is lost, then start fresh.
            try:
                shutil.copyfile(self.path, self.path.with_suffix(".json.bak"))
            except OSError:
                pass
            raw = {}
        return _clean(raw, self.default_output)

    def _write(self, data: dict) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".json.tmp")
        tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, self.path)

    def _mutate(self, change) -> object:
        with self._lock:
            data = self._read()
            result = change(data)
            self._write(data)
            self._data = data
            return result

    def reload(self) -> None:
        with self._lock:
            self._data = self._read()

    # ------------------------------------------------------------------ reads

    @property
    def settings(self) -> dict:
        with self._lock:
            return deepcopy(self._data["settings"])

    @property
    def users(self) -> list[dict]:
        with self._lock:
            return deepcopy(self._data["users"])

    def usernames(self) -> list[str]:
        return [u["username"] for u in self.users]

    # ----------------------------------------------------------------- writes

    def add_user(self, name: str) -> bool:
        """Add a user. Returns False if already listed. Raises ValueError if invalid."""
        name = normalize_username(name)

        def change(data):
            if any(u["username"] == name for u in data["users"]):
                return False
            data["users"].append({"username": name, "last_run": None, "last_status": None})
            return True
        return self._mutate(change)

    def remove_user(self, name: str) -> bool:
        """Remove a user. Returns False if it wasn't listed."""
        name = name.strip().lstrip("@").lower()

        def change(data):
            before = len(data["users"])
            data["users"] = [u for u in data["users"] if u["username"] != name]
            return len(data["users"]) != before
        return self._mutate(change)

    def record_result(self, name: str, status: str, when: datetime | None = None) -> None:
        stamp = (when or datetime.now()).isoformat(timespec="seconds")

        def change(data):
            for u in data["users"]:
                if u["username"] == name:
                    u["last_run"], u["last_status"] = stamp, status
        self._mutate(change)

    def update_settings(self, **values) -> None:
        """Change settings; values are validated the same way as on load."""
        def change(data):
            merged = {**data["settings"], **values}
            data["settings"] = _clean({"settings": merged}, self.default_output)["settings"]
        self._mutate(change)
