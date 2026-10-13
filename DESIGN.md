# connor.works Main Site — Design Document

> The front door of https://connor.works: a single home page that introduces the site and links to its public apps. It also owns the site-wide files (robots, sitemap, favicon, 404) and the admin email notification endpoint.
>
> **Audience:** Claude Code (implementation) and Connor (owner/admin).
> **Status:** v1 spec reviewed and approved.

---

## 1. Overview

The main site is the Next.js app at the root of this repo. It owns `/` and every path not claimed by a child app, and it proxies child app prefixes using `zoneRewrites()` (`ARCHITECTURE.md` §5.2). This document covers only what the main site **shows and does**. Routing, deployment and environment setup are in `ARCHITECTURE.md` and `DEPLOY.md`.

v1 contains:

1. **Home page** (`/`): ASCII-art title, a short invitation, and a grid of project cards that link to the child apps.
2. **404 page** for every unknown path on the domain.
3. **Site-wide files:** `robots.txt`, `sitemap.xml`, favicon and Open Graph image.
4. **API routes:** `/api/health` (Railway health check) and `/api/notify` (admin email notifications for child apps, `ARCHITECTURE.md` §12).

There is no header, navigation menu, login or database in v1.

---

## 2. Decisions

| Topic | Decision |
|---|---|
| Stack | Next.js (App Router), TypeScript, Tailwind CSS v4, pnpm |
| Database | None. `database: null` in the zone registry stays as is |
| Theme | Light only. Medium-light grey background, near-black text, monospace title |
| H1 | "Connor dot works" rendered as ASCII art in the figlet **Small Slant** (`smslant`) font. See §12 Q1 to confirm the wording |
| Fonts | Geist Sans for body text, Geist Mono for the ASCII title, both via `next/font` |
| Card data | A typed list in `app/projects.ts`, maintained by the `new-child-app` skill (§5) |
| Card visibility | A card appears only if it is `listed` and its app's `urlEnv` is set at build time (§5.2) |
| Card accent | Per-app hex color taken from the child app's tertiary color. Falls back to a neutral default (§4) |
| Email | Main site owns `/api/notify` and sends with Resend (§8). No separate app |
| Testing | Vitest: route-prefix test, card data test, `/api/notify` handler tests |

---

## 3. Routes

| Path | Type | Purpose |
|---|---|---|
| `/` | Page (static) | Home page (§6) |
| *(any unknown path)* | `app/not-found.tsx` | 404 page (§7) |
| `/robots.txt` | `app/robots.ts` | Robots rules for the whole domain (§9.1) |
| `/sitemap.xml` | `app/sitemap.ts` | Sitemap for the whole domain (§9.2) |
| `/icon.svg`, `/favicon.ico` | `app/icon.svg`, `app/favicon.ico` | Favicon (§9.3) |
| `/opengraph-image` | `app/opengraph-image.tsx` | Generated social preview image (§9.4) |
| `GET /api/health` | Route handler | Returns `200 { "ok": true }`. Railway health check path |
| `POST /api/notify` | Route handler | Admin email notifications (§8) |

**Never add a page under a child app's prefix** (`AGENTS.md`). The route-prefix test (`findRouteViolations({ app: 'main-site', ... })`) enforces this.

---

## 4. Visual design

### 4.1 Color tokens

Implement these as CSS variables mapped in the Tailwind theme (`bg-bg`, `text-ink`, etc.). Contrast ratios are approximate.

| Token | Hex | Use |
|---|---|---|
| `bg` | `#C4C4C4` | Page background (medium-light grey) |
| `surface` | `#E8E8E8` | Card background |
| `ink` | `#1A1A1A` | Headings, ASCII title, body text (~10:1 on `bg`, ~14:1 on `surface`) |
| `ink-muted` | `#4A4A4A` | Card descriptions, footer, secondary text (~5:1 on `bg`, ~7:1 on `surface`) |
| `border` | `#A8A8A8` | Card outline at rest |
| `accent-default` | `#333333` | Card accent when a project has no `highlightColor` |
| `focus` | `#1A1A1A` | Focus ring for non-card elements |

### 4.2 Typography

- **ASCII title:** Geist Mono, `white-space: pre`, `line-height: 1.1`, color `ink`. Size rules are in §6.1.
- **Body:** Geist Sans. Intro text `1.125rem`, card title `1.25rem` semibold, card description `1rem`, footer `0.875rem`.

