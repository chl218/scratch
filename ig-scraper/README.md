# igdl: Instagram post downloader

A terminal tool that downloads an Instagram user's posts into a local folder, along with each post's caption and metadata. By default it saves **images only**. Add `--videos` to include videos. It is built on [instaloader](https://instaloader.github.io/).

## Install

**PowerShell / cmd:**

```powershell
cd ig-scraper
python -m venv .venv
.venv\Scripts\pip install -e .[dev]
.venv\Scripts\activate          # then run igdl directly
```

**Git Bash** (use forward slashes, because bash treats `\` as an escape character):

```bash
cd ig-scraper
python -m venv .venv
source .venv/Scripts/activate   # then pip and igdl work directly
pip install -e ".[dev]"
```

On macOS or Linux, use `.venv/bin/activate` instead of `.venv/Scripts/activate`.

After activating, `igdl --help` should print the options. Run `deactivate` to leave the environment.

## Usage

```powershell
igdl USERNAME [-o DIR] [--cookies BROWSER | --sessionid | --login IG_USER]
              [--limit N] [--videos] [--no-metadata] [-q]
```

Examples:

```powershell
igdl natgeo --limit 10                # newest 10 image posts -> downloads/natgeo/
igdl natgeo --limit 10 --videos       # newest 10 posts, videos included
igdl natgeo -o D:\ig                  # all image posts -> D:\ig\natgeo\
igdl natgeo --cookies firefox         # use your Firefox login (recommended)
igdl some_private_friend --sessionid  # paste your session cookie at a hidden prompt
```

### Images vs. videos

| | Default (images only) | With `--videos` |
|---|---|---|
| Photo posts | saved | saved |
| Video and reel posts | skipped (not counted toward `--limit`) | `.mp4` + cover image |
| Video slides in a carousel | skipped | `.mp4` + cover image |

`--limit N` gives the N most recent posts by date. A profile can pin up to 3 posts, and Instagram always lists them first, so the tool reads 3 extra posts and keeps the N newest. Pinned posts are only included if they're among the N newest. Without `--limit`, everything is downloaded, pinned posts included.

### Output files

Each post is saved as `<username>_YYYY-MM-DD_HH-MM-SS_<shortcode>`, for example `natgeo_2026-11-01_23-53-04_DfN9Oosk9s2_1.jpg`, with these files:
- `.jpg` (and `.mp4` with `--videos`): the media. Carousels get `_1`, `_2`, … suffixes.
- `.txt`: the caption.
- `.json`: the full post metadata.

Re-running the command skips files that already exist, so an interrupted download can be resumed.

## Login

Without login, Instagram often returns only a few posts or blocks requests. There are three ways to log in. The first two never give the tool your password, and they save nothing to disk.

| Option | How it works | Password typed into igdl? |
|--------|--------------|---------------------------|
| `--cookies BROWSER` | Reads your existing Instagram login from a browser | No |
| `--sessionid` | Uses a session cookie you copy from the browser | No |
| `--login IG_USER` | Asks for your password and saves a session file | Yes (fallback only) |

When you log out of Instagram in the browser, the session ends, and with it the tool's access.

### Option 1: `--cookies` (recommended)

1. Open **Firefox** and log in at https://www.instagram.com. Finish any 2FA step there.
2. Run:
   ```powershell
   igdl natgeo --cookies firefox
   ```
   The tool prints `Using firefox session for @your_account` and starts downloading.

Supported browsers are `firefox`, `chrome`, `edge`, `brave`, `chromium`, `opera`, `opera_gx`, `vivaldi`, `librewolf` and `safari`.

> **Chrome, Edge and Brave on Windows:** newer versions encrypt their cookies so that other programs can't read them. If `--cookies chrome` fails or says "no Instagram session found" even though you're logged in, use Firefox or Option 2.
>
> If your browser uses a non-default profile, point to its cookie database with `--cookie-file`. In Firefox, the profile folder is listed at `about:profiles`, and the file is `cookies.sqlite` in that folder.

### Option 2: `--sessionid` (copy the cookie by hand)

This works with any browser.

**Get the session cookie:**

1. Log in at https://www.instagram.com in your browser.
2. Press **F12** to open Developer Tools.
3. Open the storage panel:
   - **Chrome / Edge / Brave:** **Application** tab → **Storage** → **Cookies** → `https://www.instagram.com`
   - **Firefox:** **Storage** tab → **Cookies** → `https://www.instagram.com`
4. Find the row named **`sessionid`** and double-click its **Value** cell to select it. Copy it (Ctrl+C). It looks like `1234567890%3AAbCdEf...`.
5. Close Developer Tools.

**Use it.** Either paste it at the hidden prompt, where nothing is shown or saved:

```powershell
igdl natgeo --sessionid
Paste sessionid (hidden):
```

or set it for the current terminal session only:

```powershell
$env:IGDL_SESSIONID = "<paste here>"
igdl natgeo --sessionid
Remove-Item Env:IGDL_SESSIONID     # clear it when done
```

> **Treat `sessionid` like a password.** Anyone who has it can use your Instagram account until you log out. Don't paste it into files, chats or commit messages. If it leaks, log out of Instagram in the browser and the cookie stops working.

### Option 3: `--login` (fallback)

`--login IG_USER` asks for the password (and a 2FA code if needed). It saves a session file in `%LOCALAPPDATA%\Instaloader\` so later runs don't ask again. That file is **not encrypted**, so prefer Options 1 or 2.

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | success |
| 1 | profile not found |
| 2 | private profile, or login required |
| 3 | login failed (bad password, or missing/expired session cookie) |
| 4 | rate-limited or blocked by Instagram |
| 130 | interrupted (Ctrl+C) |

## Caveats

- Scraping goes against Instagram's Terms of Service. Use this tool for your own account or for accounts you have permission to archive.
- Logging in with your main account can get it flagged. Consider a secondary account.
- Without login, Instagram often returns only a few posts or answers with 401/429 errors. Wait and retry, or log in with `--cookies`.
