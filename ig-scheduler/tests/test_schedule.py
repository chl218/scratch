from pathlib import Path, PurePosixPath

import pytest

from igsched import schedule


def test_command():
    cmd = schedule.build_command(Path("/v/python"), Path("/app/main-program.py"))
    assert cmd == [str(Path("/v/python")), str(Path("/app/main-program.py")), "--run"]


@pytest.mark.parametrize("bad", ["8", "24:00", "12:60", "ab:cd", ""])
def test_bad_time(bad):
    with pytest.raises(ValueError):
        schedule.parse_time(bad)


def test_schtasks_args():
    args = schedule.schtasks_create_args([r"C:\a b\pythonw.exe", r"C:\app\main-program.py", "--run"], "7:05")
    assert args[:6] == ["schtasks", "/Create", "/SC", "DAILY", "/TN", "ig-scheduler"]
    assert args[args.index("/TR") + 1] == r'"C:\a b\pythonw.exe" "C:\app\main-program.py" --run'
    assert args[args.index("/ST") + 1] == "07:05"
    assert args[-1] == "/F"


def test_cron_line():
    line = schedule.cron_line(["/v/bin/python", "/my app/main-program.py", "--run"], "08:30", PurePosixPath("/my app"))
    assert line.startswith("30 8 * * * cd '/my app' && /v/bin/python '/my app/main-program.py' --run")
    assert line.endswith(schedule.CRON_TAG)


def test_merge_crontab_adds_replaces_removes():
    existing = "MAILTO=me\n0 1 * * * backup\n5 5 * * * old " + schedule.CRON_TAG + "\n\n"
    merged = schedule.merge_crontab(existing, "1 2 * * * new " + schedule.CRON_TAG)
    assert merged == "MAILTO=me\n0 1 * * * backup\n1 2 * * * new # ig-scheduler\n"
    assert schedule.merge_crontab(merged, None) == "MAILTO=me\n0 1 * * * backup\n"
    assert schedule.merge_crontab("", None) == ""
    assert schedule.find_cron_line(merged).startswith("1 2")


def test_scheduled_python_prefers_pythonw(tmp_path):
    (tmp_path / "python.exe").write_text("")
    (tmp_path / "pythonw.exe").write_text("")
    assert schedule.scheduled_python(str(tmp_path / "python.exe"), "win32").name == "pythonw.exe"
    assert schedule.scheduled_python(str(tmp_path / "python.exe"), "linux").name == "python.exe"
