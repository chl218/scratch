# ReferenceMePlzQQ — Specification

**Version:** 0.6 (draft) · **Last updated:** 2026-11-02

ReferenceMePlzQQ is a web app for a small photography studio. The studio's admins keep a tagged library of **Reference Pictures**: their own work and pictures saved from the web. Each client gets a private page where they accept or reject Reference Pictures before their shoot. After the shoot the same page holds only the **photos taken of them**, ready to favourite and download.

The public side of the site shows off the studio: a portfolio mosaic of the studio's own work, a Meet the Team page, and a Book page with each admin's availability.

**Beta scope:** the beta is used among friends. Client accounts come from admin invites only (no self sign-up), and there are no payments. Both are listed in §9 Later.

> The folder, package and code keep the working name `moodboard` / `web-app`. "ReferenceMePlzQQ" is the name users see.

---

## 1. Roles

| Role | How they get in | Can do |
|------|-----------------|--------|
| **Super Admin** | The first account, created by the setup command (`/setup` on first run) | Everything an Admin can do, plus approve or decline admin invites and disable admins |
| **Admin** | Invited by another admin, approved by the Super Admin | Manage the library, clients, client pages, Shoot Photos, the portfolio, their team profile, their availability and bookings; comment; message clients; invite clients and admins |
| **Client (logged in)** | Invited by an admin (F9) | Everything a link visitor can do, plus comment, message the studio, book, reschedule and cancel |
| **Client (via link)** | Opens a client page's private link. No login | Accept or reject Reference Pictures, add pictures from the library search, favourite and download their Shoot Photos, read comments |
| **Visitor** | No login, no link | Browse the portfolio, Meet the Team and the Book calendar; use the contact form |

- There is exactly **one Super Admin**. It cannot be disabled, deleted or handed to another account.
- All admins share access: every admin can see and manage every client, page, conversation and booking. Records keep which admin did what.
- Each client has **one or more assigned admins** (§3 F12). Assignment decides who gets that client's emails and who the client sees as their contacts. It does not limit access.
- Clients see admins by **name** with a "Studio" label, never as "Admin".
- A private link is enough to choose references, favourite and download. **Commenting, messaging and booking need a login.**
- Clients shall never upload, edit or delete photos.
- Clients shall only see their own pages, messages and bookings.

## 2. Glossary

- **Reference Picture**: a picture in the studio's library, used to show a client a look, pose or mood. It is the studio's own work or saved from the web (with a credit). (Called "Inspiration" before v0.6.)
- **Library**: all Reference Pictures.
- **Tag**: a label written as `#word` (e.g. `#portrait`, `#moody`), stored in lowercase.
- **Client**: a person the studio works with. Has a name, an email, a username and optionally an account.
- **Username**: a client's short address, e.g. `jdoe`, used in `/u/<username>`.
- **Client Page**: a private page for one shoot, reached by a secret link. A client can have several.
- **Board**: the Reference Pictures on a client page. Each is **Undecided**, **Accepted** or **Rejected**.
- **Lock**: what happens to a client page when its Shoot Photos are made visible (F6).
- **Shoot Photo**: a photo taken of the client at their session.
- **Favourite**: a client's ♥ on a Shoot Photo.
- **Portfolio**: the photos shown publicly on the landing page.
- **Comment**: a note on a photo on a client page.
- **Message**: a note in the private conversation between the studio and one client.
- **Session Type**: a kind of shoot that can be booked (e.g. "Portrait, 1 h").
- **Booking**: a confirmed time slot for a client with one admin.

---

## 3. Features

Feature numbers are kept from earlier versions so tests and history still match.

### F1: Upload and tag Reference Pictures (Admin)

- Admins can upload one or more pictures at once.
- Each picture has: title, notes, tags, and the optional **Source URL** and **Credit** (e.g. "@someone on Instagram") for pictures saved from the web. Studio-made pictures leave both blank.
- Web pictures are saved locally first and uploaded like any other file. There is no "Import from URL".
- Tags are entered as `#word`, stored in lowercase, and can be edited after upload.
- Files go to file storage; metadata goes in the database.

**Upload limits** (also used for Shoot Photos, F6)

