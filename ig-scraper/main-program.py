#!/usr/bin/env python3
"""Desktop window for igdl, the Instagram post downloader.

Run it from the ig-scraper folder:
    python main-program.py      (Windows)
    python3 main-program.py     (macOS / Linux)

It uses only the Python standard library (tkinter) on top of the igdl package,
so the window does exactly what the `igdl` command does:
  - every command-line option has a checkbox (or a field enabled by one),
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
from tkinter import filedialog, messagebox, scrolledtext, simpledialog, ttk

HERE = Path(__file__).resolve().parent
# Make `import igdl` work even if the package wasn't installed with `pip install -e .`.
sys.path.insert(0, str(HERE / "src"))

try:
    from instaloader.exceptions import LoginException

    from igdl import cli, downloader
    from igdl.security import is_valid_username, strip_control
except ImportError as missing:
    # Most likely instaloader / browser_cookie3 aren't installed for this Python.
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
      ("ask", prompt, secret, answer, ev)   show a dialog, put the reply in answer, set ev
      ("done", text, ok)                    the run finished (ok=False on error)
    """

    def __init__(self, root: tk.Tk) -> None:
        self.root = root
        self.messages: queue.Queue = queue.Queue()
        self.stop_requested = threading.Event()
        self.worker: threading.Thread | None = None

        root.title("igdl - Instagram post downloader")
        root.minsize(620, 560)

        # ---- Form values (tkinter variables are bound to the widgets below) ----
        self.username = tk.StringVar()
        self.output_dir = tk.StringVar(value=str(Path.cwd() / "downloads"))
        self.use_limit = tk.BooleanVar(value=False)
        self.limit = tk.StringVar(value=DEFAULT_LIMIT)
        self.videos = tk.BooleanVar(value=False)       # --videos
        self.metadata = tk.BooleanVar(value=True)      # inverse of --no-metadata
        self.use_browser = tk.BooleanVar(value=False)  # --cookies BROWSER
        self.browser = tk.StringVar(value="firefox")
        self.cookie_file = tk.StringVar()              # --cookie-file (optional)
        self.use_sessionid = tk.BooleanVar(value=False)  # --sessionid
        self.sessionid = tk.StringVar(value=os.environ.get(cli.SESSIONID_ENV, ""))
        self.use_password = tk.BooleanVar(value=False)   # --login IG_USER
        self.login_user = tk.StringVar()
        self.password = tk.StringVar()
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
            opts, text="Save captions and metadata (.txt / .json)", variable=self.metadata
        ).grid(row=2, column=0, columnspan=3, sticky="w")

        # Login: three methods, at most one checked (see _pick_login)
        login = ttk.LabelFrame(main, text="Login (optional, pick one)", padding=8)
        login.grid(row=3, column=0, columnspan=3, sticky="ew", **pad)
        login.columnconfigure(2, weight=1)

        ttk.Checkbutton(
            login, text="Use my browser's Instagram login (recommended)",
            variable=self.use_browser, command=lambda: self._pick_login(self.use_browser),
        ).grid(row=0, column=0, columnspan=4, sticky="w")
        ttk.Label(login, text="Browser:").grid(row=1, column=1, sticky="w", padx=(20, 4))
        self.browser_box = ttk.Combobox(
            login, textvariable=self.browser, values=cli.BROWSERS, state="readonly", width=12
        )
        self.browser_box.grid(row=1, column=2, sticky="w")
        ttk.Label(login, text="Cookie file (optional):").grid(row=2, column=1, sticky="w", padx=(20, 4))
        self.cookie_entry = ttk.Entry(login, textvariable=self.cookie_file)
        self.cookie_entry.grid(row=2, column=2, sticky="ew")
        self.cookie_button = ttk.Button(login, text="Browse…", command=self._pick_cookie_file)
        self.cookie_button.grid(row=2, column=3, padx=(4, 0))

        ttk.Checkbutton(
            login, text="Use a session ID cookie",
            variable=self.use_sessionid, command=lambda: self._pick_login(self.use_sessionid),
        ).grid(row=3, column=0, columnspan=4, sticky="w", pady=(8, 0))
        ttk.Label(login, text="Session ID:").grid(row=4, column=1, sticky="w", padx=(20, 4))
        # show="•" hides the secret on screen, like a password field.
        self.sessionid_entry = ttk.Entry(login, textvariable=self.sessionid, show="•")
        self.sessionid_entry.grid(row=4, column=2, columnspan=2, sticky="ew")

        ttk.Checkbutton(
            login, text="Log in with username and password (saves a session file)",
            variable=self.use_password, command=lambda: self._pick_login(self.use_password),
        ).grid(row=5, column=0, columnspan=4, sticky="w", pady=(8, 0))
        ttk.Label(login, text="Your username:").grid(row=6, column=1, sticky="w", padx=(20, 4))
        self.login_user_entry = ttk.Entry(login, textvariable=self.login_user)
        self.login_user_entry.grid(row=6, column=2, columnspan=2, sticky="ew")
        ttk.Label(login, text="Password:").grid(row=7, column=1, sticky="w", padx=(20, 4))
        self.password_entry = ttk.Entry(login, textvariable=self.password, show="•")
        self.password_entry.grid(row=7, column=2, columnspan=2, sticky="ew")
        ttk.Label(
            login, text="Leave the password empty to reuse a saved session.", foreground="gray"
        ).grid(row=8, column=2, columnspan=2, sticky="w")

        # Buttons
        buttons = ttk.Frame(main)
        buttons.grid(row=4, column=0, columnspan=3, sticky="w", **pad)
        self.start_button = ttk.Button(buttons, text="Download", command=self._start)
        self.start_button.grid(row=0, column=0, padx=(0, 6))
        self.stop_button = ttk.Button(buttons, text="Stop", command=self._stop, state="disabled")
        self.stop_button.grid(row=0, column=1, padx=(0, 6))
        ttk.Button(buttons, text="Open folder", command=self._open_folder).grid(row=0, column=2)
        self.root.bind("<Return>", lambda _e: self._start())

        # Log output + status line
        self.log_box = scrolledtext.ScrolledText(main, height=12, wrap="word", state="disabled")
        self.log_box.grid(row=5, column=0, columnspan=3, sticky="nsew", **pad)
        main.rowconfigure(5, weight=1)
        ttk.Label(main, textvariable=self.status).grid(row=6, column=0, columnspan=3, sticky="w", **pad)

    # ------------------------------------------------------------- form logic

    def _pick_login(self, chosen: tk.BooleanVar) -> None:
        """Login methods are mutually exclusive: checking one unchecks the others."""
        if chosen.get():
            for var in (self.use_browser, self.use_sessionid, self.use_password):
                if var is not chosen:
                    var.set(False)
        self._refresh_states()

    def _refresh_states(self) -> None:
        """Enable only the fields whose checkbox is ticked."""
        def enable(widget, on: bool, normal: str = "normal") -> None:
            widget.configure(state=normal if on else "disabled")

        enable(self.limit_box, self.use_limit.get())
        enable(self.browser_box, self.use_browser.get(), normal="readonly")
        enable(self.cookie_entry, self.use_browser.get())
        enable(self.cookie_button, self.use_browser.get())
        enable(self.sessionid_entry, self.use_sessionid.get())
        enable(self.login_user_entry, self.use_password.get())
        enable(self.password_entry, self.use_password.get())

    def _pick_output_dir(self) -> None:
        folder = filedialog.askdirectory(initialdir=self.output_dir.get() or str(Path.cwd()))
        if folder:
            self.output_dir.set(folder)

    def _pick_cookie_file(self) -> None:
        path = filedialog.askopenfilename(
            title="Browser cookie database",
            filetypes=[("Cookie databases", "*.sqlite Cookies"), ("All files", "*.*")],
        )
        if path:
            self.cookie_file.set(path)

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

        settings = {
            "username": username,
            "output": Path(output),
            "limit": limit,
            "videos": self.videos.get(),
            "metadata": self.metadata.get(),
            "login": None,
        }
        if self.use_browser.get():
            settings["login"] = ("browser", self.browser.get(), self.cookie_file.get().strip() or None)
        elif self.use_sessionid.get():
            if not self.sessionid.get().strip():
                return self._invalid("Paste your session ID, or untick that login option.")
            settings["login"] = ("sessionid", self.sessionid.get())
        elif self.use_password.get():
            login_user = self.login_user.get().strip().lstrip("@")
            if not is_valid_username(login_user):
                return self._invalid("Enter the Instagram username to log in with.")
            settings["login"] = ("password", login_user, self.password.get())
            # Don't keep the password on screen after use. A saved session
            # means it isn't needed next time.
            self.password.set("")
        return settings

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
        # Checked by download_user before each post; the current post finishes first.
        self.stop_requested.set()
        self.status.set("Stopping after the current post…")
        self.stop_button.configure(state="disabled")

    def _run_download(self, s: dict) -> None:
        """Runs on the download thread. Mirrors cli.main(), but reports through messages."""
        log = lambda text: self.messages.put(("log", text))
        try:
            # quiet=True silences instaloader's per-file console output; our own
            # progress lines ([1/10] ...) still come through `log`.
            loader = downloader.build_loader(
                s["output"], videos=s["videos"], metadata=s["metadata"], quiet=True
            )
            # Route instaloader's non-fatal warnings to the log box too.
            loader.context.error = lambda msg, repeat_at_end=True: log(f"warning: {msg}")

            method = s["login"]
            if method is None:
                log("No login: Instagram may only show some posts.")
            elif method[0] == "browser":
                _, browser, cookie_file = method
                cookies = downloader.read_browser_cookies(browser, cookie_file)
                who = downloader.login_with_cookies(loader, cookies)
                log(f"Using {browser} session for @{who}")
            elif method[0] == "sessionid":
                who = downloader.login_with_sessionid(loader, method[1])
                log(f"Using session for @{who}")
            else:
                _, login_user, password = method
                downloader.login(
                    loader, login_user,
                    # Empty field: ask only if Instagram actually needs the password.
                    ask_password=lambda u: password or self._ask(f"Instagram password for {u}:", secret=True),
                    ask_2fa=lambda: self._ask("Two-factor code:", secret=False),
                    log=log,
                )
                log(f"Logged in as @{login_user}")

            count = downloader.download_user(
                loader, s["username"], s["limit"], log=log,
                should_stop=self.stop_requested.is_set,
            )
            self.messages.put(("done", f"Done. {count} post(s) saved to {s['output'] / s['username']}", True))
        except Exception as e:  # noqa: BLE001 - every failure must reach the window
            known = cli.describe_error(e, s["username"])
            text = known[1] if known else f"Unexpected error: {e!r}"
            self.messages.put(("done", text, False))

    def _ask(self, prompt: str, secret: bool) -> str:
        """Called from the download thread: ask the main thread to show a dialog, then wait."""
        answer: dict = {}
        answered = threading.Event()
        self.messages.put(("ask", prompt, secret, answer, answered))
        answered.wait()
        if not answer.get("value"):
            raise LoginException("login cancelled.")
        return answer["value"]

    # --------------------------------------------------- main-thread plumbing

    def _poll_messages(self) -> None:
        """Handle everything the download thread has sent since the last check."""
        try:
            while True:
                msg = self.messages.get_nowait()
                kind = msg[0]
                if kind == "log":
                    self._append_log(msg[1])
                elif kind == "ask":
                    _, prompt, secret, answer, answered = msg
                    answer["value"] = simpledialog.askstring(
                        "igdl", prompt, show="•" if secret else None, parent=self.root
                    )
                    answered.set()
                elif kind == "done":
                    _, text, ok = msg
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
