# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

Moodboard: a web app where a photographer (admin) keeps a tagged library of reference photos, gives each client a private page to accept/reject "Inspirations", and later delivers shoot photos there. Clients can also have accounts for messaging and payments. **`SPEC.md` is the source of truth for features (F1–F11)**; keep its changelog updated when behaviour changes.

## Commands

- `docker compose up -d`: starts Postgres 17 (localhost:5432) and Mailpit (SMTP on 1025, inbox at http://localhost:8025). `.env.local` (copied from `.env.example`) points the app at them.
- `npm run dev`: dev server at http://localhost:3000. First visit goes to `/setup` to create the admin account.
- `npm run build`: production build and the main type check.
- `npm run lint`: ESLint (flat config).
- `npm run test:e2e`: headless Playwright tests (`e2e/moodboard.spec.ts`). Runs `next build && next start` on port 3200 with throwaway data in `.e2e-data/`, so it works while `npm run dev` is running. Single test: `npx playwright test -g "F4"`.
- `npm run db:generate`: after editing `lib/db/schema.ts`, generates a SQL migration in `drizzle/`. Migrations apply automatically when the app first touches the database.

## Architecture

- **Next.js 16.4 App Router**, with `cacheComponents` deliberately **off**: every page is per-user, so pages render dynamically. Pages that read the DB without cookies need `await connection()` so they aren't prerendered at build time. Never name a file `page.ts` outside a route (server actions live in `app/actions/*.ts`).
- **Database** (`lib/db/index.ts`): `getDb()` returns a Drizzle client. With `DATABASE_URL` (normal dev: Docker Postgres), it uses node-postgres. Without it, it falls back to PGlite (Postgres in WebAssembly) at `.data/pglite`, which only one process may open at a time. The e2e tests force PGlite by setting `DATABASE_URL=""`. Both are typed as `NodePgDatabase`.
- **Two kinds of access**:
  - Admin/client login sessions (`lib/auth.ts`): cookie `mb_session`, SHA-256-hashed session rows. Use `requireAdmin()`/`requireClient()` in pages and `assertAdmin()` in actions and API routes.
  - **Client pages use an access key** (`lib/access.ts`): `"t:<token>"` for the private link (no login) or `"p:<pageId>"` for a logged-in owner or the admin. Every client-page action (`app/actions/board.ts`), image URL (`/media/...?a=<key>`) and zip download (`/download/<key>`) resolves this key. The admin reuses the same components with `p:<pageId>`.
- **Files** go only through `lib/storage.ts` (local disk at `uploads/`, keys like `library/<id>/preview.webp`), so it can later be swapped for cloud storage. `lib/images.ts` validates uploads (50 MB, magic-byte type check, HEIC→JPEG) and writes original + preview (2000px) + thumbnail (400px).
- **Uploads** use route handlers (`app/api/admin/...`), one file per request, because server actions are capped at 1 MB.
- **Rules worth preserving** (see SPEC F8): clients never get a library photo's original; shoot photos are hidden from clients until `shootPhotosVisible`.
- **Emails** (`lib/mail.ts`, `lib/notify.ts`): sent over `SMTP_URL` (Mailpit locally). Without it they're saved to `.mail/` and listed at `/admin/outbox`, which is what the e2e tests read. Batches send one email; `shoot_photos.notified` tracks which shoot photos the client has been told about.
- **Payments** (`lib/payments.ts`): a `PaymentProvider` interface with only a manual provider for now (the admin marks requests paid).

Local-first: don't add cloud or hosting services unless asked. Configuration is via `.env.local` (see `.env.example`).
