# HookHub — MVP Spec

| | |
|---|---|
| **Status** | Draft v0.1 |
| **Date** | 2026-11-01 |
| **Scope** | MVP: browse/display only |
| **Codebase** | `my-app/` (Next.js 16, React 19, Tailwind CSS v4, TypeScript) |

## 1. Overview

HookHub is a website for discovering open-source **Claude Code hooks**. Hooks are scattered across many GitHub repositories, blog posts and "awesome" lists. Today there's no single place to see what exists. HookHub collects them into one browsable grid.

**Target users:** Claude Code users who want to automate or add guardrails to their workflow without writing hooks from scratch.

**MVP promise:** open the home page and see a grid of hooks. Each one has a name, a category, a short description and a link to its GitHub repo.

## 2. Background: what is a Claude Code hook?

A hook is a user-defined handler that Claude Code runs automatically at a specific point in its lifecycle. Usually it's a shell command, but it can also be an HTTP call, an MCP tool call or a prompt. Hooks are configured in `settings.json` (user, project, or plugin level) and can:

- **Block or allow actions.** Example: a `PreToolUse` hook that stops `rm -rf` before it runs.
- **React to results.** Example: a `PostToolUse` hook that auto-formats a file after Claude edits it.
- **Notify.** Example: a `Notification` or `Stop` hook that plays a sound or sends a desktop alert.
- **Add context.** Example: a `SessionStart` or `UserPromptSubmit` hook that injects project info.

Common events include `PreToolUse`, `PostToolUse`, `UserPromptSubmit`, `Notification`, `Stop`, `SubagentStop`, `SessionStart`, `SessionEnd` and `PreCompact`.
Reference: https://code.claude.com/docs/en/hooks

Hooks run with the user's own system permissions. This matters for HookHub's security messaging (§8).

## 3. Goals and non-goals

### Goals (MVP)
1. Display all curated hooks on the home page in a responsive grid.
2. Each hook card shows the **name**, **category**, **description**, and a **link to the GitHub repo**.
3. Ship as a fast, fully static site that is cheap and easy to host.
4. Make adding a hook as simple as editing one JSON file through a pull request.
5. A search box above the grid that filters cards as you type (client-side, in memory). It matches name, description, category and `owner/repo`, case-insensitive, and every typed word must match. It shows "N of M hooks" and a "no results" state with a clear button.

### Non-goals (MVP)
- User accounts, login, or profiles
- Submitting hooks through the UI
- Category filters or sorting controls (post-MVP, see §11)
- Hook detail pages
- Live GitHub data (stars, last updated, README)
- Install commands or one-click install
- Ratings, comments, or favorites

## 4. Data model

### 4.1 `Hook`

| Field | Type | Required | Rules |
|---|---|---|---|
| `id` | string | yes | Unique, URL-safe slug (`^[a-z0-9-]+$`), e.g. `block-dangerous-commands` |
| `name` | string | yes | 1–60 chars, display name |
| `category` | `Category` | yes | One of the enum values in §4.2 |
| `description` | string | yes | 1–200 chars, plain text (no HTML/Markdown) |
| `repoUrl` | string | yes | Must start with `https://github.com/`. May point to a repo or a path inside one (`/tree/...`, `/blob/...`) |

```ts
type Category =
  | "Security"
  | "Formatting"
  | "Testing"
  | "Notifications"
  | "Git"
  | "Logging & Monitoring"
  | "Productivity"
  | "Other";

interface Hook {
  id: string;
  name: string;
  category: Category;
  description: string;
  repoUrl: string;
}
```

Categories group hooks **by purpose**, not by Claude Code event, because that matches how people search ("I want safety guardrails"). Event type can be added as an extra field later.

### 4.2 Category definitions

| Category | Covers |
|---|---|
| Security | Blocking dangerous commands, protecting secrets/files, permission guardrails |
| Formatting | Auto-format / lint after edits |
| Testing | Running tests or type checks after changes |
| Notifications | Sound, desktop, Slack/other alerts when Claude stops or needs input |
| Git | Commit guards, branch protection, auto-commit/checkpoint |
| Logging & Monitoring | Session/tool logging, cost tracking, observability |
| Productivity | Context injection, prompt helpers, workflow automation |
| Other | Anything that doesn't fit the above |

