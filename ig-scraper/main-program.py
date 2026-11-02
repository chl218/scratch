#!/usr/bin/env python3
"""Desktop window for igdl, the Instagram post downloader.

Run it from the ig-scraper folder:
    python main-program.py      (Windows)
    python3 main-program.py     (macOS / Linux)

It uses only the Python standard library (tkinter) on top of the igdl package,
so the window does exactly what the `igdl` command does:
  - every command-line option has a checkbox (the post count has a field too),
  - downloads run on a background thread so the window stays responsive,
  - errors are explained with the same messages as the terminal version.
"""

from __future__ import annotations

import os
import queue
import subprocess
import sys
import threading
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, scrolledtext, ttk

HERE = Path(__file__).resolve().parent
# Make `import igdl` work even if the package wasn't installed with `pip install -e .`.
sys.path.insert(0, str(HERE / "src"))

try:
    from igdl import cli, downloader
    from igdl.security import is_valid_username, strip_control
except ImportError as missing:
    # Most likely instaloader / piexif aren't installed for this Python.
    _root = tk.Tk()
    _root.withdraw()
    messagebox.showerror(
        "igdl",
        f"Missing Python package: {missing.name}\n\n"
        f"Install igdl's dependencies first:\n    pip install -e \"{HERE}\"\n\n"
        "or run this file with the project's virtual environment:\n"
        "    .venv\\Scripts\\python main-program.py",
    )
    sys.exit(1)

DEFAULT_LIMIT = "10"
POLL_MS = 100  # how often the window checks for messages from the download thread


