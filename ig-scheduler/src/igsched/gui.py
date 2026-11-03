"""The ig-scheduler window (tkinter, standard library only).

Same structure as ig-scraper's main-program.py: downloads run on a background
thread that never touches widgets. It sends messages through self.messages,
which _poll_messages() reads every POLL_MS milliseconds:
  ("log", text)            add a line to the log box
  ("pause", seconds)       Instagram rate-limit pause started
  ("user_done", result)    one user finished: refresh its row
  ("done", text, ok)       the whole run finished
"""

from __future__ import annotations

import os
import queue
import subprocess
import sys
import threading
import tkinter as tk
from datetime import datetime
from pathlib import Path
from tkinter import filedialog, messagebox, scrolledtext, ttk

from igdl import downloader
from igdl.security import strip_control

from . import paths, runner, schedule
from .store import Store, valid_time

POLL_MS = 100
TITLE = "ig-scheduler"


def format_last(user: dict) -> str:
    """'2026-11-02 08:00  ok, 3 new' for the 'Last downloaded' column."""
    if not user.get("last_run"):
        return "never"
    try:
        when = datetime.fromisoformat(user["last_run"]).strftime("%Y-%m-%d %H:%M")
    except ValueError:
        when = user["last_run"]
    return f"{when}  {user.get('last_status') or ''}".strip()