### 4.3 Storage

- Source of truth: `data/hooks.json`, a JSON array of `Hook` objects.
- It's validated **at build time**. Any invalid entry fails `npm run build` with a clear message naming the entry `id` and the field. Checks: required fields, enum, lengths, URL prefix, duplicate `id`s.
- No database and no runtime fetching.

### 4.4 Granularity

One entry is **one hook or one hook collection**, whichever the source repo offers. If a repo contains many hooks, an entry may link to the repo root (a collection) or to a specific hook's folder. The MVP doesn't distinguish the two visually.

## 5. Seed data

These are initial entries for development. All repos below were confirmed to exist on 2026-11-01. Before launch, re-check each description and category against the repo README.

```json
[
  {
    "id": "karanb192-claude-code-hooks",
    "name": "Claude Code Hooks (karanb192)",
    "category": "Security",
    "description": "Collection of hooks for safety, cost control, observability and productivity, plus an installable plugin marketplace.",
    "repoUrl": "https://github.com/karanb192/claude-code-hooks"
  },
  {
    "id": "yurukusa-safety-hooks",
    "name": "Claude Code Safety Hooks",
    "category": "Security",
    "description": "The original 16 safety hooks collected from long autonomous Claude Code runs.",
    "repoUrl": "https://github.com/yurukusa/claude-code-hooks"
  },
  {
    "id": "awesome-claude-code-sounds",
    "name": "Sound Notification Hooks",
    "category": "Notifications",
    "description": "Hooks that play audio alerts on macOS, Windows and Linux when Claude Code needs attention.",
    "repoUrl": "https://github.com/pascalporedda/awesome-claude-code"
  },
  {
    "id": "claude-code-hooks-mastery",
    "name": "Claude Code Hooks Mastery",
    "category": "Productivity",
    "description": "Worked examples covering every major hook event, useful as a learning reference and starting point.",
    "repoUrl": "https://github.com/disler/claude-code-hooks-mastery"
  },
  {
    "id": "curated-hook-scripts",
    "name": "Curated Hook Scripts",
    "category": "Other",
    "description": "Small collection of shell-based hook scripts for Claude Code.",
    "repoUrl": "https://github.com/normful/claude-code-curated-hooks"
  }
]
```

Discovery source for more entries: https://github.com/hesreallyhim/awesome-claude-code (the hooks section).

## 6. UI requirements

### 6.1 Home page (`/`)
- **Header:** the "HookHub" wordmark and a one-line tagline, e.g. "Discover open-source hooks for Claude Code."
- **Count:** "N hooks", computed from the data.
- **Grid of hook cards** (§6.2).
- **Footer:** a disclaimer (§8) and a "Add a hook" link to the repo's contributing instructions (a PR to `data/hooks.json`).

### 6.2 Hook card
| Element | Behavior |
|---|---|
| Name | Heading. Truncate with an ellipsis if longer than 2 lines |
| Category | Small badge. Each category gets a consistent color that works in light and dark mode |
| Description | Body text, clamped to 3 lines |
| Repo link | "View on GitHub ↗" plus the `owner/repo` text. Opens in a new tab |

The whole card is not one big link. Only the repo link is clickable, which keeps the target and the screen-reader text clear.

### 6.3 Layout
| Viewport | Columns |
|---|---|
| < 640px (mobile) | 1 |
| 640–1023px (tablet) | 2 |
| ≥ 1024px (desktop) | 3 |
| ≥ 1280px (wide) | 4 |

- Cards in a row have equal height.
- **Order:** one flat list (not grouped by category), sorted alphabetically by `name` (case-insensitive).
- **Empty state:** if `hooks.json` is empty, show "No hooks yet — be the first to add one" with the contribute link.

### 6.4 Theme and accessibility
- Light and dark themes follow the system preference. The existing `--background` / `--foreground` tokens in `app/globals.css` already do this.
- The grid uses semantic `<ul>`/`<li>` elements, and each card is an `<article>` with the name as a heading.
- Focus outline is visible on links. Text and badges meet WCAG AA contrast.
- Link text names the destination, e.g. "View karanb192/claude-code-hooks on GitHub (opens in new tab)" (visually hidden suffix).