- Sized for a 30.4 MP full-frame sensor (6720 × 4480 px); full-size JPEGs are about 8–15 MB.
- **Maximum file size: 50 MB.** Larger files are rejected with a clear message.
- **Accepted formats:** JPEG (`.jpg`, `.jpeg`), PNG, WebP, AVIF, HEIC/HEIF. HEIC/HEIF is converted to JPEG on upload.
- **Not accepted:** RAW files (`.CR2`, `.CR3`, `.NEF`, `.ARW`, etc.).
- The server checks the real file type (file contents), not just the extension.
- The original is kept. The app generates a **thumbnail** (~400 px long edge) and a **preview** (~2000 px long edge).
- **All metadata (EXIF, GPS, camera serials, XMP) is removed** from every image a client or visitor receives: thumbnails, previews and downloaded Shoot Photo originals.

**Deleting**

- Any admin can delete a picture from the library. A confirmation lists the client pages that use it ("Used on 3 client pages: Anna – Engagement, …").
- Deleting removes the files, the picture's comments, and its rows on boards that are **not** locked.
- On **locked** pages, the Accepted row stays as a **name-only record** (its snapshot, F6), with no image.

### F2: Search the library by tag (Admin)

- Admins can filter the library by one or more tags. **All tags must match.**
- Results use the working grid (§4).

### F3: Client page: the Board

- Admins can create a client page for a client (new or existing) with: name (e.g. "Engagement shoot"), shoot date, notes, and a chosen set of Reference Pictures. Booking also creates pages (F15).
- Each page has a **private link** (`/c/<token>`). The link does not expire. Admins can revoke or regenerate it. Revoking does not affect the client's account.
- The client sees the Board in the working grid and marks each picture **Accept** or **Reject** with the marks described in §5.
- Choices **save immediately**. There is no submit step.
- Filter pills: **All**, **Accepted**, **Rejected**, **Undecided**, each with a count.
  - Rejected pictures stay under Rejected so the client can review and accept them later.
  - The client can change a picture's state at any time until the page locks.
- Rejecting never deletes anything. Clients cannot remove pictures from the Board; they can only reject.
- Admins can **hide** a picture from one page (it stays in the library).
- Admins see the client's current choices.

### F4: Client adds pictures from the library

- The library search lives in the client area (F17), not on the client page.
- Clients can search the **whole library** by tag (all tags must match).
- Before a page locks, each result has an **"Add to ‹page name›"** button. Added pictures behave like admin-chosen ones.
- After a page locks, results are view-only for that page.
- The client's own saved Accepted references (F6) are marked "Your reference" and shown first, including name-only records for deleted pictures.
- Adding pictures does not send a notification.

### F5: Comments

- Admins and **logged-in** clients can comment on any photo on a client page (Board and Shoot Photos).
- Link visitors can **read** comments. Where the comment box would be, they see "Log in to comment", or "Ask the studio for an invite" if the client has no account yet.
- Each comment shows who wrote it (the admin's name with a "Studio" label, or the client's name) and when.

### F6: Client page: Shoot Photos and the lock

- After the shoot, admins upload that session's photos to the page (F1 limits).
- Admins choose when **Your Photos** becomes visible. Making it visible **locks** the page:
  1. Every **Accepted** picture is saved as a **snapshot**: original file name, title, tags and date accepted. The snapshot survives library deletes.
  2. **All** Reference Pictures are hidden from the page (Undecided, Rejected and Accepted).
  3. Adding from the library to this page is turned off.
- A locked page shows **only Your Photos** and a Home button to the landing page.
- Clients can find their saved references again through the library search (F4).
- An admin can **unlock** a page (Your Photos hidden again), which shows the hidden Board as it was.
- Admins can tag Shoot Photos (`#word`, same tags as the library) so portfolio photos can be searched (F13).

**Favourites**

- Clients (logged in or via link) can ♥ any Shoot Photo.
- Filter pills: **All**, **Favourites**.
- An admin can set an optional **favourites limit** per page (e.g. "Choose up to 20 for editing"). At the limit, the client must remove a ♥ before adding one.
- Admins see favourite counts and can filter by them.

### F7: Notifications

All email. Uploading or changing several things at once sends **one** email.

