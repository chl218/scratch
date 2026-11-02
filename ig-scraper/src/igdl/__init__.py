"""igdl - download an Instagram user's posts.

Modules:
  cli.py         command-line parsing, login choice, error -> exit code mapping
  downloader.py  instaloader setup, login methods, the download loop
  security.py    pure helpers for cookies, secrets and untrusted text

See README.md for usage and the architecture diagrams.
"""

__version__ = "0.1.0"  # shown by `igdl --version`; keep in sync with pyproject.toml