class App:
    """The main window. All widget access happens on the Tk (main) thread.

    The download thread never touches widgets. It sends messages through
    self.messages, which _poll_messages() reads every POLL_MS milliseconds:
      ("log", text)                         add a line to the log box
      ("pause", seconds)                    Instagram rate-limit pause started
      ("done", text, ok)                    the run finished (ok=False on error)
    """

    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.messages: queue.Queue = queue.Queue()
        self.stop_requested = threading.Event()
        self.worker: threading.Thread | None = None
        self.paused = False  # True while the status line shows a rate-limit pause

        root.title("igdl - Instagram post downloader")
        root.minsize(560, 440)

        # ---- Form values (tkinter variables are bound to the widgets below) ----
        self.username = tk.StringVar()
        self.output_dir = tk.StringVar(value=str(Path.cwd() / "downloads"))
        self.use_limit = tk.BooleanVar(value=False)
        self.limit = tk.StringVar(value=DEFAULT_LIMIT)
        self.videos = tk.BooleanVar(value=False)    # --videos
        self.caption = tk.BooleanVar(value=False)   # --caption (.txt + hashtag Tags)
        self.metadata = tk.BooleanVar(value=False)  # --metadata (.json)
        self.status = tk.StringVar(value="Ready.")

        self._build_widgets()
        self._refresh_states()
        root.protocol("WM_DELETE_WINDOW", self._on_close)
        root.after(POLL_MS, self._poll_messages)

    # ------------------------------------------------------------------ layout

    def _build_widgets(self) -> None:
        pad = {"padx": 8, "pady": 4}
        main = ttk.Frame(self.root, padding=12)
        main.grid(sticky="nsew")
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main.columnconfigure(1, weight=1)

        # Username + output folder
        ttk.Label(main, text="Instagram username:").grid(row=0, column=0, sticky="w", **pad)
        user_entry = ttk.Entry(main, textvariable=self.username)
        user_entry.grid(row=0, column=1, columnspan=2, sticky="ew", **pad)
        user_entry.focus_set()

        ttk.Label(main, text="Output folder:").grid(row=1, column=0, sticky="w", **pad)
        ttk.Entry(main, textvariable=self.output_dir).grid(row=1, column=1, sticky="ew", **pad)
        ttk.Button(main, text="Browse…", command=self._pick_output_dir).grid(row=1, column=2, **pad)

        # What to download
        opts = ttk.LabelFrame(main, text="Options", padding=8)
        opts.grid(row=2, column=0, columnspan=3, sticky="ew", **pad)
        ttk.Checkbutton(
            opts, text="Only the newest", variable=self.use_limit, command=self._refresh_states
        ).grid(row=0, column=0, sticky="w")
        self.limit_box = ttk.Spinbox(opts, from_=1, to=100000, width=7, textvariable=self.limit)
        self.limit_box.grid(row=0, column=1, sticky="w", padx=(0, 4))
        ttk.Label(opts, text="posts").grid(row=0, column=2, sticky="w")
        ttk.Checkbutton(
            opts, text="Include videos (default: images only)", variable=self.videos
        ).grid(row=1, column=0, columnspan=3, sticky="w")
        ttk.Checkbutton(
            opts, text="Save caption (.txt) and write its #hashtags to the images' Tags",
            variable=self.caption,
        ).grid(row=2, column=0, columnspan=3, sticky="w")
        ttk.Checkbutton(
            opts, text="Save metadata (.json)", variable=self.metadata
        ).grid(row=3, column=0, columnspan=3, sticky="w")

        # Buttons
        buttons = ttk.Frame(main)
        buttons.grid(row=3, column=0, columnspan=3, sticky="w", **pad)
        self.start_button = ttk.Button(buttons, text="Download", command=self._start)
        self.start_button.grid(row=0, column=0, padx=(0, 6))
        self.stop_button = ttk.Button(buttons, text="Stop", command=self._stop, state="disabled")
        self.stop_button.grid(row=0, column=1, padx=(0, 6))
        ttk.Button(buttons, text="Open folder", command=self._open_folder).grid(row=0, column=2)
        self.root.bind("<Return>", lambda _e: self._start())

        # Log output + status line
        self.log_box = scrolledtext.ScrolledText(main, height=12, wrap="word", state="disabled")
        self.log_box.grid(row=4, column=0, columnspan=3, sticky="nsew", **pad)
        main.rowconfigure(4, weight=1)
        ttk.Label(main, textvariable=self.status).grid(row=5, column=0, columnspan=3, sticky="w", **pad)

    # ------------------------------------------------------------- form logic

    def _refresh_states(self) -> None:
        """Enable only the fields whose checkbox is ticked."""
        def enable(widget, on: bool, normal: str = "normal") -> None:
            widget.configure(state=normal if on else "disabled")

        enable(self.limit_box, self.use_limit.get())

    def _pick_output_dir(self) -> None:
        folder = filedialog.askdirectory(initialdir=self.output_dir.get() or str(Path.cwd()))
        if folder:
            self.output_dir.set(folder)

    def _collect_settings(self) -> dict | None:
        """Read and validate the form. Shows an error and returns None if invalid.

        Values are copied into a plain dict here, on the main thread, because the
        download thread must not read tkinter variables.
        """
        username = self.username.get().strip().lstrip("@")
        if not is_valid_username(username):
            return self._invalid("Enter a valid Instagram username (letters, digits, '.' and '_').")
        output = self.output_dir.get().strip()
        if not output:
            return self._invalid("Choose an output folder.")

        limit = None
        if self.use_limit.get():
            try:
                limit = int(self.limit.get())
            except ValueError:
                limit = 0
            if limit < 1:
                return self._invalid("The number of posts must be 1 or more.")

        return {
            "username": username,
            "output": Path(output),
            "limit": limit,
            "videos": self.videos.get(),
            "caption": self.caption.get(),
            "metadata": self.metadata.get(),
        }

    def _invalid(self, message: str) -> None:
        messagebox.showwarning("igdl", message, parent=self.root)
        return None

    # -------------------------------------------------------------- run / stop

    def _start(self) -> None:
        if self.worker and self.worker.is_alive():
            return  # already running
        settings = self._collect_settings()
        if settings is None:
            return
        self._clear_log()
        self.stop_requested.clear()
        self.start_button.configure(state="disabled")
        self.stop_button.configure(state="normal")
        self.status.set(f"Downloading from @{settings['username']}…")
        # daemon=True: closing the window ends the program even mid-download.
        self.worker = threading.Thread(target=self._run_download, args=(settings,), daemon=True)
        self.worker.start()

    def _stop(self) -> None:
        # Checked before each post (the current post finishes first) and every
        # half second during a rate-limit pause.
        self.stop_requested.set()
        self.status.set("Stopping…")
        self.stop_button.configure(state="disabled")

    def _run_download(self, s: dict) -> None:
        """Runs on the download thread. Mirrors cli.main(), but reports through messages."""
        log = lambda text: self.messages.put(("log", text))
        try:
            # quiet=True silences instaloader's per-file console output; our own
            # progress lines ([1/10] ...) still come through `log`.
            loader = downloader.build_loader(
                s["output"], videos=s["videos"], caption=s["caption"], metadata=s["metadata"],
                quiet=True,
                # quiet=True also hides instaloader's "need to wait" message, so
                # report rate-limit pauses ourselves, and let Stop end a pause early.
                on_pause=lambda secs: self.messages.put(("pause", secs)),
                should_stop=self.stop_requested.is_set,
            )
            # Route instaloader's non-fatal warnings to the log box too.
            loader.context.error = lambda msg, repeat_at_end=True: log(f"warning: {msg}")

            count = downloader.download_user(
                loader, s["username"], s["limit"], log=log,
                should_stop=self.stop_requested.is_set,
            )
            self.messages.put(("done", f"Done. {count} post(s) saved to {s['output'] / s['username']}", True))
        except Exception as e:  # noqa: BLE001 - every failure must reach the window
            known = cli.describe_error(e, s["username"])
            text = known[1] if known else f"Unexpected error: {e!r}"
            self.messages.put(("done", text, False))

    # --------------------------------------------------- main-thread plumbing

    def _poll_messages(self) -> None:
        """Handle everything the download thread has sent since the last check."""
        try:
            while True:
                msg = self.messages.get_nowait()
                kind = msg[0]
                if kind == "log":
                    self._append_log(msg[1])
                    if self.paused:  # new progress means the pause is over
                        self.paused = False
                        self.status.set("Downloading…")
                elif kind == "pause":
                    text = downloader.format_pause(msg[1])
                    self._append_log(text)
                    self.paused = True
                    self.status.set(text + " Press Stop to cancel.")
                elif kind == "done":
                    _, text, ok = msg
                    self.paused = False
                    self._append_log(text if ok else f"error: {text}")
                    self.status.set(text.splitlines()[0] if ok else "Failed. See the log above.")
                    self.start_button.configure(state="normal")
                    self.stop_button.configure(state="disabled")
                    if not ok:
                        messagebox.showerror("igdl", text, parent=self.root)
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
        """Open the user's download folder (or the output folder) in the file manager."""
        base = Path(self.output_dir.get().strip() or ".")
        user = self.username.get().strip().lstrip("@")
        folder = base / user if user and (base / user).is_dir() else base
        if not folder.is_dir():
            messagebox.showinfo("igdl", f"{folder} doesn't exist yet. Download something first.")
            return
        if sys.platform == "win32":
            os.startfile(folder)  # noqa: S606 - opens Explorer on a local folder
        else:
            subprocess.run(["open" if sys.platform == "darwin" else "xdg-open", str(folder)], check=False)

    def _on_close(self) -> None:
        if self.worker and self.worker.is_alive():
            if not messagebox.askyesno("igdl", "A download is running. Quit anyway?", parent=self.root):
                return
            self.stop_requested.set()
        self.root.destroy()


def main() -> None:
    if sys.platform == "win32":
        # Sharp text on high-DPI screens instead of blurry scaled-up pixels.
        try:
            import ctypes
            ctypes.windll.shcore.SetProcessDpiAwareness(1)
        except (AttributeError, OSError):
            pass
    root = tk.Tk()
    App(root)
    root.mainloop()


if __name__ == "__main__":
    main()