**To the client**

- An admin adds Reference Pictures to their Board (not pictures the client added).
- Your Photos becomes visible, or new Shoot Photos are added after that.
- An admin sends a message.
- A booking is confirmed, rescheduled or cancelled (F15).
- Photo emails include the page's private link.

**To admins**

Emails about a client go to that client's **assigned admins and the Super Admin**. Each admin can turn each type off in their settings.

- The client sends a message.
- **Activity digest**: the client's choices, comments and favourites, sent as one email after **30 minutes** with no further activity.
- The client books, reschedules or cancels.
- Contact form submissions go to **all admins** (F16).
- Admin invites waiting for approval go to the Super Admin (F12).

Admins also see an "unseen activity" badge on each page in the admin area.

### F8: Downloads

- Once Your Photos is visible, the client can download **all** their Shoot Photos at original quality, one at a time or all at once as a `.zip`. Metadata is removed (F1).
- Clients can never download Reference Pictures: no download button, and only preview and thumbnail sizes are ever sent. (This stops normal downloading, not screenshots.)
- The server checks every file request: a link or account only gives access to that client's photos.

### F9: Client accounts

- Accounts are created **by invite only** in the beta. When an admin adds a client (name and email), they can send an invite email, and the client sets a password from it.
- An account is optional. Private links keep working either way.
- Clients can reset a forgotten password by email.
- Admins can disable a client account.

### F10: Messaging

