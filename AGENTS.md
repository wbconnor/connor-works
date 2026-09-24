# connor.works

This repo (`wbconnor/connor-works`) is the **main site** for https://connor.works and the workspace that holds every child app. The main site is Next.js (App Router) + TypeScript, deployed on Railway as the `main-site` service. **Status:** not scaffolded yet.

## Read first

- **`ARCHITECTURE.md`** explains how several repos share one domain: Next.js Multi-Zones, Railway services, DNS, the shared Postgres instance, and local dev. Read the relevant sections before changing routing, deployment, environment variables or databases, or before adding an app.
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

## Adding a child app

Use the **`new-child-app` skill** (`.claude/skills/new-child-app/`). It covers every repo that needs changes. Don't add a child app by hand.

## Main site specifics (repo root only)

- Owns `/robots.txt` (must include every child app's `Disallow` rules), `/sitemap.xml`, `/favicon.ico` and unknown-path 404s.
- **Never create pages under a child app's prefixes.** Next.js checks its own pages before rewrites, so such a page would hide the child app's page.
- Child apps are routed by `zoneRewrites()` from `@connor-works/config/next` in `next.config.ts` (`ARCHITECTURE.md` §5.2). Each app's rewrites turn on only when its `urlEnv` variable (e.g. `MERIDIAN_UNDERGROUND_URL`) is set. Don't hand-write rewrites for child apps.
- Keep nested repo folders out of the main site's tooling: list them in `tsconfig.json` `exclude` and in Prettier and test-runner ignores (`ARCHITECTURE.md` §5.5). ESLint ignores them automatically via `connorWorks({ app: 'main-site' })`. Don't add a root `pnpm-workspace.yaml`.
- Scope any `middleware.ts` `matcher` so it doesn't run on child app prefixes.

## Local development

- Postgres for all apps runs in Docker from this folder: `docker compose up -d` (`ARCHITECTURE.md` §11). The compose file and init SQL are specified there, and may not exist yet.
- Commands: *add `dev`, `build`, `lint` and `test` here once the main site is scaffolded.*