### 4.3 Layout

- Single centered column, `max-width: 960px`, horizontal padding `1rem` (mobile) / `2rem` (≥ `md`).
- Vertical rhythm: generous whitespace. Roughly `4rem` above the title, `1.5rem` between title and intro, `3rem` between intro and grid.
- One breakpoint does most of the work: Tailwind `md` (768px).

### 4.4 Motion

- Card hover and focus transitions are 150ms (outline color, image saturation, shadow).
- Under `prefers-reduced-motion: reduce`, transitions are removed and state changes are instant.
- No other animation in v1.

---

## 5. Project cards

### 5.1 Data: `app/projects.ts`

The home page reads a typed array. The `new-child-app` skill adds entries to it (skill step 5.5), so keep this shape and file location stable.

```ts
// app/projects.ts
export type Project = {
  app: string;          // key in the zone registry, e.g. 'meridian-underground'
  title: string;        // e.g. 'Meridian Underground'
  description: string;  // one sentence, ≤ 140 characters
  href: string;         // the app's first prefix, e.g. '/meridian-underground'
  image: string;        // path under /public, e.g. '/projects/meridian-underground.webp'
  imageAlt: string;     // describes the image, not the app name
  highlightColor?: string; // hex, e.g. '#244653'; falls back to accent-default
  listed: boolean;      // false = registered app with no public card
};

export const projects: Project[] = [];
```

- **Order:** cards render in reverse array order. New apps are appended, so the newest app is first.
- **Placeholder image:** `/public/projects/placeholder.webp` is used when an app doesn't have its own image yet. Create it during scaffolding: a 16:9 `surface`-colored image with a small mono "connor.works" mark.

### 5.2 Which cards appear

A project is shown when **both** are true:

1. `listed` is `true`.
2. The app's `urlEnv` from the zone registry (e.g. `MERIDIAN_UNDERGROUND_URL`) is set when the page is built.

Rule 2 stops a card from going live before its app is deployed, which would link to the main site's 404. The home page is static, so this is decided at build time; setting the variable on `main-site` and redeploying (which `DEPLOY.md` already requires for rewrites) also shows the card. Locally, cards appear only when you run with the child app's URL variable set (`ARCHITECTURE.md` §11).

Put this filter in a small, unit-tested function (e.g. `visibleProjects(projects, env)`), and look up `urlEnv` with `getZone()` from `@connor-works/config`.

### 5.3 Card anatomy

```
┌──────────────────────────────┐  ← 4px top bar in the accent color
│                              │
│        image (16:9)          │
│                              │
├──────────────────────────────┤
│ Title                        │
│ One-line description in      │
│ ink-muted.                   │
└──────────────────────────────┘
```

- The **whole card is one link**: a single plain `<a href={href}>` wrapping the card (`AGENTS.md` rule 4: no `next/link` across apps). The title is an `<h2>` inside it.
- `surface` background, 1px `border` outline, `0.5rem` radius, `overflow: hidden`.
- **Image:** 16:9, `object-fit: cover`, rendered with `next/image` from `/public/projects/` (source files 1200×675 WebP). Main-site images can be optimized normally; the `images.unoptimized` rule applies only to child apps.

### 5.4 Image style consistency

To keep cards consistent whatever images child apps supply, the card enforces the style in CSS:

- At rest, images render in **greyscale** (`filter: grayscale(1)`), matching the grey site.
- On hover or keyboard focus, the image returns to **full color**.

The source images can then be any style (screenshots, photos, artwork) as long as they're 16:9 and readable when small.

### 5.5 Accent color

The accent comes from the child app's tertiary color (`tertiaryColor` input in the `new-child-app` skill). It's used **only for non-text elements**:

- the 4px top bar, always visible;
- a 2px outline replacing `border` on hover and `:focus-visible`;
- a soft shadow tinted with the accent on hover (optional).

