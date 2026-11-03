# Graph Report - scratch  (2026-11-02)

## Corpus Check
- Corpus is ~42,471 words - fits in a single context window. You may not need a graph.

## Summary
- 769 nodes · 1759 edges · 38 communities (27 shown, 11 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 40 edges (avg confidence: 0.84)
- Token cost: 137,273 input · 7,000 output

## Community Hubs (Navigation)
- Moodboard Pages & ORM
- Moodboard Board Actions
- Photo Upload API Routes
- Account & Inbox Pages
- Moodboard Spec & Architecture
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
- igdl Entry & Security Tests
- HookHub UI Components
- web-app Runtime Deps
- igdl Argument Parsing
- web-app Dev Tooling
- Moodboard DB Schema
- igdl Error Handling
- EXIF Hashtag Tagging
- Tagging Tests
- web-app Package Meta
- web-app npm Scripts
- my-app Root Layout
- ESLint Configs
- web-app Root Layout
- PGlite Connection
- Playwright E2E
- Archiver Dependency
- Nodemailer Dependency
- tsx Dependency
- pg Types
- Tailwind Turbopack
- HEIC Type Shim
- igdl Package

## God Nodes (most connected - your core abstractions)
1. `getDb()` - 88 edges
2. `drizzle-orm` - 29 edges
3. `getCurrentUser` - 22 edges
4. `requireAdmin()` - 22 edges
5. `assertAdmin()` - 21 edges
6. `App` - 17 edges
7. `compilerOptions` - 16 edges
8. `compilerOptions` - 16 edges
9. `LibraryPicker()` - 14 edges
10. `SubmitButton()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Tag (#word, lowercase)` --semantically_similar_to--> `Caption hashtags written to EXIF XPKeywords Tags`  [INFERRED] [semantically similar]
  web-app/SPEC.md → ig-scraper/README.md
- `Frontend web development persona guidelines` --semantically_similar_to--> `Python cybersecurity-tool development guidelines`  [INFERRED] [semantically similar]
  web-app/memory/frontend/CLAUDE.md → ig-scraper/memory/python/CLAUDE.md
- `LoginForm()` --indirect_call--> `loginAction()`  [INFERRED]
  web-app/components/AuthForms.tsx → web-app/app/actions/auth.ts
- `SetupForm()` --indirect_call--> `setupAdminAction()`  [INFERRED]
  web-app/components/AuthForms.tsx → web-app/app/actions/auth.ts
- `ForgotForm()` --indirect_call--> `requestResetAction()`  [INFERRED]
  web-app/components/AuthForms.tsx → web-app/app/actions/auth.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **igdl package modules (cli, downloader, tags, security) plus GUI** — ig_scraper_readme_cli_module, ig_scraper_readme_downloader_module, ig_scraper_readme_tags_module, ig_scraper_readme_security_module, ig_scraper_readme_gui_window [EXTRACTED 1.00]
- **Local-first modules designed to be swapped for production services** — web_app_claude_storage_module, web_app_claude_payment_provider, web_app_claude_mail_notify, web_app_claude_getdb, web_app_claude_local_first [INFERRED 0.85]
- **Client page feature set (Inspirations, adds, comments, shoot photos, downloads)** — web_app_spec_f3_client_page_inspirations, web_app_spec_f4_client_adds_photos, web_app_spec_f5_comments, web_app_spec_f6_shoot_photos, web_app_spec_f8_downloads [INFERRED 0.85]
- **HookHub static data pipeline (hooks.json → validation → getHooks → page → cards)** — my_app_memory_spec_claude_hooks_json, my_app_memory_spec_claude_build_time_validation, my_app_memory_spec_claude_gethooks, my_app_memory_spec_claude_home_page, my_app_memory_spec_claude_hookcard [EXTRACTED 1.00]
- **CLAUDE.md @-imported guidance files** — my_app_claude_claude_md, my_app_agents_nextjs_agent_rules, my_app_memory_frontend_claude_expert_persona, my_app_memory_spec_claude_hookhub_spec [EXTRACTED 1.00]

## Communities (38 total, 11 thin omitted)

### Community 0 - "Moodboard Pages & ORM"
Cohesion: 0.06
Nodes (85): nextConfig, drizzle-orm, zod, AccountLayout(), AccountHome(), metadata, AccountPayments(), metadata (+77 more)

### Community 1 - "Moodboard Board Actions"
Cohesion: 0.08
Nodes (58): addCommentAction(), checkTarget(), clientAddInspirationsAction(), CommentTarget, getCommentsAction(), id, searchLibraryAction(), setInspirationStateAction() (+50 more)

### Community 2 - "Photo Upload API Routes"
Cohesion: 0.11
Nodes (27): server-only, AccountPage(), metadata, POST(), POST(), metadata, PrivateLinkPage(), GET() (+19 more)

### Community 3 - "Account & Inbox Pages"
Cohesion: 0.11
Nodes (26): AccountMessages(), metadata, ConversationPage(), metadata, ForgotPage(), metadata, LoginPage(), metadata (+18 more)

### Community 4 - "Moodboard Spec & Architecture"
Cohesion: 0.08
Nodes (36): Next.js agent rules (breaking-change version, read node_modules/next/dist/docs), Client page access key (lib/access.ts, t:<token> / p:<pageId>), getDb() Drizzle client (lib/db/index.ts), Image processing (lib/images.ts), Email (lib/mail.ts, lib/notify.ts, /admin/outbox), Moodboard CLAUDE.md guide, Next.js 16.4 App Router (cacheComponents off), PaymentProvider interface (lib/payments.ts) (+28 more)

### Community 5 - "Admin Pages & Image FS"
Cohesion: 0.09
Nodes (25): sharp, ClientsPage(), InboxPage(), metadata, AdminLayout(), linkify(), metadata, OutboxPage() (+17 more)

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
Cohesion: 0.09
Nodes (15): OWASP Testing Guide / NIST SP 800-115 / FastAPI docs, Python cybersecurity-tool development guidelines, cli.py (argument parsing, exit codes), Download pipeline, downloader.py (build_loader, download_user), igdl exit codes, Desktop GUI window (main-program.py, tkinter), igdl: Instagram post downloader (+7 more)

### Community 10 - "igdl Downloader & Rate Limits"
Cohesion: 0.11
Nodes (6): build_loader(), download_user(), DownloadStopped, format_pause(), _PauseAwareRateController, extract_hashtags()

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
Nodes (18): bcryptjs, file-type, heic-convert, pg, dependencies, bcryptjs@^3.0.3, drizzle-orm@^0.45.4, file-type@^22.3.0 (+10 more)

### Community 18 - "igdl Argument Parsing"
Cohesion: 0.16
Nodes (4): build_parser(), parse_args(), positive_int(), is_valid_username()

### Community 19 - "web-app Dev Tooling"
Cohesion: 0.12
Nodes (15): drizzle-kit, @types/nodemailer, devDependencies, drizzle-kit@^0.31.11, eslint@^9, eslint-config-next@16.4.3, tailwindcss@^4, @types/node@^20 (+7 more)

### Community 20 - "Moodboard DB Schema"
Cohesion: 0.12
Nodes (14): accountTokens, clientPages, clients, comments, inspirations, messages, notifications, paymentRequests (+6 more)

### Community 21 - "igdl Error Handling"
Cohesion: 0.16
Nodes (8): describe_error(), _err(), main(), _install_safe_logging(), error(), log(), strip_control(), test_unprintable_characters_dont_crash_output()

### Community 22 - "EXIF Hashtag Tagging"
Cohesion: 0.27
Nodes (5): _decode_xp(), _encode_xp(), read_tags(), tag_post_images(), write_tags()

### Community 23 - "Tagging Tests"
Cohesion: 0.23
Nodes (9): _download_one(), fake_download_post(), make_jpeg(), test_download_leaves_tags_alone_when_caption_off(), test_download_writes_hashtags_when_caption_on(), test_extract_hashtags(), test_tag_post_images_single_and_carousel(), test_write_and_read_tags_round_trip() (+1 more)

### Community 24 - "web-app Package Meta"
Cohesion: 0.20
Nodes (9): @types/archiver, @types/archiver@^8.0.0, @types/react@^19, @types/react-dom@^19, @types/react, @types/react-dom, name, private (+1 more)

### Community 25 - "web-app npm Scripts"
Cohesion: 0.29
Nodes (7): scripts, build, db:generate, dev, lint, start, test:e2e

### Community 26 - "my-app Root Layout"
Cohesion: 0.33
Nodes (3): geistMono, geistSans, metadata

### Community 28 - "web-app Root Layout"
Cohesion: 0.33
Nodes (3): geistMono, geistSans, metadata

### Community 29 - "PGlite Connection"
Cohesion: 0.67
Nodes (3): @electric-sql/pglite, connect(), @electric-sql/pglite@^0.5.14

## Knowledge Gaps
- **16 isolated node(s):** `igdl`, `piexif (EXIF writer)`, `Resumable downloads (skip existing files)`, `OWASP Testing Guide / NIST SP 800-115 / FastAPI docs`, `Next.js agent rules (breaking-change version, read node_modules/next/dist/docs)` (+11 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 255 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `drizzle-orm` connect `Moodboard Pages & ORM` to `Moodboard Board Actions`, `Photo Upload API Routes`, `Account & Inbox Pages`, `Admin Pages & Image FS`, `web-app Runtime Deps`, `Moodboard DB Schema`, `web-app Package Meta`, `PGlite Connection`?**
  _High betweenness centrality (0.051) - this node is a cross-community bridge._
- **What connects `igdl`, `piexif (EXIF writer)`, `Resumable downloads (skip existing files)` to the rest of the system?**
  _16 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Moodboard Pages & ORM` be split into smaller, more focused modules?**
  _Cohesion score 0.05946281633286757 - nodes in this community are weakly interconnected._
- **Why does `getDb()` connect `Moodboard Pages & ORM` to `Moodboard Board Actions`, `Photo Upload API Routes`, `Account & Inbox Pages`, `Admin Pages & Image FS`, `PGlite Connection`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Should `Moodboard Board Actions` be split into smaller, more focused modules?**
  _Cohesion score 0.08049334631613113 - nodes in this community are weakly interconnected._
- **Why does `server-only` connect `Photo Upload API Routes` to `Moodboard Pages & ORM`, `Moodboard Board Actions`, `Account & Inbox Pages`, `Admin Pages & Image FS`, `web-app Runtime Deps`, `web-app Package Meta`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Should `Photo Upload API Routes` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._