## 7. Technical approach

- **Framework:** Next.js App Router in `my-app/`. Read the bundled docs in `node_modules/next/dist/docs/` before using Next.js APIs (see `AGENTS.md`). This version differs from older Next.js.
- **Rendering:** `app/page.tsx` is a Server Component that imports `data/hooks.json` directly. No client JavaScript is needed for the MVP. The page should come out **fully static** at build time. `cacheComponents` is enabled in `next.config.ts`, so confirm the page is reported as static in `next build` output.
- **Suggested structure:**
  - `data/hooks.json`: the content
  - `lib/hooks.ts`: the `Hook`/`Category` types, validation, and the sorted `getHooks()`
  - `components/HookCard.tsx`: a presentational card
  - `app/page.tsx`: header, count, grid, footer
- **Validation:** a small hand-written validator in `lib/hooks.ts` is enough for the MVP, with no new dependency. If the schema grows, consider `zod`.
- **Styling:** Tailwind v4 utility classes. Category badge colors are defined once in a map keyed by `Category`.
- **Metadata:** update `app/layout.tsx` with the title "HookHub" and a description. Replace the default favicon.
- **Cleanup:** remove the `create-next-app` starter content from `app/page.tsx` and the unused files in `public/`.

## 8. Security and trust

- Hooks execute arbitrary code with the user's permissions. The footer shows: *"HookHub links to third-party code. Review any hook before installing it. HookHub doesn't audit or endorse listed hooks."*
- Only `https://github.com/` URLs are accepted, enforced by build-time validation.
- External links use `target="_blank" rel="noopener noreferrer"`.
- Descriptions are rendered as plain text. No `dangerouslySetInnerHTML` and no Markdown rendering.
- No user input, cookies, or auth in the MVP, so the attack surface is minimal.

## 9. Operations

- **Hosting:** a static deployment on Vercel or any static host / CDN.
- **Content workflow:** a contributor opens a PR that edits `data/hooks.json`. CI runs `npm run lint` and `npm run build`, and validation catches bad entries. A maintainer reviews it, merges, and the site auto-deploys.
- **Content review checklist** for maintainers: the repo exists and is public, has a license, its purpose matches the category, and nothing looks obviously malicious.
- **Monitoring:** none required for the MVP beyond host-provided uptime and basic analytics (optional).
- **Link rot:** out of scope for the MVP. A scheduled link checker is a post-MVP idea.

## 10. Acceptance criteria

- [ ] Every entry in `data/hooks.json` renders as one card on `/`.
- [ ] Each card shows the name, category badge, description, and a working GitHub link that opens in a new tab.
- [ ] The grid shows 1 / 2 / 3 / 4 columns at 375px / 768px / 1024px / 1280px widths.
- [ ] Cards are sorted alphabetically by name.
- [ ] The hook count matches the number of entries.
- [ ] Typing in the search box filters the grid live and updates the count ("N of M hooks"). A query with no matches shows the "no results" state, and "Clear search" restores all cards.
- [ ] An empty `hooks.json` shows the empty state.
- [ ] `npm run build` fails with a clear error for: a missing field, an unknown category, a non-GitHub URL, a duplicate `id`, or an over-length description.
- [ ] `/` is reported as a static route in `next build` output.
- [ ] `npm run lint` passes.
- [ ] Light and dark modes are both legible. Keyboard focus is visible on every link.
- [ ] No starter `create-next-app` content remains.

## 11. Post-MVP ideas (not committed)

1. Category filter chips (client-side, on the same static data) and a shareable `?q=` search URL
2. Hook detail page: the Claude Code event(s) used, an example `settings.json` snippet, and the README excerpt
3. GitHub metadata (stars, license, last updated) fetched at build time
4. A "Submit a hook" form that opens a prefilled GitHub issue or PR
5. Auto-discovery of repos through the GitHub `claude-code-hooks` topic, with maintainer approval
6. A scheduled dead-link checker in CI
7. Event-type tags (`PreToolUse`, `Stop`, …) as a secondary filter

## 12. Open questions

- Should collections (repos with many hooks) be listed once, or broken out into individual hooks?
- Is a minimum bar needed for listing, such as a license, a README, or recent activity?
- Domain name and branding (logo, colors)?
