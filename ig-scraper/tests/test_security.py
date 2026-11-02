import io
import sys

import pytest

from igdl import downloader, security


@pytest.mark.parametrize("name,ok", [
    ("natgeo", True), ("a.b_c9", True), ("../etc", False),
    ("a/b", False), ("a\\b", False), ("", False), ("x" * 31, False),
])
def test_is_valid_username(name, ok):
    assert security.is_valid_username(name) is ok


def test_strip_control_keeps_text_and_newlines():
    assert security.strip_control("a\x1b[2Jb\x07\tc\nd") == "a[2Jb\tc\nd"


def test_logging_strips_terminal_escapes(tmp_path, monkeypatch):
    out = io.StringIO()
    monkeypatch.setattr(sys, "stdout", out)
    loader = downloader.build_loader(tmp_path)
    loader.context.log("[caption \x1b]0;pwned\x07 \x1b[2J]")
    assert "\x1b" not in out.getvalue() and "\x07" not in out.getvalue()
    assert "caption" in out.getvalue()