- Each client has **one conversation** with the studio. Any admin can reply in it.
- Text only, no attachments.
- Messages show the sender (admin name with "Studio", or the client's name) and time, with unread messages marked.
- Admins have an inbox listing all conversations, unread first, plus the Contact inbox (F16).
- Messaging needs the client to be logged in.

### F11: Payments: not in the beta

Payment requests, deposits and paid downloads are moved to §9 Later. The payments module (`lib/payments.ts`) and the `payment_requests` table stay in the codebase; the screens and actions were removed.

### F12: Admins, approvals and assignment

- The first account is created by the setup command and becomes the **Super Admin**.
- **Any admin can invite an admin.** Invites from a regular admin are **Pending** until the Super Admin approves them. The invite email goes out only after approval. If the Super Admin declines, the invite is deleted and the inviter sees "Declined". The Super Admin's own invites need no approval.
- Only the Super Admin can disable an admin.
- **Assigned admins:** each client has one or more. The admin who creates the client is assigned by default. Any admin can add or remove assignments, but at least one must remain.
- When an admin is disabled, they are removed from their clients. A client left with no assigned admin gets the Super Admin.

### F13: Landing page and portfolio (public)

- `/` is public and shows off the studio's work.
- **What can be in the portfolio:** admins flag photos with **Show in portfolio**:
  - Shoot Photos (the studio's contract gives the studio the rights, so no client consent step is needed)
  - library pictures with **no Credit** (the studio's own work)
  - Pictures with a Credit can never be flagged.
- **Mosaic:** up to **24** flagged photos, chosen at random and **shuffled on every visit**, laid out as an interlocking grid (§4) across the full width.
- Each photo has an admin-set **focus point** (default: centre) that guides how it is cropped into its tile.
- Tapping a photo opens it full screen with Back and Next. No comments.
- **Search bar** above the mosaic: searches **only portfolio photos** by tag (all tags must match).
  - Suggestions show only tags used on portfolio photos, so private library tags never appear.
  - Results replace the mosaic: all matches, newest first, same grid, no 24 limit.
  - Clearing the search returns to a new shuffle.
- Empty state (nothing flagged yet): a short line inviting visitors to Meet the Team and Book.
- Navigation on every public page: Work (landing), Meet the Team, Book, Contact, and Log in or the client's area (F17).

### F14: Meet the Team (public)

- Each admin has a **team profile**: photo, display name, role title (e.g. "Lead photographer"), short bio, experience (years and specialties), and a **Show on team page** switch.
- Each admin edits their own profile. The Super Admin can edit all profiles and sets the order.
- Only admins have profiles.

### F15: Booking

- `/book` can be **browsed by anyone**. **Booking needs a logged-in client.** Visitors who aren't logged in see the Contact form (F16) instead of a Book button.
- **Session types** (set by admins): name, length, description. No price in the beta.
- **Availability:** each admin sets weekly working hours (e.g. Tue–Sat 9:00–17:00) and time off (dates or ranges). Confirmed bookings take time away. A **buffer** (default 30 min) is kept between bookings.
- All times are in **one studio time zone**, set by the Super Admin and shown on the calendar ("Times shown in Pacific Time").
- **Flow:** pick a session type, then a day; the calendar shows the start times where the whole session fits and **who is free** at each. Pick a person or **Anyone available**.
  - Anyone available goes to the free admin with the **fewest bookings that week**, ties broken by team page order.
- Bookings are **confirmed instantly**. A booking:
  1. creates a client page named "‹Session type› – ‹date›" with that shoot date
  2. adds the booked admin to the client's assigned admins
  3. emails the client, their assigned admins and the Super Admin
- **Changes:** clients can reschedule or cancel from their area up to **48 hours** before the shoot (adjustable in studio settings). After that they message the studio. Admins can reschedule or cancel any booking.
- Calendar sync (Google, Outlook) is in §9 Later.

### F16: Contact form

- A form on the public pages: name, email, message.
- Submissions are emailed to all admins and saved in the admin **Contact inbox**.
- A logged-in client's submission goes into their message conversation (F10) instead.
- Spam protection: a hidden trap field, and at most **5 submissions per hour** from one IP address.

### F17: Client area (`/u/<username>`)

- **Username:** first initial plus last name, lowercase, plain a–z: John Doe → `jdoe`.
  - Accents are removed and other characters dropped: José Núñez → `jnunez`, Mary-Kate O'Brien → `mobrien`.
  - Several last names: use the last word (Ana María García López → `alopez`). One name only: use it (`cher`).
  - Duplicates get a number: `jdoe`, `jdoe2`, `jdoe3`.
  - It stays the same when the client's name changes. Admins can edit it by hand.
- **Who can open it:** the logged-in client, or anyone whose browser has opened one of that client's valid private links (the browser keeps those links in a cookie). Revoking or regenerating the link removes that browser's access. Link visitors see only the pages whose links they opened.
- Visiting another client's address shows "not found", the same as an address that doesn't exist.
- **Contents:** their client pages, the library search (F4), and for logged-in clients their messages (F10), bookings (F15) and settings.

---

## 4. Grids

Two layouts, chosen by what the grid is for.

**Working grid**: library, search results, Board, Your Photos, the client area.

- **Justified rows**: each row fills the width, photos keep their true aspect ratio (from the stored width and height), nothing is cropped. Nothing a client is choosing is ever cropped.
- Responsive: target row height ~180 px on phones, ~260 px on desktop.
- Each photo shows its state mark (where relevant), ♥ (Shoot Photos) and a comment count.
- Tapping a photo opens a larger view with its comments.

**Portfolio mosaic**: the landing page (F13) only.

- An interlocking CSS grid packed with no gaps between tiles. **Portrait** photos fill **1 column × 2 rows**, **landscape** photos **2 columns × 1 row**, square photos 1 × 1.
- 6 columns on desktop, 4 on tablet, 2 on phone. Photos are cropped to their tile around their focus point.
- Photos fill the first empty cell in reading order. A landscape photo that would overhang a gap or the edge takes a square there, so there are never holes.
- In the shuffled mosaic the ragged last row is removed (tall photos crossing it become squares), so the mosaic ends in a clean edge.
- The search bar shows the 8 most used portfolio tags; the rest fold under "More tags".

---

## 5. Design

The design follows the `frontend-design` skill: brief, then a plan, reviewed against the brief before building.

### Brief

- **Subject:** a small photography studio run by friends, and the act of choosing reference images.
- **Audiences:** (1) visitors and friends browsing the portfolio, team and booking pages; (2) clients choosing references and collecting their photos, mostly on phones; (3) admins managing the library and pages on a desktop.
- **Primary job:** let the photographs speak. The public site shows the studio's eye; the client page makes choosing and collecting feel personal.

### Concept: the light table

Photographers have always chosen images on a light table: prints and contact sheets laid flat on a bright surface, marked by hand with a red grease pencil. Everything in the app sits on that surface. Photos are prints: square corners, no frames, no cards. The **grease-pencil marks** are the one bold element; everything else stays quiet.

### Colour

| Token | Hex | Use |
|-------|-----|-----|
| `table` | `#F3F6F8` | Page background: cool, backlit white |
| `sheet` | `#FFFFFF` | Raised surfaces: dialogs, inputs, the admin's tables |
| `graphite` | `#1F2529` | Text and primary buttons |
| `loupe` | `#66717A` | Secondary text, placeholders |
| `sleeve` | `#D5DCE1` | Borders and dividers |
| `marker` | `#D0262E` | The grease pencil: the Accept circle, the ♥, focus rings, the active pill |

**Dark mode** (follows the system setting; a theme switch overrides it): a darkroom mid-grey, never black.

| Token | Hex |
|-------|-----|
| `table` | `#3C4044` |
| `sheet` | `#484D52` |
| `graphite` | `#F1F3F4` |
| `loupe` | `#B5BCC2` |
| `sleeve` | `#5A6066` |
| `marker` | `#FF5A5F` |

- Errors use graphite text with a ⚠ icon and a `marker` left border, so they read as "fix this" without looking like the Accept mark.
- Text colours meet WCAG AA contrast on `table` and `sheet` in both modes.

### Type

- **One family: Archivo** (Google Fonts, variable, width axis 62–125), loaded with `next/font`.
  - **Display** (wordmark, page titles, client page name): Archivo **condensed** (width 62–75), weight 800, tight tracking. It echoes the condensed lettering printed along film edges.
  - **Body and UI**: Archivo, normal width (100), weight 400; 600 for buttons and names.
- **Scale** (classic, Bringhurst-style): 12 · 14 · 16 · 18 · 21 · 24 · 36 · 48 · 72 px. Body text 16/1.5. Lines under 70 characters.
- Sentence case everywhere. No all-caps labels, no eyebrows above headings, no monospace labels.

### The marks (the one bold element)

- **Accept:** a hand-drawn red circle (`marker`, ~3 px stroke, slightly uneven, not closed) around the photo's centre.
- **Reject:** a hand-drawn ✕ across the photo in `graphite` with a thin white edge so it shows on any photo. The photo dims to 45% opacity.
- **Undecided:** no mark.
- Marks are SVG paths with a few variations, picked per photo so they don't look stamped.
- **Motion:** when tapped, the mark draws itself (stroke animation, ~250 ms). This is the only animation besides opening and closing views. With reduced motion, marks appear without animation.
- The Accept and Reject buttons sit under the larger view and on each tile (phone: a two-button bar under the tile; desktop: shown on hover and keyboard focus).

### Layout

Content is **left aligned**. Photos run edge to edge where they are the content (mosaic, Your Photos); everything else sits in a 1200 px column with a 16 px gutter on phones.

Landing page (desktop):

```
┌──────────────────────────────────────────────────────────────┐
│ ReferenceMePlzQQ                Work  Team  Book  Contact  Log in │
│ [ Search the studio's work: #portrait #golden…            ]  │
├──────────────────────────────────────────────────────────────┤
│ ┌─────────┐┌───┐┌─────────┐┌───┐                             │
│ │ land    ││ p ││ land    ││ p │   interlocking mosaic,      │
│ └─────────┘│ o │└─────────┘│ o │   full width, no gaps,      │
│ ┌───┐┌───┐│ r │┌───┐┌────┐│ r │   reshuffled each visit     │
│ │ p ││ p │└───┘│ p ││ sq │└───┘                             │
│ │   ││   │┌─────┤   │└────┘┌───┐                            │
│ └───┘└───┘│ ... └───┘      │...│                            │
└──────────────────────────────────────────────────────────────┘
```

Client page, before lock (phone):

```
┌──────────────────────┐
│ ‹ Home               │
│ Engagement shoot     │  ← condensed display
│ Sat 14 Nov · Jack    │
│ (All 24)(Accepted 6) │
│ (Rejected 3)(Undec…) │
├──────────────────────┤
│ ┌────────┐┌───────┐  │  justified rows
│ │  (○)   ││  ╳    │  │  ○ = red circle, ╳ = dimmed
│ └────────┘└───────┘  │
│ [Accept] [Reject]    │
└──────────────────────┘
```

Client page, after lock: the page name, then Your Photos edge to edge, with ♥ on each tile, the pills All / Favourites, and a "Download all" button at the top.

Admin area: the same tokens and type, but dense. Tables on `sheet`, a left sidebar (Library, Clients, Pages, Inbox, Bookings, Team, Settings), small controls, no marks except on the Board view.

### Principles

1. **Photos first.** Chrome recedes; no card, border or shadow around a photo.
2. **One bold thing.** The grease-pencil marks. If something else starts competing, cut it.
3. **Square prints, soft tools.** Photos have square corners; controls (buttons, inputs, pills) have a 6 px radius.
4. **Motion answers people.** Nothing moves unless someone did something.
5. **Plain words.** Buttons say what happens ("Accept", "Add to Engagement shoot", "Download all"). Empty screens say what to do next.
6. **Quality floor:** works at 360 px wide, visible keyboard focus (`marker` ring), reduced motion respected, AA contrast.

### Review against generic defaults

- First instinct was Geist or Inter on stone greys (what v0.5 uses). Changed to Archivo with its condensed width, which ties to film-edge lettering.
- Avoided the warm-cream-and-terracotta look: the surface is a cool, backlit white, and the only accent is grease-pencil red.
- Avoided the card kit: photos sit directly on the table with no cards.
- Avoided near-black dark mode: dark mode is darkroom mid-grey.
- Avoided template chrome: no eyebrows, no all-caps labels, no monospace data labels, no "→" on buttons, and no numbered markers (photos aren't a sequence).

---

## 6. Data model (draft)

| Table | Purpose / key fields |
|-------|----------------------|
| `users` | All accounts: email, password hash, role (`admin` / `client`), `is_super_admin`, name, disabled, email preferences |
| `sessions` | Login sessions (hashed tokens) |
| `admin_invites` | Name, email, invited_by, status (`pending` / `approved` / `declined`), decided_at |
| `account_tokens` | One-time tokens: purpose (`invite` / `admin_invite` / `reset`), client, user or admin invite, expires_at, used_at. The token for an admin invite is only created once it is approved |
| `team_profiles` | Admin user, display name, role title, bio, years of experience, specialties, portrait file, visible, sort order |
| `clients` | Name, email, **username** (unique), optional `user_id` |
| `client_admins` | Client ↔ assigned admin user (at least one per client) |
| `photos` | Library pictures: file paths, title, notes, `source_url`, `credit`, width, height, size, `in_portfolio`, focus x/y, uploaded_at |
| `tags` | Unique lowercase tag names |
| `photo_tags` | Photo ↔ tag |
| `client_pages` | Client, name, shoot date, notes, link token, `shoot_photos_visible` (= locked), locked_at, favourites limit, optional booking |
| `reference_pictures` | Client page, photo (nullable once deleted from the library), state (`undecided` / `accepted` / `rejected`), `added_by` (`admin` / `client`), hidden_at, snapshot (file name, title, tags), accepted_at. Renamed from `inspirations` |
| `shoot_photos` | Client page, file paths (including the metadata-free copy clients download), width, height, `favourite`, `in_portfolio`, focus x/y, notified, uploaded_at |
| `shoot_photo_tags` | Shoot photo ↔ tag |
| `comments` | Client page, photo (reference picture or shoot photo), author user, body, created_at |
| `activity_events` | Client page, kind (accepted / rejected / undecided / comment / favourite / added), digested_at: what goes into the next activity digest (F7) |
| `messages` | Client, sender user, body, created_at, read_at |
| `contact_messages` | Name, email, body, hashed IP, created_at, handled_at |
| `session_types` | Name, length (minutes), description, active, sort order |
| `availability_rules` | Admin, weekday, start time, end time |
| `time_off` | Admin, start, end |
| `bookings` | Client, admin, session type, starts_at, ends_at, status (`confirmed` / `cancelled`), client page, created_at |
| `studio_settings` | Single row: time zone, booking buffer (minutes), cancel cutoff (hours), digest delay (minutes) |
| `notifications` | Recipient, type, sent_at, status: a record of emails sent |
| `payment_requests` | Kept from v0.5; unused in the beta |

---

## 7. Tech stack: local development first

Everything runs locally for now. Moving to production later should mean changing settings, not rewriting code.

| Part | Choice | Notes |
|------|--------|-------|
| App | **Next.js 16 (App Router) + TypeScript + Tailwind CSS** | One codebase for UI and API. `npm run dev` |
| Fonts | **Archivo** via `next/font/google` | Replaces Geist (§5) |
| Database | **PostgreSQL 17 in Docker** (`docker compose up -d`) when `DATABASE_URL` is set; otherwise **PGlite** in `.data/` | Same SQL either way. e2e tests use PGlite |
| Database access | **Drizzle ORM** | Typed schema; migrations apply automatically on start |
| Login | Built-in email + password sessions | bcrypt; session tokens stored hashed. Role checked on every admin route; Super Admin checked on approval and admin-disable routes |
| Client page access | Long random token in the URL | Works without login; revocable |
| Photo files | **Local disk** (`web-app/uploads/`, git-ignored) via the storage module | Swappable for cloud storage later |
| Image processing | **sharp** (+ `heic-convert`) | Thumbnails, previews, HEIC→JPEG, metadata removal |
| Validation | **Zod** | All form and API input |
| Email | **Nodemailer** + **Mailpit** in Docker | Without `SMTP_URL`, emails go to `.mail/` and `/admin/outbox` |
| Testing | **Playwright**, headless | e2e walk through the features (`npm run test:e2e`), plus phone and desktop screenshots to check the design |

Implementation notes:

- Server actions are limited to 1 MB bodies, so uploads go through route handlers, one file per request.
- The rename from Inspirations to Reference Pictures covers UI, code and database (migration `0001` renames the table and keeps existing data; the first admin becomes the Super Admin).
- The activity digest runs on a timer started from `instrumentation.ts` (every minute; `DIGEST_POLL_MS` overrides it).
- `npm run seed:references` loads Reference Pictures listed in `seed/references.json` through the normal upload processing.

---

## 8. Open questions

None in the beta scope.

## 9. Later (not in v0.6)

- Self sign-up for clients (with email verification and linking to existing client records)
- Payments: provider (Stripe, Square, PayPal), deposits at booking, payment requests, locking downloads until paid, prices on session types
- Calendar sync (Google, Outlook)
- Import Reference Pictures from a URL
- Hosting, cloud file storage, a hosted database, an email provider

---

## 10. Changelog

- **v0.6 (2026-11-02):** Renamed the product ReferenceMePlzQQ and Inspirations to **Reference Pictures**. Beta for friends: no self sign-up, no payments (F11 moved to Later). Several admins with a **Super Admin** who approves admin invites; clients have one or more assigned admins. New public landing page with a shuffled portfolio mosaic and portfolio search (F13), Meet the Team (F14), booking with per-admin availability and instant confirmation (F15), contact form (F16), and client areas at `/u/<username>` (F17). Client page now **locks** when Your Photos is shown: Accepted references are saved as snapshots and the Board is hidden. Library search moved to the client area. Commenting needs a login. Favourites on Shoot Photos. Downloads open as soon as Your Photos is visible. All metadata removed from images sent to clients. Reference Pictures get Source URL and Credit. Multi-tag search matches all tags. Added §5 Design (light table, grease-pencil marks, Archivo).
- **v0.5 (2026-11-02):** Docker is now set up: Postgres 17 and Mailpit run from `docker-compose.yml`. PGlite and the file outbox remain as fallbacks and are used by the e2e tests.
- **v0.4 (2026-11-02):** first version built. PGlite instead of Postgres in Docker, built-in sessions instead of Auth.js, local email outbox instead of Mailpit. Client pages also have a name (e.g. "Engagement shoot").
- **v0.3 (2026-11-02):** added F9 (client accounts, optional), F10 (messaging), F11 (payments).
- **v0.2 (2026-11-02):** added F7 (email notifications) and F8 (downloads: Shoot Photos yes, Inspirations no).
- **v0.1 (2026-11-01):** initial spec. F1–F6, data model draft, local tech stack.
