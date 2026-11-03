# Graph Report - scratch  (2026-11-02)

## Corpus Check
- 127 files · ~49,102 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 12 file(s) not represented in the graph (top: (none) 5, .log 2, .ico 2)

## Summary
- 972 nodes · 2191 edges · 54 communities (41 shown, 13 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 95 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b3d1d8de`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- getDb
- Moodboard Board Actions
- lib/auth.ts
- Account & Inbox Pages
- Tech stack: local development first
- Admin Pages & Image FS
- HookHub Agent Guidance
- my-app Dependencies
- igdl CLI Tests
- Python Security Guidelines
- igdl Downloader & Rate Limits
- igdl Desktop GUI
- Postgres Docker Compose
- my-app TS Config
- web-app TS Config
- runner.py
- HookHub UI Components
- web-app Runtime Deps
- igdl Argument Parsing
- devDependencies
- Moodboard DB Schema
- schedule.py
- EXIF Hashtag Tagging
- Tagging Tests
- web-app/package.json
- web-app npm Scripts
- my-app Root Layout
- ESLint Configs
- web-app Root Layout
- bootstrap.py
- App
- run_all
- admin/payments/page.tsx
- test_runner.py
- pg Types
- Store
- HEIC Type Shim
- igdl Package
- actions/auth.ts
- store.py
- account.ts
- test_store.py
- test_schedule.py
- Download pipeline
- images.ts
- F7: Client notifications (email)
- ig-scheduler: daily downloads for a list of Instagram users
- test_security.py
- getCurrentUser
- Inspiration (Undecided/Accepted/Rejected)
- .update_settings
- drizzle-kit
- typescript@^5
- igsched

## God Nodes (most connected - your core abstractions)
1. `getDb()` - 88 edges
2. `Store` - 29 edges
3. `drizzle-orm` - 29 edges
4. `App` - 23 edges
5. `requireAdmin()` - 22 edges
6. `getCurrentUser` - 22 edges
7. `assertAdmin()` - 21 edges
8. `App` - 17 edges
9. `compilerOptions` - 16 edges
10. `compilerOptions` - 16 edges

## Surprising Connections (you probably didn't know these)
- `Tag (#word, lowercase)` --semantically_similar_to--> `Caption hashtags written to EXIF XPKeywords Tags`  [INFERRED] [semantically similar]
  web-app/SPEC.md → ig-scraper/README.md
- `Frontend web development persona guidelines` --semantically_similar_to--> `Python cybersecurity-tool development guidelines`  [INFERRED] [semantically similar]
  web-app/memory/frontend/CLAUDE.md → ig-scraper/memory/python/CLAUDE.md
- `log()` --calls--> `strip_control()`  [INFERRED]
  ig-scheduler/src/igsched/runner.py → ig-scraper/src/igdl/security.py
- `normalize_username()` --calls--> `is_valid_username()`  [INFERRED]
  ig-scheduler/src/igsched/store.py → ig-scraper/src/igdl/security.py
- `main()` --calls--> `normalize_username()`  [INFERRED]
  ig-scheduler/main-program.py → ig-scheduler/src/igsched/store.py

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **HookHub static data pipeline (hooks.json → validation → getHooks → page → cards)** — my_app_memory_spec_claude_hooks_json, my_app_memory_spec_claude_build_time_validation, my_app_memory_spec_claude_gethooks, my_app_memory_spec_claude_home_page, my_app_memory_spec_claude_hookcard [EXTRACTED 1.00]
- **igdl package modules (cli, downloader, tags, security) plus GUI** — ig_scraper_readme_cli_module, ig_scraper_readme_downloader_module, ig_scraper_readme_tags_module, ig_scraper_readme_security_module, ig_scraper_readme_gui_window [EXTRACTED 1.00]
- **CLAUDE.md @-imported guidance files** — my_app_claude_claude_md, my_app_agents_nextjs_agent_rules, my_app_memory_frontend_claude_expert_persona, my_app_memory_spec_claude_hookhub_spec [EXTRACTED 1.00]
- **Client page feature set (Inspirations, adds, comments, shoot photos, downloads)** — web_app_spec_f3_client_page_inspirations, web_app_spec_f4_client_adds_photos, web_app_spec_f5_comments, web_app_spec_f6_shoot_photos, web_app_spec_f8_downloads [INFERRED 0.85]
- **Local-first modules designed to be swapped for production services** — web_app_claude_storage_module, web_app_claude_payment_provider, web_app_claude_mail_notify, web_app_claude_getdb, web_app_claude_local_first [INFERRED 0.85]

## Communities (54 total, 13 thin omitted)

### Community 0 - "getDb"
Cohesion: 0.17
Nodes (33): addInspirationsAction(), adminSendMessageAction(), createClientAction(), createPageAction(), createPaymentAction(), deletePageAction(), deletePhotoAction(), deleteShootPhotoAction() (+25 more)

### Community 1 - "Moodboard Board Actions"
Cohesion: 0.07
Nodes (65): AccountPage(), metadata, addCommentAction(), checkTarget(), clientAddInspirationsAction(), CommentTarget, getCommentsAction(), id (+57 more)

### Community 2 - "lib/auth.ts"
Cohesion: 0.10
Nodes (24): nextConfig, drizzle-orm, server-only, metadata, ClientsPage(), metadata, metadata, InboxPage() (+16 more)

### Community 3 - "Account & Inbox Pages"
Cohesion: 0.15
Nodes (22): FormState, ForgotPage(), metadata, LoginPage(), metadata, Home(), metadata, SetupPage() (+14 more)

### Community 4 - "Tech stack: local development first"
Cohesion: 0.15
Nodes (17): Next.js agent rules (breaking-change version, read node_modules/next/dist/docs), getDb() Drizzle client (lib/db/index.ts), Image processing (lib/images.ts), Email (lib/mail.ts, lib/notify.ts, /admin/outbox), Moodboard CLAUDE.md guide, Next.js 16.4 App Router (cacheComponents off), Playwright e2e tests (e2e/moodboard.spec.ts), Storage module (lib/storage.ts) (+9 more)

### Community 5 - "Admin Pages & Image FS"
Cohesion: 0.08
Nodes (26): nodemailer, linkify(), metadata, OutboxPage(), findMail(), fixture(), FIXTURES, linkIn() (+18 more)

### Community 6 - "HookHub Agent Guidance"
Cohesion: 0.08
Nodes (25): Bundled Next.js Docs (node_modules/next/dist/docs), Next.js Agent Rules (AGENTS.md), my-app CLAUDE.md, npm dev/build/lint Commands, @/* Path Alias, Global Route Prop Types (LayoutProps), Next.js 16 / React 19 / TS strict / Tailwind v4 Stack, Web Development Expert Persona (+17 more)

### Community 7 - "my-app Dependencies"
Cohesion: 0.08
Nodes (32): dependencies, next@16.4.3, react@19.3.0, react-dom@19.3.0, devDependencies, eslint@^9, eslint-config-next@16.4.3, tailwindcss@^4 (+24 more)

### Community 8 - "igdl CLI Tests"
Cohesion: 0.10
Nodes (16): _fake_feed(), _posts(), _rate_controller(), test_describe_error_maps_instaloader_errors(), test_images_only_by_default_and_limit_counts_images(), test_limit_includes_pinned_post_when_recent_enough(), test_limit_must_be_positive(), test_limit_skips_old_pinned_posts() (+8 more)

### Community 9 - "Python Security Guidelines"
Cohesion: 0.12
Nodes (12): OWASP Testing Guide / NIST SP 800-115 / FastAPI docs, Python cybersecurity-tool development guidelines, cli.py (argument parsing, exit codes), downloader.py (build_loader, download_user), igdl exit codes, Desktop GUI window (main-program.py, tkinter), igdl: Instagram post downloader, instaloader (+4 more)

### Community 10 - "igdl Downloader & Rate Limits"
Cohesion: 0.09
Nodes (13): _err(), main(), build_loader(), download_user(), DownloadStopped, format_pause(), _install_safe_logging(), error() (+5 more)

### Community 12 - "Postgres Docker Compose"
Cohesion: 0.09
Nodes (21): environment, healthcheck, image, ports, restart, volumes, POSTGRES_DB, POSTGRES_PASSWORD (+13 more)

### Community 13 - "my-app TS Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 14 - "web-app TS Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 16 - "HookHub UI Components"
Cohesion: 0.24
Nodes (13): Home(), CATEGORY_STYLES, HookCard(), countLabel(), HookGrid(), CATEGORIES, Category, CONTRIBUTE_URL (+5 more)

### Community 17 - "web-app Runtime Deps"
Cohesion: 0.11
Nodes (18): bcryptjs, @electric-sql/pglite, heic-convert, pg, dependencies, bcryptjs@^3.0.3, drizzle-orm@^0.45.4, @electric-sql/pglite@^0.5.14 (+10 more)

### Community 18 - "igdl Argument Parsing"
Cohesion: 0.13
Nodes (7): _headless_say(), main(), parse_args(), build_parser(), describe_error(), parse_args(), positive_int()

### Community 19 - "devDependencies"
Cohesion: 0.11
Nodes (17): @playwright/test, tsx, @types/archiver, devDependencies, eslint@^9, eslint-config-next@16.4.3, @playwright/test@^1.64.1, tailwindcss@^4 (+9 more)

### Community 20 - "Moodboard DB Schema"
Cohesion: 0.12
Nodes (14): accountTokens, clientPages, clients, comments, inspirations, messages, notifications, paymentRequests (+6 more)

### Community 21 - "schedule.py"
Cohesion: 0.18
Nodes (13): build_command(), cron_line(), find_cron_line(), install(), merge_crontab(), parse_time(), _read_crontab(), _run() (+5 more)

### Community 22 - "EXIF Hashtag Tagging"
Cohesion: 0.22
Nodes (6): pid_alive(), _decode_xp(), _encode_xp(), read_tags(), tag_post_images(), write_tags()

### Community 23 - "Tagging Tests"
Cohesion: 0.23
Nodes (9): _download_one(), fake_download_post(), make_jpeg(), test_download_leaves_tags_alone_when_caption_off(), test_download_writes_hashtags_when_caption_on(), test_extract_hashtags(), test_tag_post_images_single_and_carousel(), test_write_and_read_tags_round_trip() (+1 more)

### Community 24 - "web-app/package.json"
Cohesion: 0.17
Nodes (11): archiver, @types/nodemailer, archiver@^8.0.0, @tailwindcss/turbopack@^4, @types/nodemailer@^8.0.2, @types/react-dom@^19, @tailwindcss/turbopack, @types/react-dom (+3 more)

### Community 25 - "web-app npm Scripts"
Cohesion: 0.29
Nodes (7): scripts, build, db:generate, dev, lint, start, test:e2e

### Community 26 - "my-app Root Layout"
Cohesion: 0.33
Nodes (3): geistMono, geistSans, metadata

### Community 28 - "web-app Root Layout"
Cohesion: 0.33
Nodes (3): geistMono, geistSans, metadata

### Community 29 - "bootstrap.py"
Cohesion: 0.15
Nodes (10): _ask_console(), _ask_gui(), ensure_ready(), has_tkinter(), in_venv(), _install(), missing_modules(), _relaunch() (+2 more)

### Community 31 - "run_all"
Cohesion: 0.13
Nodes (9): exit_code(), make_logger(), log(), _media_files(), open_log(), run_all(), run_headless(), RunLock (+1 more)

### Community 32 - "admin/payments/page.tsx"
Cohesion: 0.17
Nodes (16): AccountLayout(), AccountHome(), AccountPayments(), metadata, ClientDetail(), metadata, PaymentsPage(), StatusBadge() (+8 more)

### Community 33 - "test_runner.py"
Cohesion: 0.16
Nodes (14): Blocked, describe(), FakeLoader, context, make_download(), NotFound, run(), test_downloads_every_user_with_limit() (+6 more)

### Community 35 - "Store"
Cohesion: 0.20
Nodes (6): Store, change(), store(), test_other_process_changes_not_lost(), test_record_result(), test_remove()

### Community 38 - "actions/auth.ts"
Cohesion: 0.24
Nodes (16): completeAccountTokenAction(), email, firstError(), loginAction(), logoutAction(), password, requestResetAction(), setupAdminAction() (+8 more)

### Community 39 - "store.py"
Cohesion: 0.17
Nodes (6): _clean(), default_settings(), normalize_username(), valid_time(), test_helpers(), is_valid_username()

### Community 40 - "account.ts"
Cohesion: 0.23
Nodes (12): zod, AccountMessages(), metadata, clientSendMessageAction(), currentClient(), startPaymentAction(), ConversationPage(), MessageThread() (+4 more)

### Community 41 - "test_store.py"
Cohesion: 0.24
Nodes (5): store(), test_add_persists_across_restarts(), test_bad_entries_dropped(), test_corrupt_file_backed_up(), test_duplicates_ignored()

### Community 43 - "Download pipeline"
Cohesion: 0.20
Nodes (7): Download pipeline, piexif (EXIF writer), tags.py (extract_hashtags, write_tags), F2: Search photos by tag, F4: Client adds tagged photos, Grid requirements, Tag (#word, lowercase)

### Community 44 - "images.ts"
Cohesion: 0.22
Nodes (7): file-type, sharp, ALLOWED, MAX_UPLOAD_BYTES, StoredImage, file-type@^22.3.0, sharp@^0.35.5

### Community 45 - "F7: Client notifications (email)"
Cohesion: 0.25
Nodes (9): PaymentProvider interface (lib/payments.ts), Session auth (lib/auth.ts, mb_session cookie), F10: Messaging, F11: Payments, F5: Comments, F7: Client notifications (email), F9: Client accounts (optional, invite email), Open questions (payment provider, download lock, attachments) (+1 more)

### Community 46 - "ig-scheduler: daily downloads for a list of Instagram users"
Cohesion: 0.25
Nodes (8): Caveats, Command line, Daily run, Files, ig-scheduler: daily downloads for a list of Instagram users, Start, Tests, The window

### Community 48 - "getCurrentUser"
Cohesion: 0.54
Nodes (5): POST(), POST(), getCurrentUser, storeImage(), UploadError

### Community 49 - "Inspiration (Undecided/Accepted/Rejected)"
Cohesion: 0.40
Nodes (6): Client page access key (lib/access.ts, t:<token> / p:<pageId>), F1: Upload and tag photos, F3: Client page Inspirations (private link /c/<token>), F6: Client page Shoot Photos (Your Photos), F8: Downloads (Shoot Photos yes, Inspirations no), Inspiration (Undecided/Accepted/Rejected)

## Knowledge Gaps
- **17 isolated node(s):** `igsched`, `igdl`, `Next.js 16.4 App Router (cacheComponents off)`, `F5: Comments`, `Grid requirements` (+12 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 324 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **13 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `drizzle-orm` connect `lib/auth.ts` to `admin/payments/page.tsx`, `getDb`, `Moodboard Board Actions`, `actions/auth.ts`, `account.ts`, `getCurrentUser`, `web-app Runtime Deps`, `Moodboard DB Schema`, `web-app/package.json`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Are the 12 inferred relationships involving `Store` (e.g. with `main()` and `App`) actually correct?**
  _`Store` has 12 INFERRED edges - model-reasoned connections that need verification._
- **What connects `igsched`, `igdl`, `Next.js 16.4 App Router (cacheComponents off)` to the rest of the system?**
  _17 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Moodboard Board Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.07001044932079414 - nodes in this community are weakly interconnected._
- **Why does `getDb()` connect `getDb` to `admin/payments/page.tsx`, `Moodboard Board Actions`, `lib/auth.ts`, `Account & Inbox Pages`, `actions/auth.ts`, `account.ts`, `getCurrentUser`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Should `lib/auth.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10404040404040404 - nodes in this community are weakly interconnected._
- **Why does `Store` connect `Store` to `store.py`, `test_store.py`, `runner.py`, `igdl Argument Parsing`, `.update_settings`, `App`, `run_all`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._