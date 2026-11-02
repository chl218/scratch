"""Small helpers for handling untrusted input and text safely.

Everything here is a pure function with no network or file access, so it is easy
to test (see tests/test_security.py). Used by cli.py, downloader.py and the GUI.
"""

from __future__ import annotations

import re

# Instagram usernames: letters, digits, "." and "_", up to 30 chars.
# Anything else (slashes, "..") is rejected, which also rules out path tricks
# like "../evil" when the name is used as a folder.
_USERNAME_RE = re.compile(r"[A-Za-z0-9._]{1,30}")
# C0/C1 control chars except tab (\x09) and newline (\x0a). Covers ESC (\x1b), which
# starts ANSI escape sequences, and BEL (\x07). Stops escape injection from captions.
_CONTROL_RE = re.compile(r"[\x00-\x08\x0b-\x1f\x7f-\x9f]")


def is_valid_username(name: str) -> bool:
    """True if name could be an Instagram username."""
    return bool(_USERNAME_RE.fullmatch(name))


def strip_control(text: str) -> str:
    """Remove control characters (see _CONTROL_RE) so text is safe to print."""
    return _CONTROL_RE.sub("", text)
