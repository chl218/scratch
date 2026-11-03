import json

import pytest

from igsched.store import DEFAULT_LIMIT, Store, normalize_username, valid_time


@pytest.fixture
def store(tmp_path):
    return Store(tmp_path / "data" / "igsched.json", tmp_path / "downloads")


def test_defaults_when_missing(store, tmp_path):
    assert store.users == []
    assert store.settings["limit"] == DEFAULT_LIMIT == 5
    assert store.settings["output_dir"] == str(tmp_path / "downloads")
    assert not store.settings["videos"]


def test_add_persists_across_restarts(store, tmp_path):
    assert store.add_user("@NatGeo ")
    assert store.add_user("nasa")
    again = Store(store.path, tmp_path / "downloads")
    assert again.usernames() == ["natgeo", "nasa"]


def test_duplicates_ignored(store):
    assert store.add_user("natgeo")
    assert not store.add_user("NATGEO")
    assert store.usernames() == ["natgeo"]


@pytest.mark.parametrize("bad", ["", "@", "../evil", "a b", "x" * 31])
def test_invalid_rejected(store, bad):
    with pytest.raises(ValueError):
        store.add_user(bad)
    assert store.users == []


def test_remove(store, tmp_path):
    store.add_user("natgeo")
    store.add_user("nasa")
    assert store.remove_user("@natgeo")
    assert not store.remove_user("natgeo")
    assert Store(store.path, tmp_path).usernames() == ["nasa"]


def test_record_result(store):
    store.add_user("natgeo")
    store.record_result("natgeo", "ok, 3 new")
    user = store.users[0]
    assert user["last_status"] == "ok, 3 new" and user["last_run"]


def test_settings_validated(store):
    store.update_settings(limit=0, schedule_time="25:00", videos="yes")
    s = store.settings
    assert s["limit"] == 5 and s["schedule_time"] == "08:00" and s["videos"] is False
    store.update_settings(limit=12, schedule_time="21:30", videos=True)
    s = store.settings
    assert s["limit"] == 12 and s["schedule_time"] == "21:30" and s["videos"] is True


def test_corrupt_file_backed_up(tmp_path):
    path = tmp_path / "igsched.json"
    path.write_text("{not json", encoding="utf-8")
    store = Store(path, tmp_path)
    assert store.users == []
    assert (tmp_path / "igsched.json.bak").read_text(encoding="utf-8") == "{not json"


def test_bad_entries_dropped(tmp_path):
    path = tmp_path / "igsched.json"
    path.write_text(json.dumps({"users": [{"username": "ok_user"}, {"username": "../x"},
                                          "junk", {"username": "OK_USER"}]}), encoding="utf-8")
    assert Store(path, tmp_path).usernames() == ["ok_user"]


def test_other_process_changes_not_lost(store, tmp_path):
    other = Store(store.path, tmp_path / "downloads")  # e.g. the scheduled run
    store.add_user("natgeo")
    other.record_result("natgeo", "ok, 1 new")
    store.add_user("nasa")  # must not wipe the other process's result
    store.reload()
    assert store.users[0]["last_status"] == "ok, 1 new"


def test_helpers():
    assert normalize_username(" @A.b_c ") == "a.b_c"
    assert valid_time("00:00") and valid_time("23:59")
    assert not valid_time("24:00") and not valid_time("8:00")
