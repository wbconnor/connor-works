# {{TITLE}}

A child app ("zone") of https://connor.works: {{DESCRIPTION}}. The main site owns the domain and proxies this app's URL prefixes to it.

## Read first

- **`DESIGN.md`**, if present, is the spec and the source of truth. Read the relevant sections before implementing anything.
- **Zone registry and shared tooling:** `@connor-works/config` ([wbconnor/connor-works-config](https://github.com/wbconnor/connor-works-config); `../connor-works-config/` locally). This app's entry in `src/zones.mjs` (`{{APP}}`) defines its prefixes, asset prefix, cookie prefix and database.
- **Site-wide architecture** (Multi-Zones, Railway, shared Postgres, local dev) is in `ARCHITECTURE.md` in the connor-works repo. Locally it's at `../ARCHITECTURE.md`. Otherwise, see https://github.com/wbconnor/connor-works/blob/main/ARCHITECTURE.md.

## How to work in this repo

- Locally, this repo is cloned inside `connor-works/` (the main site's repo) and git-ignored there. Run git commands in this folder. Don't edit or import files from the parent folder as part of work on this app.
- If the implementation has to differ from `DESIGN.md`, update `DESIGN.md` in the same change.

## Hard rules

- **Routes:** only under {{PREFIXES_MD}}, with assets under `{{ASSET_PREFIX}}`. No `/` route or redirect, and no root `robots`, `sitemap` or `favicon` (the main site serves those).
- **`next.config.ts`:** spread `childNextConfig('{{APP}}', __dirname)` from `@connor-works/config/next`. Merge nested objects with it; don't replace them.
- **URLs:** build absolute URLs from `SITE_URL`, never from the request host.
- **Links to other apps** (including the main site): plain `<a href>`, not `next/link`.
- **Cookies:** names start with `{{COOKIE_PREFIX}}`.
- **Database:** {{DATABASE_RULE}}
- **Server:** start with `next start -H ::`. The health check is `{{HEALTH_PATH}}`.
- **Enforcement:** `eslint.config.mjs` uses `connorWorks({ app: '{{APP}}' })`, and `test/route-prefixes.test.ts` uses `findRouteViolations()`. Both come from `@connor-works/config`. Don't disable those rules or tests to get past an error; fix the code. If the prefixes really need to change, that's a registry change in the config package (ask first).

## Stack & commands

Next.js (App Router), TypeScript, Tailwind CSS and pnpm, deployed on Railway as the `{{APP}}` service.

- `pnpm dev`: dev server
- `pnpm lint` / `pnpm typecheck` / `pnpm test`: ESLint, `tsc --noEmit`, Vitest unit tests
- `pnpm build` / `pnpm start`: production build and server
