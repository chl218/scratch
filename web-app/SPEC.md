# Moodboard — Specification

**Version:** 0.5 (draft) · **Last updated:** 2026-11-02

Moodboard is a web app for photoshoot sessions. The admin (photographer) keeps a tagged library of reference photos and gives each client a private page. On that page the client chooses **Inspirations**: reference photos they accept or reject before the shoot. After the shoot, the same page shows the **photos taken of them**. Clients also have an account for **messaging** the photographer and **paying**.

---

## 1. Roles

| Role | Access | Can do |
|------|--------|--------|
| **Admin** | Logs in with an admin account | Upload and tag photos, search the library, create client pages, upload shoot photos, comment, message clients, request payments |
| **Client (via link)** | No login. Opens a client page with its private link | Accept or reject Inspirations, search tags and add photos to their Inspirations, comment, download their Shoot Photos |
| **Client (logged in)** | Logs in with a client account | Everything above for their own pages, plus message the admin and pay |

- The private link alone shall be enough to use the client page. Logging in is **never required** for selection, comments or downloads.
- The client account is mainly for **messaging** (F10) and **payments** (F11).
- The client **shall not** upload, edit, or delete photos.
- The client **shall** only see their own client pages and their own messages and payments.

## 2. Glossary

- **Photo**: an image uploaded by the admin, with metadata and tags.
- **Tag**: a label written as `#word` (e.g. `#portrait`, `#moody`, `#blackandwhite`).
- **Client**: a person the admin works with. Has a name and email, and optionally an account.
- **Client Page**: a private page for one shoot, reached by a secret link. A client can have several.
- **Inspiration**: a reference photo on a client page. It is in one state: **Undecided**, **Accepted**, or **Rejected**.
- **Shoot Photo**: a photo taken of the client during their session.
- **Comment**: a note on a photo, written by the admin or the client.
- **Message**: a private note in the conversation between the admin and a client (not tied to a photo).
- **Payment Request**: an amount the admin asks a client to pay.

---

## 3. Features

### F1: Upload and tag photos (Admin)

- The admin shall be able to upload one or more photos at once.
- Each photo shall have metadata: title, notes, and tags.
- Tags shall be entered as `#word`, stored in lowercase, and editable after upload.
- Files shall go to file storage; metadata shall go in the database.

**Upload limits**

- Sized for a 30.4 MP full-frame sensor (6720 × 4480 px). Full-size JPEGs from such a camera are about 8–15 MB.
- **Maximum file size: 50 MB.** Larger files shall be rejected with a clear message.
- **Accepted formats:** JPEG (`.jpg`, `.jpeg`), PNG, WebP, AVIF, HEIC/HEIF.
  - HEIC/HEIF shall be converted to JPEG on upload so every browser can show it.
- **Not accepted:** RAW files (`.CR2`, `.CR3`, `.NEF`, `.ARW`, etc.).
- The server shall check the real file type (file contents), not just the extension.
- The original file shall be kept. The app shall generate:
  - a **thumbnail** (~400 px, long edge) for grids
  - a **preview** (~2000 px, long edge) for the large view

### F2: Search photos by tag (Admin)

- The admin shall be able to filter the library by one or more tags.
- Results shall show in a grid (see §4).

### F3: Client page: Inspirations

- The admin shall be able to create a client page for a client (new or existing), with: shoot date, notes, and a chosen set of photos.
- Creating a page shall produce a **private link** (`/c/<token>`).
  - The link shall **not expire**.
  - The admin shall be able to revoke or regenerate the link.
  - Revoking a link shall not affect the client's account access (F9).
- The client shall see their Inspirations in a **grid** and mark each photo **Accept** or **Reject**.
- Choices shall **save immediately**. There is no submit step.
- Filter pills shall be shown: **All · Accepted · Rejected · Undecided**.
  - Rejected photos stay in the **Rejected** pill so the client can review them and accept them later.
  - The client shall be able to change a photo's state at any time.
- The admin shall see the client's current choices.

