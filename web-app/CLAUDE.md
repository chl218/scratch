# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

ReferenceMePlzQQ (working name and package: `moodboard`): a small photography studio's site. Admins keep a tagged library of **Reference Pictures** and give each client a private page to accept/reject them before a shoot; after the shoot the page locks and shows only the client's photos (favourites, downloads). Public side: portfolio mosaic (`/`), Meet the Team, Book, Contact. Client area at `/u/<username>`. Beta among friends: no self sign-up, no payments. **`SPEC.md` is the source of truth for features (F1–F17) and the design (§5)**; keep its changelog updated when behaviour changes.

## Commands

- `docker compose up -d`: starts Postgres 17 (localhost:5432) and Mailpit (SMTP on 1025, inbox at http://localhost:8025). `.env.local` (copied from `.env.example`) points the app at them.
- `npm run dev`: dev server at http://localhost:3000. First visit goes to `/setup` to create the Super Admin.
- `npm run build`: production build and the main type check.
- `npm run lint`: ESLint (flat config).
- `npm run test:e2e`: headless Playwright tests (`e2e/moodboard.spec.ts`), one serial walk through the spec. Runs `next build && next start` on port 3200 with throwaway data in `.e2e-data/`, so it works while `npm run dev` is running. Single test: `npx playwright test -g "F4"`.
- `npm run db:generate`: after editing `lib/db/schema.ts`, generates a SQL migration in `drizzle/`. Migrations apply automatically when the app first touches the database. (Renames need a hand-written migration; see `drizzle/0001_v06_reference_pictures.sql`.)
- `npm run seed:references`: loads the pictures in `seed/references.json` into the library (skips ones already there). With PGlite, stop the dev server first.

## Architecture

- **Next.js 16.4 App Router**, with `cacheComponents` deliberately **off**: pages are per-user, so they render dynamically. Pages that read the DB without cookies need `await connection()`. Never name a file `page.ts` outside a route (server actions live in `app/actions/*.ts`: `admin`, `team`, `board` (client page), `client` (client area, booking, contact), `booking` (public availability), `auth`).
- **Database** (`lib/db/index.ts`): `getDb()` returns a Drizzle client: node-postgres with `DATABASE_URL`, otherwise PGlite at `.data/pglite` (one process at a time). After migrating it backfills client usernames and the `studio_settings` row.
- **Roles**: `users.role` is `admin` or `client`; one admin has `is_super_admin` (approves admin invites, disables admins, studio settings). Use `requireAdmin()` / `requireSuperAdmin()` / `requireClient()` in pages and `assertAdmin()` / `assertSuperAdmin()` in actions.
- **Client page access** (`lib/access.ts`): `"t:<token>"` (private link, no login) or `"p:<pageId>"` (logged-in owner or admin). Every client-page action, image URL (`/media/...?a=<key>`) and zip (`/download/<key>`) resolves this key. `actor.userId` is null for link-only visitors: they can choose and favourite but not comment.
- **The lock**: `client_pages.shoot_photos_visible` = Your Photos shown = page locked. Locking snapshots Accepted pictures onto their `reference_pictures` rows; the Board is hidden from the client, never deleted.
- **Client area** (`lib/area.ts`, `lib/links.ts`): `/u/<username>` opens for the logged-in client or a browser whose `mb_links` cookie holds one of that client's valid link tokens.
- **Files** go only through `lib/storage.ts` (local `uploads/`). `lib/images.ts` validates uploads and writes original + preview + thumbnail; Shoot Photos also get a metadata-free `clean` copy, which is what clients download (never serve `originalKey` to clients).
- **Emails** (`lib/notify.ts`): client emails, and admin emails to a client's assigned admins + the Super Admin, filtered by each admin's `email_prefs`. Without `SMTP_URL` they're saved to `.mail/` and listed at `/admin/outbox` (what the e2e tests read). The activity digest (`lib/digest.ts`) runs on a timer started from `instrumentation.ts`.
- **Booking** (`lib/booking.ts`, `lib/time.ts`): slots come from weekly hours, time off, confirmed bookings and the buffer, all in the studio time zone. The server re-checks the slot when booking.
- **Design** (SPEC §5): tokens in `app/globals.css` (`table`, `sheet`, `graphite`, `loupe`, `sleeve`, `marker`), Archivo via `next/font`, grease-pencil marks in `components/Marks.tsx`, justified rows (`PhotoTile`/`JustifiedGrid`) for working grids and the server-packed mosaic (`lib/mosaic.ts`) on `/`. Use the `pill`/`btn-*`/`panel` utilities rather than new colours.

Local-first: don't add cloud or hosting services unless asked. Configuration is via `.env.local` (see `.env.example`).
