# connor.works

This repo (`wbconnor/connor-works`) is the **main site** for https://connor.works and the workspace that holds every child app. The main site is Next.js (App Router) + TypeScript, deployed on Railway as the `main-site` service. **Status:** not scaffolded yet.

## Read first

- **`ARCHITECTURE.md`** explains how several repos share one domain: Next.js Multi-Zones, Railway services, DNS, the shared Postgres instance, and local dev. Read the relevant sections before changing routing, deployment, environment variables or databases, or before adding an app.
- **`ARCHITECTURE.md` §2 (zone registry)** is the source of truth for which app owns which URL prefixes.

## Layout

- The repo root is the main site.
- Child apps are **separate git repos** cloned into subfolders and git-ignored here:
  - `meridian-underground/`: home theater site, movie collection and movie nights. It has its own `AGENTS.md` and `DESIGN.md`.
- Treat each child folder as a separate project with its own `package.json`, lockfile, git history and commits. Run git commands for a child app inside its folder. Never commit child app files to this repo.

## Rules for every app

1. Only create routes under the prefixes the registry assigns to your app. The main site owns `/` and everything unclaimed.
2. Child apps use a unique production `assetPrefix` (e.g. `/mu-static`), `images.unoptimized: true`, `serverActions.allowedOrigins` including `connor.works`, and a pinned Next.js root (`ARCHITECTURE.md` §5.5).
3. Build absolute URLs from `SITE_URL`, never from the request `Host` header.
4. Link across apps with plain `<a href>`, not `next/link`.
5. Prefix cookie names per app (`cw_` for the main site, `mu_` for Meridian Underground).
6. Each app gets its own database and login role on the shared Postgres instance. Never connect to another app's database. Share data through the owning app's API.
7. Start servers with `next start -H ::` and put health checks under the app's own prefix.
8. **Keep `ARCHITECTURE.md` in sync.** When you change prefixes, services, environment variables or databases, update the registry and the affected sections in the same change.

## Main site specifics (repo root only)

- Owns `/robots.txt` (must include every child app's `Disallow` rules), `/sitemap.xml`, `/favicon.ico` and unknown-path 404s.
- **Never create pages under a child app's prefixes.** Next.js checks its own pages before rewrites, so such a page would hide the child app's page.
- Child apps are routed through the `zones` array in `next.config.ts` (`ARCHITECTURE.md` §5.2). Each zone's rewrites turn on only when its `*_URL` environment variable is set.
- Keep child app folders out of `tsconfig.json`, linters and test runners (`ARCHITECTURE.md` §5.5). Don't add a root `pnpm-workspace.yaml`.
- Scope any `middleware.ts` `matcher` so it doesn't run on child app prefixes.

## Local development

- Postgres for all apps runs in Docker from this folder: `docker compose up -d` (`ARCHITECTURE.md` §11). The compose file and init SQL are specified there, and may not exist yet.
- Commands: *add `dev`, `build`, `lint` and `test` here once the main site is scaffolded.*