### F4: Client adds tagged photos

- On their page, the client shall be able to search the **whole library** by any tag.
- The client shall be able to add photos from the results to their Inspirations.
- Added photos shall behave the same as photos the admin chose (accept, reject, comment).
- The client shall not be able to upload photos.

### F5: Comments

- The admin and the client shall be able to comment on any photo on a client page (Inspirations and Shoot Photos).
- Each comment shall show who wrote it (**Admin** or the client's name) and when.

### F6: Client page: Shoot Photos

- After the shoot, the admin shall be able to upload that session's photos to the client's page (same upload limits as F1).
- They shall appear in a second section/tab, **"Your Photos"**, on the same private link.
- The admin shall control when this section becomes visible to the client.

### F7: Client notifications

- The client shall be notified by **email** when:
  - the admin adds new Inspirations
  - new Shoot Photos are added, once the "Your Photos" section is visible (making the section visible also sends a notification)
  - the admin sends a new message (F10)
  - the admin creates a payment request (F11)
- The admin shall be notified by email when a client sends a message or pays.
- Uploading several photos at once shall send **one** email, not one per photo.
- Photo emails shall include the client page's private link.
- Photos the client adds themselves (F4) shall not trigger a notification.

### F8: Downloads

- The client shall be able to **download their Shoot Photos** at full (original) quality, one at a time or all at once as a `.zip`.
- The client shall **not** be able to download **Inspiration** (reference) photos:
  - There shall be no download button on Inspirations.
  - Clients shall only receive the preview and thumbnail sizes of reference photos, never the original file.
  - Note: this stops normal downloading, but it can't stop screenshots.
- The server shall check every file request: a client link or account only gives access to that client's photos.

### F9: Client accounts

- When the admin adds a client (name + email), the admin shall be able to send an **invite email**. The client sets a password from the invite link.
- Creating an account shall be **optional** for the client. Their private links keep working either way.
- A logged-in client shall see a dashboard with:
  - all their client pages (no link needed)
  - their messages (F10)
  - their payment requests (F11)
- Clients shall be able to reset a forgotten password by email.
- The admin shall be able to disable a client account.

### F10: Messaging

- Each client shall have **one conversation** with the admin.
- The admin and a logged-in client shall be able to send text messages in that conversation.
- Messages shall show who sent them and when, with unread messages marked.
- The admin shall have an inbox listing all client conversations, with unread ones first.
- Messages are separate from photo comments (F5): comments are about a specific photo; messages are general.
- Messaging requires the client to be logged in.

### F11: Payments

- The admin shall be able to create a **payment request** for a client: amount, currency, description (e.g. "Deposit", "Final balance"), and optionally the client page it's for.
- A logged-in client shall see their payment requests and pay them.
- Each request shall have a status: **Pending**, **Paid**, or **Cancelled**.
- The admin shall see all payment requests and their statuses.
- Payment card details shall **never** be stored by Moodboard; a payment provider handles them.
- **Local development:** no provider is connected yet. The admin can mark a request as Paid by hand. Payment code shall sit behind a small payments module so a provider can be connected later without other code changes.

---

## 4. Grid requirements

These apply to every photo grid (library, search results, Inspirations, Your Photos):

- Responsive layout that works on phone and desktop.
- Each photo shows its current state (where relevant) and a comment count.
- Tapping a photo opens a larger view with its comments.

---

## 5. Data model (draft)

| Table | Purpose / key fields |
|-------|----------------------|
| `users` | All accounts: email, password hash, role (`admin` / `client`), name, disabled |
| `clients` | Name, email, optional `user_id` (set once the client creates an account) |
| `invites` | Client, one-time token, expires_at, used_at (also used for password resets) |
| `photos` | File paths (original, preview, thumbnail), title, notes, width, height, size, uploaded_at |
| `tags` | Unique lowercase tag names |
| `photo_tags` | Photo ↔ tag links |
| `client_pages` | Client, shoot date, notes, secret link token, `shoot_photos_visible` |
| `inspirations` | Client page + photo, state (`undecided` / `accepted` / `rejected`), `added_by` (`admin` / `client`) |
| `shoot_photos` | Client page + file paths + uploaded_at |
| `comments` | Client page + photo (inspiration or shoot photo), author type (`admin` / `client`), body, created_at |
| `messages` | Client, sender (`admin` / `client`), body, created_at, read_at |
| `payment_requests` | Client, optional client page, amount (in cents), currency, description, status, paid_at, provider reference |
| `notifications` | Client, type (`inspirations` / `shoot_photos` / `message` / `payment`), sent_at, status: a record of emails sent |

---

## 6. Tech stack: local development first

Everything runs on your own machine for now. The stack is chosen so moving to production later means changing settings, not rewriting code.

| Part | Choice | Notes |
|------|--------|-------|
| App | **Next.js (App Router) + TypeScript + Tailwind CSS** | One codebase for UI and API. Run with `npm run dev` |
| Database | **PostgreSQL 17 in Docker** (`docker compose up -d`), used when `DATABASE_URL` is set. Without it, the app falls back to built-in **PGlite** (data in `.data/`) | Same SQL either way. The e2e tests use PGlite so they never touch real data |
| Database access | **Drizzle ORM** | Typed schema and migrations (applied automatically on start) |
| Login (admin + client) | Built-in email + password sessions | Passwords hashed with bcrypt; session tokens stored hashed. Role checked on every admin route. No outside login services |
| Client page access | Long random token in the URL | Works without login; revocable |
| Photo files | **Local disk** (`web-app/uploads/`, ignored by git) | Accessed only through a small storage module (`save` / `get` / `delete`) so cloud storage can replace it later |
| Image processing | **sharp** (+ `heic-convert` for HEIC) | Thumbnails, previews, HEIC→JPEG |
| Validation | **Zod** | All form and API input |
| Email | **Nodemailer** + **Mailpit** in Docker | Mailpit catches every email and shows it at http://localhost:8025, so nothing reaches real clients. Without `SMTP_URL`, emails are saved to `.mail/` and shown at `/admin/outbox` instead |
| Payments | Payments module, manual "mark as paid" locally | Provider connected later |
| Testing | **Playwright**, headless | End-to-end walk through F1–F11 (`npm run test:e2e`) |

Implementation notes:

- Next.js limits server-action bodies to 1 MB. Uploads therefore go through route handlers, which have no such limit, one file per request.

**Later (not in v0.5):** hosting, cloud file storage, a hosted database, an email provider, and a payment provider are chosen when the app moves to production.

---

## 7. Open questions

- **Payments:** which provider at production (e.g. Stripe, Square, PayPal)? Fixed packages, or custom amounts per client? Deposit + final balance?
- Should Shoot Photo downloads be locked until the final payment is paid?
- Can messages include attachments (images, PDFs), or text only?

---

## 8. Changelog

- **v0.5 (2026-11-02):** Docker is now set up: Postgres 17 and Mailpit run from `docker-compose.yml` (back to the original v0.1 plan). PGlite and the file outbox remain as fallbacks and are used by the e2e tests.
- **v0.4 (2026-11-02):** first version built. Stack changes made during the build: PGlite instead of Postgres in Docker (Docker isn't installed; real Postgres still supported), built-in sessions instead of Auth.js, local email outbox instead of Mailpit. Client pages also have a name (e.g. "Engagement shoot").
- **v0.3 (2026-11-02):** added F9 (client accounts, optional), F10 (messaging), F11 (payments). Links still work without login. Added `clients`, `invites`, `messages`, `payment_requests` tables; `users` now has a role. Email notifications now cover messages and payments.
- **v0.2 (2026-11-02):** added F7 (email notifications) and F8 (downloads: Shoot Photos yes, Inspirations no). Client links don't expire. Added client email and a `notifications` table. Added local email setup (Nodemailer + Mailpit).
- **v0.1 (2026-11-01):** initial spec. F1–F6, data model draft, local tech stack.
