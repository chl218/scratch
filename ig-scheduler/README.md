# ig-scheduler: daily downloads for a list of Instagram users

Keep a list of **public** Instagram profiles and download each one's newest posts (5 by default), from a window or once a day on a schedule. The downloading is done by [igdl](../ig-scraper/README.md) from the `ig-scraper` folder next to this one.

## Start

```powershell
cd ig-scheduler
python main-program.py      # Windows (not python3, which opens the Microsoft Store)
python3 main-program.py     # macOS / Linux
```

No install step is needed. On first start the program checks its setup:

| Check | If it fails |
|-------|-------------|
| Python 3.10+ | Explains and exits. |
| tkinter (window only) | Prints the install command for your OS. |
| igdl, instaloader, piexif | Asks, then creates `.venv`, runs `pip install -e ../ig-scraper` into it, and restarts inside it. |

After that, `python main-program.py` always switches to `.venv` on its own. `python main-program.py --check` shows the setup status.

## The window

| Part | What it does |
|------|--------------|
| **Username / Last downloaded** table | Your saved list. The second column shows when each user was last run and the result, e.g. `2026-11-02 08:00  ok, 3 new`. |
| Username box + **Add** | Adds a user (Enter works too). `@name` is fine. Invalid names and duplicates are refused. |
| **Remove selected** (or Delete key) | Removes users from the list. Downloaded files are kept. |
| Newest _N_ posts per user | 5 by default. Saved, and used by the daily run too. |
| Videos / Caption + #tags / Metadata | Same options as igdl. Off by default (images only). |
| **Download all** / **Download selected** | Runs igdl for those users. **Stop** finishes the current post, then stops. |
| **Daily schedule** | **Enable** registers a daily run at the given time; **Disable** removes it. |

Everything you change is saved immediately to `data/igsched.json`, so the list and options are still there next time.

Files go to `downloads/<username>/` (changeable). Files that already exist are skipped, so a daily run only adds new posts.

## Daily run

The schedule runs `main-program.py --run`, which downloads for every saved user without opening a window:

| System | How it's scheduled |
|--------|--------------------|
| Windows | A Task Scheduler task named `ig-scheduler`, using `pythonw.exe` so no console pops up. It runs when you're logged in. |
| macOS / Linux | One line in your crontab ending in `# ig-scheduler`. On macOS, cron may need **Full Disk Access** (System Settings → Privacy & Security) to write to some folders. |

You can also set it up yourself. The command is:

```
<ig-scheduler>/.venv/Scripts/pythonw.exe <ig-scheduler>/main-program.py --run    # Windows
<ig-scheduler>/.venv/bin/python <ig-scheduler>/main-program.py --run              # macOS / Linux
```

Each run appends to `logs/run-YYYY-MM-DD.log`, and only the last 30 log files are kept. A run and the window never download at the same time: whichever starts second waits for the next try.

If one user fails (not found, private), the others still run. If Instagram rate-limits or blocks requests, the rest of the users are skipped until the next run.

## Command line

```powershell
python main-program.py                     # window
python main-program.py --run               # download for all saved users, no window
python main-program.py --check             # setup status + schedule status
python main-program.py --list
python main-program.py --add natgeo nasa
python main-program.py --remove nasa
```

| Exit code (`--run`) | Meaning |
|---|---|
| 0 | every user OK |
| 1 | at least one user failed |
| 3 | setup incomplete (run `python main-program.py` once to install) |
| 4 | rate-limited or blocked by Instagram |
| 5 | another download was already running |

## Files

| Path | What |
|------|------|
| [`main-program.py`](main-program.py) | Entry point: setup check, then window or command-line mode. |
| [`src/igsched/bootstrap.py`](src/igsched/bootstrap.py) | Setup check and venv install (standard library only). |
| [`src/igsched/store.py`](src/igsched/store.py) | Saved users and settings (`data/igsched.json`). |
| [`src/igsched/runner.py`](src/igsched/runner.py) | Loops over users with igdl, records results, run lock, `--run` logging. |
| [`src/igsched/schedule.py`](src/igsched/schedule.py) | Task Scheduler / crontab. |
| [`src/igsched/gui.py`](src/igsched/gui.py) | The tkinter window. |

`.venv/`, `data/`, `logs/` and `downloads/` are created at runtime and are git-ignored.

## Tests

```powershell
.venv\Scripts\pip install pytest
.venv\Scripts\python -m pytest
```

## Caveats

Same as igdl: public profiles only, no login, and scraping goes against Instagram's Terms of Service. Use it for profiles you have permission to archive.