It is **never used for text**, because many app palettes (e.g. Meridian Underground's Rainstorm `#244653`) are dark or muddy and fail text contrast. A unit test checks every `highlightColor` has at least **3:1** contrast against `surface` (the WCAG minimum for focus indicators). A color that fails must be replaced, or omitted so the default is used.

### 5.6 Grid

- 1 column below `md`, 2 columns at `md` and up. Gap `1.5rem`.
- An odd number of cards leaves the last card in the left column at normal width (not stretched).

---

## 6. Home page (`/`)

Top to bottom: ASCII title, intro text, project grid (or empty state), footer.

### 6.1 ASCII title (H1)

The art is generated with figlet's `smslant` font and committed as constants, so the build doesn't depend on figlet. Store it in `app/_components/ascii-title.ts` using `String.raw` so the backslashes survive. Trim the trailing blank line figlet adds.

**Wide version** (≥ `md`), 73 columns:

```
  _____                             __     __                    __
 / ___/__  ___  ___  ___  ____  ___/ /__  / /_  _    _____  ____/ /__ ___
/ /__/ _ \/ _ \/ _ \/ _ \/ __/ / _  / _ \/ __/ | |/|/ / _ \/ __/  '_/(_-<
\___/\___/_//_/_//_/\___/_/    \_,_/\___/\__/  |__,__/\___/_/ /_/\_\/___/
```

**Stacked version** (below `md`), one word per block, 30 columns at most, left-aligned:

```
  _____
 / ___/__  ___  ___  ___  ____
/ /__/ _ \/ _ \/ _ \/ _ \/ __/
\___/\___/_//_/_//_/\___/_/

     __     __
 ___/ /__  / /_
/ _  / _ \/ __/
\_,_/\___/\__/

                  __
 _    _____  ____/ /__ ___
| |/|/ / _ \/ __/  '_/(_-<
|__,__/\___/_/ /_/\_\/___/
```

To regenerate (e.g. if the wording changes): `npx figlet -f "Small Slant" "Connor dot works"`, and the same per word for the stacked version.

**Markup and accessibility:**

```tsx
<h1>
  <span className="sr-only">Connor dot works</span>
  <pre aria-hidden="true" className="hidden md:block">{wide}</pre>
  <pre aria-hidden="true" className="md:hidden">{stacked}</pre>
</h1>
```

Screen readers announce only the visually hidden text. The `<pre>` blocks are hidden from assistive technology because ASCII art reads as noise.

**Sizing:** scale the font so the art never overflows its container and never wraps. Use `font-size: clamp(...)` tuned so the wide version fills up to the 960px column at desktop (about `1.25rem`) and still fits at 768px. The stacked version should fit a 320px-wide screen. Add `overflow-x: auto` as a safety net only; it shouldn't be needed.

### 6.2 Intro text

One or two sentences in `ink`, max width about 60 characters per line:

> A home for the things I build. Pick a project below and have a look around.

### 6.3 Project grid and empty state

- With one or more visible projects: the grid from §5.
- With none (the state until the first child app is deployed): instead of the grid, show one line in `ink-muted`: *"Projects are on the way. Check back soon."*.

### 6.4 Footer

Three rem line, fades to dark gray, text centered horizontally and vertically (across the 3 rem lines of the footer), `ink-muted`, small: `© {current year} connor.works`. No links in v1.

---

## 7. 404 page (`app/not-found.tsx`)

The main site serves every unknown path on the domain, including mistyped paths that look like child app URLs, so the 404 page should be clear and on-brand:

- Same background, fonts and footer as the home page.
- Small ASCII "404" in `smslant` (`npx figlet -f "Small Slant" "404"`), with `sr-only` text "Page not found" in the `<h1>`.
- One line: *"That page doesn't exist."* and a plain `<a href="/">` back to the home page.
- Returns HTTP 404 (the Next.js default for `not-found.tsx`).

---

## 8. Admin notifications: `/api/notify`

Implement the endpoint exactly as specified in `ARCHITECTURE.md` §12 (request body, status codes, 4 KB `text` cap, `[app]` subject prefix, no retries). Additions for the main site's implementation:

- **The endpoint is publicly reachable.** The main site holds the public `connor.works` domain, so `https://connor.works/api/notify` is reachable from the internet, not only over Railway's private network. The bearer key is the real protection, so:
  - check the `Authorization` header **before** reading the body;
  - compare keys with `crypto.timingSafeEqual` (compare equal-length buffers or hashes);
  - apply a simple in-memory rate limit (e.g. 30 requests per minute across all callers; return `429`). The main site runs as one instance, so in-memory is enough.
- **Provider wrapper:** `lib/notify/send-notification.ts` exports `sendNotification({ subject, text })` and is the only file that imports the Resend SDK.
- **Not configured:** if `RESEND_API_KEY`, `NOTIFY_EMAIL_FROM`, `NOTIFY_EMAIL_TO` or `NOTIFY_API_KEY` is missing, the route returns `503` and logs one warning. The site must still build and run without them, because notifications are optional (`DEPLOY.md` §1.9).
- **Runtime:** Node.js runtime (`export const runtime = 'nodejs'`), `POST` only; other methods return `405`.
- **Tests:** `401` on missing/wrong key, `400` on bad body or oversized `text`, `429` when rate-limited, `503` when not configured, `202` on success with `sendNotification` mocked.

No child app calls this yet (Meridian Underground's v1 has no notifications), but it's small and specified, so it's built in v1.

---

## 9. Site-wide files

### 9.1 `robots.txt` (`app/robots.ts`)

Allow everything by default, then list every child app's `Disallow` rules (`ARCHITECTURE.md` §5.3). Keep each app's rules in a clearly commented block so the `new-child-app` skill can add to it. Also disallow `/api/`. Point `sitemap` at `${SITE_URL}/sitemap.xml`.

### 9.2 `sitemap.xml` (`app/sitemap.ts`)

Include `/` plus the `href` of every **visible** project (§5.2). Child apps that publish their own sitemaps can be added later as links (`ARCHITECTURE.md` §5.3). Build every URL from `SITE_URL` (`AGENTS.md` rule 3).

### 9.3 Favicon

`app/icon.svg`: a lowercase **"c."** in Geist Mono, `ink` on a `bg` rounded square. Also provide `app/favicon.ico` (32×32) for older browsers.

### 9.4 Metadata and Open Graph

- `metadataBase: new URL(process.env.SITE_URL)` in the root layout.
- Title: `connor.works`. Description: the intro text from §6.2.
- `app/opengraph-image.tsx` uses `next/og` to render the wide ASCII title in `ink` on `bg` at 1200×630, so the social preview matches the page.
- The home page is indexable.

---

## 10. Implementation notes

- **Tooling exclusions:** list `connor-works-config/` and every child app folder in `tsconfig.json` `exclude`, `.prettierignore` and the Vitest `exclude` (`ARCHITECTURE.md` §5.5). Use `connorWorks({ app: 'main-site' })` for ESLint.
- **No middleware in v1.** If one is added later, scope its `matcher` away from child app prefixes.
- **`www` redirect:** handled per `DEPLOY.md` (Cloudflare rule if proxied, otherwise `redirects()` in `next.config.ts`).
- **Start command:** `next start -H ::`, with `PORT=3000` pinned on Railway (`ARCHITECTURE.md` §12.3).
- **Suggested file layout:**
  ```
  app/
    layout.tsx, page.tsx, not-found.tsx, globals.css
    robots.ts, sitemap.ts, icon.svg, favicon.ico, opengraph-image.tsx
    projects.ts
    _components/ascii-title.ts, project-card.tsx, project-grid.tsx
    api/health/route.ts
    api/notify/route.ts
  lib/
    projects.ts            ← visibleProjects()
    notify/send-notification.ts
    contrast.ts            ← used by the accent color test
  public/projects/placeholder.webp
  ```
- Once scaffolded, add the `dev`, `build`, `lint` and `test` commands to `AGENTS.md`.

---

## 11. Acceptance checklist

- [ ] `/` renders the wide ASCII title at ≥ 768px and the stacked title below it, with no horizontal scroll at 320px.
- [ ] A screen reader announces the H1 as "Connor dot works".
- [ ] With no visible projects, the empty-state line shows and no grid renders.
- [ ] With a visible project: 2 columns on desktop, 1 on mobile; the whole card is one plain `<a>`; the accent bar and hover/focus outline use the app's color; the image goes from greyscale to color on hover and focus.
- [ ] A project whose `urlEnv` isn't set has no card and isn't in the sitemap.
- [ ] Unknown paths return the 404 page with status 404.
- [ ] `robots.txt` includes every child app's rules; `sitemap.xml` uses `SITE_URL`.
- [ ] `/api/health` returns 200; `/api/notify` passes its tests and returns 503 when unconfigured.
- [ ] Route-prefix test, lint and unit tests pass.
