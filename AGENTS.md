# connor.works

This repo (`wbconnor/connor-works`) is the **main site** for https://connor.works and the workspace that holds every child app. The main site is Next.js (App Router) + TypeScript, deployed on Railway as the `main-site` service. **Status:** v1 implemented per `DESIGN.md` (Next.js 16 with Cache Components).

## Read first

- **`ARCHITECTURE.md`** explains how several repos share one domain: Next.js Multi-Zones, Railway services, DNS, the shared Postgres instance, and local dev. Read the relevant sections before changing routing, deployment, environment variables or databases, or before adding an app.
- **`DESIGN.md`** is the main site's design spec: the home page, project cards (`app/projects.ts`), the 404 page, site-wide files and `/api/notify`.
- **`DEPLOY.md`** has step-by-step deploy instructions: first-time setup (Railway, Postgres, Namecheap → Cloudflare DNS), deploying a new child app and its production database, and maintenance deploys.
- **Zone registry:** `src/zones.mjs` in the shared config package `@connor-works/config` (`connor-works-config/` locally; `ARCHITECTURE.md` §2.1) is the source of truth for which app owns which URL prefixes. `ARCHITECTURE.md` §2 has a readable summary.

## Layout

- The repo root is the main site.
- Child apps are **separate git repos** cloned into subfolders and git-ignored here:
  - `meridian-underground/`: home theater site, movie collection and movie nights. It has its own `AGENTS.md` and `DESIGN.md`.
- `connor-works-config/` is also a separate git repo, ignored here: the shared config package every app installs by git tag. It has its own `AGENTS.md`.
- Treat each nested folder as a separate project with its own `package.json`, lockfile, git history and commits. Run git commands for a child app inside its folder. Never commit nested repo files to this repo.

## Rules for every app

1. Only create routes under the prefixes the registry assigns to your app. The main site owns `/` and everything unclaimed.
2. Child apps use a unique production `assetPrefix` (e.g. `/mu-static`), `images.unoptimized: true`, `serverActions.allowedOrigins` including `connor.works`, and a pinned Next.js root (`ARCHITECTURE.md` §5.5).
3. Build absolute URLs from `SITE_URL`, never from the request `Host` header.
4. Link across apps with plain `<a href>`, not `next/link`.
5. Prefix cookie names per app (`cw_` for the main site, `mu_` for Meridian Underground).
6. Each app gets its own database and login role on the shared Postgres instance. Never connect to another app's database. Share data through the owning app's API.
7. Start servers with `next start -H ::` and put health checks under the app's own prefix.
8. **Keep the registry and docs in sync.** When you change prefixes, services, environment variables or databases, update `zones.mjs` in the config package, `ARCHITECTURE.md` §2 and the affected sections together.

Rules 1–5 are enforced by `@connor-works/config`: the `connorWorks()` ESLint config, the `findRouteViolations()` route test, and `childNextConfig()`. Don't disable those rules or tests to get past an error; fix the code, or change the registry if ownership really changed.

## Commits during implementation

- Commit without asking whenever you finish a logical unit of work: a scaffolded piece, a feature slice, a passing test suite, a refactor. Don't wait until the end.
- Each commit should build, and lint and tests should pass if they exist. Don't commit broken work just to save progress.
- Keep commits focused: one concern each, with a message in the imperative mood ("Add zone rewrites to next.config.ts").
- Never commit to `main`. Work on a feature branch and create one if needed.
- Child apps and `connor-works-config/` are separate repos. Commit their changes from inside their own folders, never from the root.
- Don't push, open PRs, amend, rebase or force-push without asking.

## Adding a child app

Use the **`new-child-app` skill** (`.claude/skills/new-child-app/`). It covers every repo that needs changes. Don't add a child app by hand.

## Main site specifics (repo root only)

- Owns `/robots.txt` (must include every child app's `Disallow` rules, in `childAppDisallow` in `app/robots.ts`; a test requires a block per registry app), `/sitemap.xml`, `/favicon.ico` and unknown-path 404s.
- **Never create pages under a child app's prefixes.** Next.js checks its own pages before rewrites, so such a page would hide the child app's page.
- Child apps are routed by `zoneRewrites()` from `@connor-works/config/next` in `next.config.ts` (`ARCHITECTURE.md` §5.2). Each app's rewrites turn on only when its `urlEnv` variable (e.g. `MERIDIAN_UNDERGROUND_URL`) is set. Don't hand-write rewrites for child apps.
- Keep nested repo folders out of the main site's tooling: list them in `tsconfig.json` `exclude` and in Prettier and test-runner ignores (`ARCHITECTURE.md` §5.5). ESLint ignores them automatically via `connorWorks({ app: 'main-site' })`. The root `pnpm-workspace.yaml` holds pnpm settings only (pnpm 11+ reads `allowBuilds` nowhere else); never add a `packages` list to it.
- Scope any `middleware.ts` `matcher` so it doesn't run on child app prefixes.

## Local development

- Postgres for all apps runs in Docker from this folder: `docker compose up -d` (`ARCHITECTURE.md` §11). The compose file and init SQL are specified there, and may not exist yet.
- Commands (repo root):
  - `pnpm dev`: dev server on http://localhost:3000. Set a child app's `urlEnv` (e.g. `MERIDIAN_UNDERGROUND_URL=http://localhost:3001`) to turn on its rewrites and card.
  - `pnpm build` / `pnpm start`: production build and server (`next start -H ::`).
  - `pnpm lint`, `pnpm typecheck`, `pnpm test` (Vitest), `pnpm format` (Prettier).
- Next.js 16 runs with `cacheComponents` on: route segment exports like `dynamic` and `runtime` are build errors, and `new Date()` or `Math.random()` during prerendering need `'use cache'` or `connection()` (see the bundled docs below).

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