class App:
    def __init__(self, root: tk.Tk, store: Store) -> None:
        self.root = root
        self.store = store
        self.messages: queue.Queue = queue.Queue()
        self.stop_requested = threading.Event()
        self.worker: threading.Thread | None = None
        self.paused = False

        root.title(f"{TITLE} - daily Instagram downloads")
        root.minsize(640, 560)

        s = store.settings
        self.new_user = tk.StringVar()
        self.limit = tk.StringVar(value=str(s["limit"]))
        self.videos = tk.BooleanVar(value=s["videos"])
        self.caption = tk.BooleanVar(value=s["caption"])
        self.metadata = tk.BooleanVar(value=s["metadata"])
        self.output_dir = tk.StringVar(value=s["output_dir"])
        self.schedule_time = tk.StringVar(value=s["schedule_time"])
        self.schedule_status = tk.StringVar(value="Checking schedule…")
        self.status = tk.StringVar(value="Ready.")

        self._build_widgets()
        self._refresh_table()
        # Save option changes as soon as they happen.
        for var in (self.videos, self.caption, self.metadata):
            var.trace_add("write", lambda *_: self._save_settings())
        self.limit.trace_add("write", lambda *_: self._save_settings())
        self.output_dir.trace_add("write", lambda *_: self._save_settings())

        root.protocol("WM_DELETE_WINDOW", self._on_close)
        root.after(POLL_MS, self._poll_messages)
        root.after(10, self._refresh_schedule_status)

    # ------------------------------------------------------------------ layout

    def _build_widgets(self) -> None:
        pad = {"padx": 8, "pady": 4}
        main = ttk.Frame(self.root, padding=12)
        main.grid(sticky="nsew")
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main.columnconfigure(0, weight=1)

        # Two-column user table.
        table = ttk.Frame(main)
        table.grid(row=0, column=0, sticky="nsew", **pad)
        table.columnconfigure(0, weight=1)
        table.rowconfigure(0, weight=1)
        self.tree = ttk.Treeview(table, columns=("user", "last"), show="headings", height=8)
        self.tree.heading("user", text="Username")
        self.tree.heading("last", text="Last downloaded")
        self.tree.column("user", width=220, anchor="w")
        self.tree.column("last", width=320, anchor="w")
        self.tree.grid(row=0, column=0, sticky="nsew")
        scroll = ttk.Scrollbar(table, orient="vertical", command=self.tree.yview)
        scroll.grid(row=0, column=1, sticky="ns")
        self.tree.configure(yscrollcommand=scroll.set)
        self.tree.bind("<Delete>", lambda _e: self._remove_selected())
        main.rowconfigure(0, weight=1)

        # Add / remove.
        edit = ttk.Frame(main)
        edit.grid(row=1, column=0, sticky="ew", **pad)
        ttk.Label(edit, text="Username:").grid(row=0, column=0, padx=(0, 4))
        entry = ttk.Entry(edit, textvariable=self.new_user, width=28)
        entry.grid(row=0, column=1, padx=(0, 6))
        entry.bind("<Return>", lambda _e: self._add_user())
        entry.focus_set()
        ttk.Button(edit, text="Add", command=self._add_user).grid(row=0, column=2, padx=(0, 6))
        ttk.Button(edit, text="Remove selected", command=self._remove_selected).grid(row=0, column=3)

        # Download options.
        opts = ttk.LabelFrame(main, text="Download options", padding=8)
        opts.grid(row=2, column=0, sticky="ew", **pad)
        opts.columnconfigure(1, weight=1)
        lim = ttk.Frame(opts)
        lim.grid(row=0, column=0, columnspan=3, sticky="w")
        ttk.Label(lim, text="Newest").grid(row=0, column=0)
        ttk.Spinbox(lim, from_=1, to=1000, width=5, textvariable=self.limit).grid(row=0, column=1, padx=4)
        ttk.Label(lim, text="posts per user").grid(row=0, column=2, padx=(0, 12))
        ttk.Checkbutton(lim, text="Videos", variable=self.videos).grid(row=0, column=3, padx=(0, 8))
        ttk.Checkbutton(lim, text="Caption + #tags", variable=self.caption).grid(row=0, column=4, padx=(0, 8))
        ttk.Checkbutton(lim, text="Metadata", variable=self.metadata).grid(row=0, column=5)
        ttk.Label(opts, text="Output folder:").grid(row=1, column=0, sticky="w", pady=(6, 0))
        ttk.Entry(opts, textvariable=self.output_dir).grid(row=1, column=1, sticky="ew", padx=4, pady=(6, 0))
        ttk.Button(opts, text="Browse…", command=self._pick_output_dir).grid(row=1, column=2, pady=(6, 0))

        # Run buttons.
        buttons = ttk.Frame(main)
        buttons.grid(row=3, column=0, sticky="w", **pad)
        self.all_button = ttk.Button(buttons, text="Download all", command=lambda: self._start(None))
        self.all_button.grid(row=0, column=0, padx=(0, 6))
        self.sel_button = ttk.Button(buttons, text="Download selected", command=self._start_selected)
        self.sel_button.grid(row=0, column=1, padx=(0, 6))
        self.stop_button = ttk.Button(buttons, text="Stop", command=self._stop, state="disabled")
        self.stop_button.grid(row=0, column=2, padx=(0, 6))
        ttk.Button(buttons, text="Open folder", command=self._open_folder).grid(row=0, column=3)

        # Daily schedule.
        sched = ttk.LabelFrame(main, text="Daily schedule", padding=8)
        sched.grid(row=4, column=0, sticky="ew", **pad)
        ttk.Label(sched, text="Run every day at").grid(row=0, column=0)
        ttk.Entry(sched, textvariable=self.schedule_time, width=6).grid(row=0, column=1, padx=4)
        ttk.Label(sched, text="(24-hour)").grid(row=0, column=2, padx=(0, 10))
        ttk.Button(sched, text="Enable", command=self._enable_schedule).grid(row=0, column=3, padx=(0, 6))
        ttk.Button(sched, text="Disable", command=self._disable_schedule).grid(row=0, column=4, padx=(0, 10))
        ttk.Label(sched, textvariable=self.schedule_status).grid(row=1, column=0, columnspan=5, sticky="w", pady=(4, 0))

        # Log + status line.
        self.log_box = scrolledtext.ScrolledText(main, height=10, wrap="word", state="disabled")
        self.log_box.grid(row=5, column=0, sticky="nsew", **pad)
        main.rowconfigure(5, weight=1)
        ttk.Label(main, textvariable=self.status).grid(row=6, column=0, sticky="w", **pad)

    # -------------------------------------------------------------- user list

    def _refresh_table(self) -> None:
        selected = set(self.tree.selection())
        self.tree.delete(*self.tree.get_children())
        for user in self.store.users:
            name = user["username"]
            self.tree.insert("", "end", iid=name, values=(name, format_last(user)))
        keep = [iid for iid in selected if self.tree.exists(iid)]
        if keep:
            self.tree.selection_set(keep)

    def _add_user(self) -> None:
        text = self.new_user.get()
        if not text.strip():
            return
        try:
            added = self.store.add_user(text)
        except ValueError as e:
            messagebox.showwarning(TITLE, str(e), parent=self.root)
            return
        self.new_user.set("")
        self._refresh_table()
        self.status.set("Added." if added else "Already in the list.")

    def _remove_selected(self) -> None:
        names = list(self.tree.selection())
        if not names:
            messagebox.showinfo(TITLE, "Select one or more users in the list first.", parent=self.root)
            return
        listed = ", ".join(f"@{n}" for n in names)
        if not messagebox.askyesno(TITLE, f"Remove {listed} from the list?\n\n"
                                   "Downloaded files are kept.", parent=self.root):
            return
        for name in names:
            self.store.remove_user(name)
        self._refresh_table()
        self.status.set(f"Removed {len(names)} user(s).")

    # --------------------------------------------------------------- settings

    def _save_settings(self) -> None:
        values = {"videos": self.videos.get(), "caption": self.caption.get(),
                  "metadata": self.metadata.get()}
        try:
            limit = int(self.limit.get())
            if limit >= 1:
                values["limit"] = limit
        except ValueError:
            pass  # half-typed number: keep the saved value
        if self.output_dir.get().strip():
            values["output_dir"] = self.output_dir.get().strip()
        self.store.update_settings(**values)

    def _pick_output_dir(self) -> None:
        folder = filedialog.askdirectory(initialdir=self.output_dir.get() or str(paths.APP_DIR))
        if folder:
            self.output_dir.set(folder)

    # ---------------------------------------------------------------- schedule

    def _refresh_schedule_status(self) -> None:
        self.schedule_status.set(schedule.status()[1])

    def _enable_schedule(self) -> None:
        hhmm = self.schedule_time.get().strip()
        if not valid_time(hhmm):
            messagebox.showwarning(TITLE, "Use a 24-hour time like 08:00.", parent=self.root)
            return
        self.store.update_settings(schedule_time=hhmm)
        ok, msg = schedule.install(hhmm)
        (messagebox.showinfo if ok else messagebox.showerror)(TITLE, msg, parent=self.root)
        self._refresh_schedule_status()

    def _disable_schedule(self) -> None:
        ok, msg = schedule.uninstall()
        (messagebox.showinfo if ok else messagebox.showerror)(TITLE, msg, parent=self.root)
        self._refresh_schedule_status()

    # -------------------------------------------------------------- run / stop

    def _start_selected(self) -> None:
        names = list(self.tree.selection())
        if not names:
            messagebox.showinfo(TITLE, "Select one or more users in the list first.", parent=self.root)
            return
        self._start(names)

    def _start(self, only: list[str] | None) -> None:
        if self.worker and self.worker.is_alive():
            return
        if not self.store.usernames():
            messagebox.showinfo(TITLE, "Add a user to the list first.", parent=self.root)
            return
        try:
            if int(self.limit.get()) < 1:
                raise ValueError
        except ValueError:
            messagebox.showwarning(TITLE, "The number of posts must be 1 or more.", parent=self.root)
            return
        self._save_settings()
        self._clear_log()
        self.stop_requested.clear()
        self._set_running(True)
        self.status.set("Downloading…")
        self.worker = threading.Thread(target=self._run, args=(only,), daemon=True)
        self.worker.start()

    def _set_running(self, running: bool) -> None:
        self.all_button.configure(state="disabled" if running else "normal")
        self.sel_button.configure(state="disabled" if running else "normal")
        self.stop_button.configure(state="normal" if running else "disabled")

    def _stop(self) -> None:
        self.stop_requested.set()
        self.status.set("Stopping after the current post…")
        self.stop_button.configure(state="disabled")

    def _run(self, only: list[str] | None) -> None:
        """Runs on the worker thread."""
        put = self.messages.put
        lock = runner.RunLock(paths.LOCK_FILE)
        if not lock.acquire():
            put(("done", "Another download (probably the scheduled run) is in progress. Try again later.", False))
            return
        try:
            results = runner.run_all(
                self.store,
                log=lambda text: put(("log", text)),
                should_stop=self.stop_requested.is_set,
                on_pause=lambda secs: put(("pause", secs)),
                on_user_done=lambda r: put(("user_done", r)),
                only=only,
            )
            ok = sum(r.ok for r in results)
            new = sum(r.new_files for r in results)
            put(("done", f"Done. {ok}/{len(results)} user(s) OK, {new} new file(s).", True))
        except Exception as e:  # noqa: BLE001 - every failure must reach the window
            put(("done", f"Unexpected error: {e!r}", False))
        finally:
            lock.release()

    # --------------------------------------------------- main-thread plumbing

    def _poll_messages(self) -> None:
        try:
            while True:
                msg = self.messages.get_nowait()
                kind = msg[0]
                if kind == "log":
                    self._append_log(msg[1])
                    if self.paused:
                        self.paused = False
                        self.status.set("Downloading…")
                elif kind == "pause":
                    text = downloader.format_pause(msg[1])
                    self._append_log(text)
                    self.paused = True
                    self.status.set(text + " Press Stop to cancel.")
                elif kind == "user_done":
                    self.store.reload()
                    self._refresh_table()
                elif kind == "done":
                    _, text, ok = msg
                    self.paused = False
                    self._append_log(text if ok else f"error: {text}")
                    self.status.set(text if ok else "Failed. See the log above.")
                    self._set_running(False)
                    self.store.reload()
                    self._refresh_table()
                    if not ok:
                        messagebox.showerror(TITLE, text, parent=self.root)
        except queue.Empty:
            pass
        self.root.after(POLL_MS, self._poll_messages)

    def _append_log(self, text: str) -> None:
        self.log_box.configure(state="normal")
        self.log_box.insert("end", strip_control(str(text)) + "\n")
        self.log_box.see("end")
        self.log_box.configure(state="disabled")

    def _clear_log(self) -> None:
        self.log_box.configure(state="normal")
        self.log_box.delete("1.0", "end")
        self.log_box.configure(state="disabled")

    def _open_folder(self) -> None:
        base = Path(self.output_dir.get().strip() or paths.DEFAULT_OUTPUT)
        selected = self.tree.selection()
        folder = base / selected[0] if selected and (base / selected[0]).is_dir() else base
        if not folder.is_dir():
            messagebox.showinfo(TITLE, f"{folder} doesn't exist yet. Download something first.",
                                parent=self.root)
            return
        if sys.platform == "win32":
            os.startfile(folder)  # noqa: S606 - opens Explorer on a local folder
        else:
            subprocess.run(["open" if sys.platform == "darwin" else "xdg-open", str(folder)], check=False)

    def _on_close(self) -> None:
        if self.worker and self.worker.is_alive():
            if not messagebox.askyesno(TITLE, "A download is running. Quit anyway?", parent=self.root):
                return
            self.stop_requested.set()
        self.root.destroy()


def main(store: Store) -> int:
    if sys.platform == "win32":
        try:
            import ctypes
            ctypes.windll.shcore.SetProcessDpiAwareness(1)
        except (AttributeError, OSError):
            pass
    root = tk.Tk()
    App(root, store)
    root.mainloop()
    return 0
