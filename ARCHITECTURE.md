# connor.works — Workspace & Deployment Guide

This folder is the workspace for everything served at **https://connor.works**. The site is split across several repos. Each repo is its own Next.js app and its own Railway service, and together they appear to visitors as a single website on a single domain.

The **main site launches first** and owns the domain from day one. Child apps such as Meridian Underground are added behind it later. All apps share **one Postgres instance**, and each app gets its own database inside it.

This document covers:

1. [How the pieces fit together](#1-how-the-pieces-fit-together)
2. [Zone registry (who owns which URLs)](#2-zone-registry)
3. [Railway project layout](#3-railway-project-layout)
4. [The shared Postgres instance](#4-the-shared-postgres-instance)
5. [Deploying the main site](#5-deploying-the-main-site)
6. [Domain & DNS](#6-domain--dns)
7. [Deploying a child app (e.g. Meridian Underground)](#7-deploying-a-child-app)
8. [Rollout plan](#8-rollout-plan)
9. [Rules every repo must follow](#9-rules-every-repo-must-follow)
10. [Adding a new child app](#10-adding-a-new-child-app)
11. [Local development](#11-local-development)
12. [Troubleshooting](#12-troubleshooting)

---

## 1. How the pieces fit together

We use **Next.js Multi-Zones**. A "zone" is a separate Next.js app that owns a fixed set of URL path prefixes. The **main site** holds the `connor.works` domain and serves everything that isn't claimed by a child app (`/`, `/about`, and so on). For the prefixes a child app claims, the main site **proxies** the request to that app using `rewrites()`.

```
Browser ── https://connor.works/movie-night/2026-10-03/david-myers
   │
   ▼
Cloudflare DNS (connor.works → Railway)
   │
   ▼
Railway project "connor-works"
 ├─ main-site  ← has the connor.works custom domain
 │    owns: /, /about, /robots.txt, /sitemap.xml, ...
 │    rewrites() over the private network ─┐
 │                                          ▼
 ├─ meridian-underground  (meridian-underground.railway.internal:3000)
 │    owns: /meridian-underground, /movie-night, /movie-collection, /mu-static
 │
 ├─ (future child apps…)
 │
 └─ Postgres  (one instance, shared)
      ├─ database: main_site              ← only if the main site needs one
      ├─ database: meridian_underground
      └─ database: <future app>

Images: img.connor.works → Cloudflare R2 (separate from Railway)
```

Key points:

- **Only the main site has a public custom domain.** Child apps are reached over Railway's **private network** (`*.railway.internal`), so they don't need a public domain.
- The browser only ever talks to `connor.works`. It can't tell that several apps are involved.
- Each child app's JS/CSS is served under its own **asset prefix** (e.g. `/mu-static/_next/...`), so it doesn't collide with the main site's `/_next/...` files.
- Moving between apps is a **full page load**. Within an app, navigation stays client-side as usual.
- Because the main site owns the domain from the start, **you never have to move the domain**. Adding a child app just means deploying it and adding rewrites to the main site.

---

## 2. Zone registry

This table is the **source of truth** for URL ownership. Update it whenever a repo is added or claims a new prefix. Two apps must never claim the same prefix.

| Repo | Railway service | Owns path prefixes | Asset prefix | Cookie prefix | Database | Status |
|---|---|---|---|---|---|---|
| [`wbconnor/connor-works`](https://github.com/wbconnor/connor-works) (workspace root) | `main-site` | `/` and anything not listed below; `/robots.txt`, `/sitemap.xml`, `/favicon.ico` | *(none; uses `/_next`)* | `cw_` | `main_site` *(only if needed)* | Launching first |
| [`wbconnor/meridian-underground`](https://github.com/wbconnor/meridian-underground) | `meridian-underground` | `/meridian-underground`, `/movie-night`, `/movie-collection` | `/mu-static` | `mu_` | `meridian_underground` | In development |

Local layout:

```
connor-works/                                  ← git repo: wbconnor/connor-works (the main site)
├── .gitignore                                 ← lists every child app folder
├── ARCHITECTURE.md                            ← this file (cross-repo architecture)
├── AGENTS.md, CLAUDE.md                       ← instructions for AI agents
├── app/, package.json, next.config.ts, ...    ← main site Next.js app (once scaffolded)
├── railway.json
├── docker-compose.yml                         ← local Postgres for all apps (§11)
├── docker/postgres-init/01-databases.sql      ← local roles + databases (§11)
└── meridian-underground/                      ← separate git repo: wbconnor/meridian-underground, ignored here
    ├── DESIGN.md                              ← Meridian Underground design doc
    └── AGENTS.md, CLAUDE.md
```

The root repo is the **main site**. It also holds the documents and tooling that span every app: this file and the shared local Postgres setup. Each child app is its own repo, cloned inside this folder and listed in the root `.gitignore` so its files aren't committed twice. App-specific design docs live in each app's repo (e.g. `meridian-underground/DESIGN.md`). Because child apps sit inside the main site's folder, the main site's tooling must be told to ignore them (§5.5).

---

## 3. Railway project layout

Use **one Railway project** named `connor-works` and put every service in it. Services in the same project and environment share a private network. That network is what lets the main site proxy to the child apps and lets every app reach Postgres.

| Service | Source | Public domain? | Notes |
|---|---|---|---|
| `main-site` | GitHub `wbconnor/connor-works` | **Yes**: `connor.works` (+ `www`) | The router. Deploy first. |
| `Postgres` | Railway Postgres template | No | One instance, with a separate database per app (§4) |
| `meridian-underground` | GitHub `wbconnor/meridian-underground` | Optional `*.up.railway.app` domain for testing only | Child app |

Notes:

- **Name services exactly as in the registry.** The private hostname comes from the service name (`meridian-underground.railway.internal`), and `${{...}}` variable references use it too.
- Every service auto-deploys when its GitHub repo's `main` branch changes. Separate repos deploy independently: a push to one repo never redeploys another app. The only exception is that changing the main site's rewrites requires redeploying the main site.
- **Environments:** start with just `production`. You can enable PR environments later.

---

## 4. The shared Postgres instance

One Railway Postgres service hosts a **separate database for each app**. You pay for and manage one instance. Each app still keeps its own tables and its own Prisma migrations, so the apps never step on each other.

### 4.1 Create a database (and login) for each app

Railway's Postgres template starts with a single database named `railway`. You'll add one database per app, each with its own login role. The role limits an app to its own database.

Connect with the Railway CLI:

```bash
railway link            # select the connor-works project
railway connect Postgres
```

Then, in `psql`:

```sql
-- one block per app
CREATE ROLE meridian_underground LOGIN PASSWORD '<generate a long random password>';
CREATE DATABASE meridian_underground OWNER meridian_underground;
REVOKE CONNECT ON DATABASE meridian_underground FROM PUBLIC;

-- later, only if the main site needs a database:
-- CREATE ROLE main_site LOGIN PASSWORD '...';
-- CREATE DATABASE main_site OWNER main_site;
-- REVOKE CONNECT ON DATABASE main_site FROM PUBLIC;
```

Because each role owns its database, Prisma migrations run as that role and can create tables without extra grants.

### 4.2 Point each app at its database

On the `meridian-underground` service, add these variables:

| Variable | Value |
|---|---|
| `MU_DB_PASSWORD` | the password you set for the role above |
| `DATABASE_URL` | `postgresql://meridian_underground:${{MU_DB_PASSWORD}}@${{Postgres.RAILWAY_PRIVATE_DOMAIN}}:5432/meridian_underground?connection_limit=5` |

`${{Postgres.RAILWAY_PRIVATE_DOMAIN}}` keeps the connection on the private network. `${{MU_DB_PASSWORD}}` references a variable on the same service.

### 4.3 Trade-offs of sharing one instance

- **Shared resources:** a heavy query or runaway connection pool in one app slows down the others. At this site's scale, that's unlikely to matter.
- **Shared backups:** a restore brings back the whole instance, not just one app's data. To roll back a single app, use `pg_dump --dbname=meridian_underground` backups taken before risky migrations.
- **Connection limits:** the instance has one connection cap for all apps. Keep each app's Prisma pool small, e.g. `?connection_limit=5` on the `DATABASE_URL`.
- **No cross-database joins.** If one app needs another app's data, call that app's API (e.g. `/movie-collection/api/movies`). Don't connect to another app's database.
- **Splitting later is easy:** to move an app to its own instance, `pg_dump` its database, restore it elsewhere, and change its `DATABASE_URL`.

---

## 5. Deploying the main site

### 5.1 Config as code: `railway.json` in the repo root

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": { "builder": "RAILPACK", "buildCommand": "pnpm build" },
  "deploy": {
    "startCommand": "pnpm start",
    "healthcheckPath": "/api/health",
    "healthcheckTimeout": 120,
    "restartPolicyType": "ON_FAILURE"
  }
}
```

If the main site uses a database, add `"preDeployCommand": ["pnpm prisma migrate deploy"]` to the `deploy` section.

`package.json`:

```json
"scripts": {
  "build": "next build",
  "start": "next start -H ::"
}
```

`-H ::` makes Next listen on all interfaces, including IPv6, which Railway's private network uses. `next start` reads `$PORT` automatically.

### 5.2 Rewrites, written so the site deploys before any child app exists

Each child app's rewrites are added only when its URL variable is set. That means the main site can launch on its own, and you turn on a child app just by adding one variable.

```ts
// connor-works/next.config.ts (main site, repo root)
import type { NextConfig } from 'next';

// Child app registry. Keep in sync with connor-works ARCHITECTURE.md §2.
const zones = [
  {
    url: process.env.MERIDIAN_UNDERGROUND_URL, // http://meridian-underground.railway.internal:3000
    prefixes: ['/meridian-underground', '/movie-night', '/movie-collection', '/mu-static'],
  },
];

const nextConfig: NextConfig = {
  async rewrites() {
    return zones
      .filter((zone) => zone.url)
      .flatMap((zone) =>
        // `:path*` also matches the bare prefix (e.g. `/movie-night`)
        zone.prefixes.map((prefix) => ({
          source: `${prefix}/:path*`,
          destination: `${zone.url}${prefix}/:path*`,
        })),
      );
  },
};

export default nextConfig;
```

- **Don't create pages in the main site under a child app's prefixes.** Next.js checks its own pages before rewrites, so a main-site page there would hide the child app's page at that URL.
- `rewrites()` is evaluated **at build time**, so a changed `*_URL` variable only takes effect after the main site redeploys. Railway redeploys automatically when a variable changes.
- The private network isn't available **during the build step**. Don't fetch from child apps at build time.

### 5.3 Things the main site owns for everyone

Only one app can answer `/robots.txt`, `/sitemap.xml`, `/favicon.ico`, and unknown-path 404s, so the main site owns them for all apps:

- **`robots.txt`** includes every child app's rules. For Meridian Underground:
  ```
  User-agent: *
  Disallow: /movie-night/
  Disallow: /meridian-underground/admin/
  ```
- **`sitemap.xml`** lists public pages from every app, or links to per-app sitemaps (e.g. `/meridian-underground/sitemap.xml`, served by the child app through the rewrite).
- **Middleware:** if the main site uses `middleware.ts`, scope its `matcher` so it doesn't run on child app prefixes.
- **Navigation:** links from the main site into a child app use plain `<a href>`, not `next/link`.

### 5.4 First-time setup

1. **New Project** `connor-works` **→ Deploy from GitHub repo →** `wbconnor/connor-works`. Rename the service to `main-site`.
2. **+ New → Database → PostgreSQL**. Leave the name as `Postgres`. You can add it now, or wait until the first app needs a database.
3. Set `SITE_URL=https://connor.works` on `main-site`.
4. **Settings → Networking → Generate Domain** to get a `*.up.railway.app` URL. Check that the site and `/api/health` work there.
5. Attach `connor.works` (§6).

### 5.5 Keeping nested child apps out of the main site's tooling

Child app folders sit inside the main site's folder locally, but they're git-ignored, so Railway never sees them. Local tools that scan the folder tree will still find them unless told not to:

- **`.gitignore`:** list every child app folder (`meridian-underground/`), along with the usual `node_modules/`, `.next/` and `.env*`.
- **`tsconfig.json`:** add each child app folder to `exclude` (e.g. `"exclude": ["node_modules", "meridian-underground"]`). Otherwise the main site type-checks the child app's code.
- **ESLint / Prettier / Vitest / Playwright:** add the child app folders to their ignore patterns or test roots.
- **Tailwind v4** skips git-ignored files automatically. With an explicit `@source` or `content` config, keep it pointed at the main site's own folders.
- **No `pnpm-workspace.yaml` at the root.** The apps are separate projects, not a pnpm workspace. Each has its own `package.json`, lockfile and `node_modules`.
- **Pin the Next.js root in each child app:** set `outputFileTracingRoot: __dirname` and `turbopack: { root: __dirname }` in its `next.config.ts` (§7.2). When Next.js finds the main site's lockfile in a parent folder, it may otherwise treat `connor-works/` as the project root. On Railway the child app is cloned alone, so this only matters locally, but it's harmless there.

---

## 6. Domain & DNS

The domain goes on the **`main-site` service only**, once, and stays there.

1. In Railway, go to **`main-site` → Settings → Networking → Custom Domain** and add `connor.works` (and optionally `www.connor.works`).
2. Railway shows a **CNAME target** and a **TXT verification record**. Add them in Cloudflare DNS:
   | Type | Name | Target |
   |---|---|---|
   | CNAME | `@` | `<target from Railway>` (Cloudflare flattens a CNAME at the apex automatically) |
   | CNAME | `www` | `<target from Railway>` |
   | TXT | *(as shown by Railway)* | *(as shown by Railway)* |
3. If the Cloudflare proxy (orange cloud) is on, set **SSL/TLS mode to "Full"**. "Flexible" causes redirect loops. You can also turn the proxy off (grey cloud) and let Railway handle TLS.
4. Pick one canonical host. For example, add a Cloudflare redirect rule from `www.connor.works/*` to `https://connor.works/$1`.
5. `img.connor.works` is set up separately as an **R2 custom domain** in Cloudflare. It doesn't involve Railway.

---

## 7. Deploying a child app

Using Meridian Underground as the example.

### 7.1 `railway.json` in the child app repo

```json
{
  "$schema": "https://railway.com/railway.schema.json",
  "build": { "builder": "RAILPACK", "buildCommand": "pnpm build" },
  "deploy": {
    "startCommand": "pnpm start",
    "preDeployCommand": ["pnpm prisma migrate deploy"],
    "healthcheckPath": "/meridian-underground/api/health",
    "healthcheckTimeout": 120,
    "restartPolicyType": "ON_FAILURE"
  }
}
```

`package.json`:

```json
"scripts": {
  "build": "prisma generate && next build",
  "start": "next start -H ::"
}
```

### 7.2 `next.config.ts` for a child app

```ts
const nextConfig = {
  assetPrefix: process.env.NODE_ENV === 'production' ? '/mu-static' : undefined,
  images: { unoptimized: true },
  // Nested inside the main site's folder locally; stop Next.js from using the parent as the root (§5.5)
  outputFileTracingRoot: __dirname,
  turbopack: { root: __dirname },
  experimental: {
    serverActions: {
      allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean),
    },
  },
};
```

- **No `/` redirect.** The main site owns `/`.
- `assetPrefix` moves build assets to `/mu-static/_next/...` so the main site can forward that one prefix. Check this once in the browser's Network tab: the `.js` files should load from `/mu-static/_next/`.
- `serverActions.allowedOrigins` is required because, behind the proxy, the browser's `Origin` (`connor.works`) doesn't match the host the child app sees. Without it, every Server Action (RSVP, votes, seats) fails.
- `images.unoptimized` avoids `/_next/image` requests, which would be sent to the main site's image optimizer instead of the child app's.

### 7.3 Railway setup

1. **+ New → GitHub repo →** `wbconnor/meridian-underground`. Rename the service to `meridian-underground`.
2. Create its database and role on the shared instance (§4.1).
3. Set its variables:
   | Variable | Value |
   |---|---|
   | `PORT` | `3000`. Pin it so the main site knows which port to call. |
   | `MU_DB_PASSWORD`, `DATABASE_URL` | see §4.2 |
   | `SITE_URL` | `https://connor.works` |
   | `ALLOWED_ORIGINS` | `connor.works` (add the main site's `*.up.railway.app` host while testing, if needed) |
   | `SESSION_SECRET`, `TMDB_API_READ_TOKEN`, `R2_*`, `THEATER_TIMEZONE` | see `meridian-underground/DESIGN.md` §12.2 |
4. Optionally generate a `*.up.railway.app` domain for testing the app directly. It's harmless to keep, because all links and OG URLs are built from `SITE_URL`.
5. Deploy, and check that the health check passes.

### 7.4 Connect it to the main site

On the **`main-site`** service, add:

| Variable | Value |
|---|---|
| `MERIDIAN_UNDERGROUND_URL` | `http://${{meridian-underground.RAILWAY_PRIVATE_DOMAIN}}:${{meridian-underground.PORT}}` |

Use **`http://`**: private-network traffic stays inside Railway and has no TLS. The main site redeploys, and the rewrites from §5.2 turn on.

---

## 8. Rollout plan

**Stage 1: launch the main site**
- Deploy `main-site` (§5), attach `connor.works` (§6), and add the `Postgres` service.
- Add a placeholder "Meridian Underground: coming soon" link or section if you want one. Don't create routes under `/meridian-underground` in the main site, because they would hide the child app's pages later (§5.2).

**Stage 2: build Meridian Underground**
- Develop locally (§11), and optionally deploy it to Railway without connecting it to the main site (skip §7.4). You can test it at its `*.up.railway.app` URL.

**Stage 3: go live behind the main site**
- Set `MERIDIAN_UNDERGROUND_URL` on `main-site` (§7.4).
- Add Meridian Underground's rules to `robots.txt`, add its pages to the sitemap, and add navigation links (plain `<a>`).
- Smoke-test on `https://connor.works`: `/meridian-underground`, an invitation link, an RSVP submit (a Server Action), admin login, and gallery images.

**Rollback:** delete `MERIDIAN_UNDERGROUND_URL` from `main-site`. The rewrites disappear on the next deploy and the main site keeps running.

---

## 9. Rules every repo must follow

1. **Stay inside your prefixes.** Child apps only create routes under their prefixes in the [registry](#2-zone-registry). The main site never creates routes under a child app's prefixes.
2. **Child apps set a unique `assetPrefix`** in production (e.g. `/mu-static`), and the main site forwards it.
3. **Build absolute URLs from `SITE_URL`**, never from the request's `Host` header, which may be an internal Railway hostname behind the proxy.
4. **Links to another app use `<a href>`**, not `next/link`.
5. **Prefix cookie names** (`mu_session`, `cw_...`). All apps share one domain, so a cookie with `Path=/` from one app is sent to every app. Unprefixed names like `session` would collide.
6. **Set `serverActions.allowedOrigins`** to include `connor.works` in child apps that use Server Actions.
7. **Don't rely on `/_next/image`** in child apps. Use `images.unoptimized: true` or a custom loader.
8. **One database per app on the shared instance**, each with its own role (§4). Never connect to another app's database.
9. **Health check under your own prefix** (e.g. `/meridian-underground/api/health`), set in `railway.json`.
10. **Bind to `::`** (`next start -H ::`) so the private network can reach the app.

---

## 10. Adding a new child app

Checklist for a future app (e.g. `/projects`):

- [ ] Pick its prefixes, an asset prefix (e.g. `/projects-static`), a cookie prefix, and a database name. Add a row to the [registry](#2-zone-registry).
- [ ] Clone the new repo inside `connor-works/`, and add its folder to the root `.gitignore` and to the main site's `tsconfig.json` `exclude` and linter ignores (§5.5).
- [ ] In the new repo: set `assetPrefix`, the pinned Next.js root (§5.5), `images.unoptimized`, and `allowedOrigins`. Add `railway.json` with a health check, and set `"start": "next start -H ::"`.
- [ ] On the shared Postgres: `CREATE ROLE` + `CREATE DATABASE ... OWNER` (§4.1).
- [ ] Add the same role and database to `docker/postgres-init/01-databases.sql` for local dev (§11).
- [ ] In Railway: add the service to the `connor-works` project and set `PORT=3000`, `SITE_URL`, `ALLOWED_ORIGINS`, and `DATABASE_URL`.
- [ ] In the main site: add the app to the `zones` array in `next.config.ts` and set its `*_URL` variable on `main-site`.
- [ ] Update the main site's `robots.txt`, sitemap, and navigation.
- [ ] Deploy the child app first, then the main site. Smoke-test through `connor.works`.

---

## 11. Local development

**One app at a time (most of the time):** run it on its own and browse it directly. Child apps don't turn on `assetPrefix` in development, so they work without the main site.

```bash
cd meridian-underground
pnpm dev            # http://localhost:3000/meridian-underground
```

**Local database (Docker):** run one Postgres container for all apps, set up like production: one server, one database and one login per app. The apps themselves run directly on your Mac with `pnpm dev`. Only Postgres runs in Docker.

Put these two files in the workspace root, next to `ARCHITECTURE.md`. The database is shared by every app, so they're committed to the connor-works repo rather than to any app repo:

```yaml
# connor-works/docker-compose.yml
services:
  postgres:
    image: postgres:17        # match the major version of Railway's Postgres service
    restart: unless-stopped
    ports:
      - "5432:5432"           # change to "5433:5432" if something else already uses 5432
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./docker/postgres-init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      retries: 10

volumes:
  pgdata:
```

```sql
-- connor-works/docker/postgres-init/01-databases.sql
-- Runs only when the container starts with an empty data volume.
-- One role + database per app, matching production (§4.1).
-- CREATEDB is for local dev only: `prisma migrate dev` needs it to create its shadow database.
CREATE ROLE meridian_underground LOGIN PASSWORD 'dev' CREATEDB;
CREATE DATABASE meridian_underground OWNER meridian_underground;

CREATE ROLE main_site LOGIN PASSWORD 'dev' CREATEDB;
CREATE DATABASE main_site OWNER main_site;
```

Each app's `.env` (not committed):

```bash
# meridian-underground/.env
DATABASE_URL=postgresql://meridian_underground:dev@localhost:5432/meridian_underground
```

Everyday commands (run from the workspace root):

```bash
docker compose up -d                         # start Postgres in the background
docker compose ps                            # check it's healthy
docker compose exec postgres psql -U postgres   # open psql as the superuser
docker compose stop                          # stop it; data is kept
docker compose down -v                       # delete everything, including data (init script reruns on next start)
```

Then, in each app: `pnpm prisma migrate dev` to apply migrations, and `pnpm prisma db seed` (or `pnpm tsx scripts/seed.ts`) for sample data.

Notes:

- **Adding an app:** add its `CREATE ROLE`/`CREATE DATABASE` lines to `01-databases.sql`. The init script only runs on an empty volume, so for an existing setup either run the same SQL by hand in `psql` or reset with `docker compose down -v`.
- **Upgrading Postgres major versions** (e.g. 17 → 18) needs a fresh volume: `pg_dump` anything you want to keep, then `docker compose down -v`. Note that the `postgres:18` image stores data at a different path (`/var/lib/postgresql`), so update the volume mount at the same time.
- **Stop Postgres.app or Homebrew Postgres** if either is running, or change the host port. Otherwise the apps may connect to the wrong server.

**Testing the full setup locally:**

```bash
# terminal 1: child app, built in production mode so assetPrefix is active
cd meridian-underground && pnpm build && PORT=3001 ALLOWED_ORIGINS=localhost:3000 pnpm start

# terminal 2: main site pointing at the child app
MERIDIAN_UNDERGROUND_URL=http://localhost:3001 pnpm dev   # from the workspace root
# browse http://localhost:3000/meridian-underground
```

---

## 12. Troubleshooting

| Symptom | Likely cause / fix |
|---|---|
| Child app page loads through connor.works but has no styling and JS 404s | The asset prefix isn't forwarded. Check that `/mu-static` is in the main site's `zones` prefixes and that `assetPrefix` is set in the child app. |
| A child app URL shows the main site's 404 page | The main site has no rewrite for it. Check that the `*_URL` variable is set on `main-site` and that the main site redeployed after it was set. |
| A child app URL shows a main-site page | The main site has a page under that prefix. Remove it (§5.2). |
| RSVP/vote buttons fail with "Invalid Server Actions request" | `ALLOWED_ORIGINS` on the child app doesn't include the host you're browsing (`connor.works`, a Railway test domain, or `localhost:3000`). |
| Main site returns 502/500 for child app paths | The private URL is wrong: use `http://` (not https), make sure the port matches the child app's `PORT`, and make sure the app binds to `::`. Also check that the child app's deploy is healthy. |
| Invitation links or OG images point at `*.railway.internal` or `*.up.railway.app` | The code is using the request host. Build URLs from `SITE_URL`. |
| Logged out of one app when logging into another | Cookie name collision. Use per-app cookie prefixes. |
| Redirect loop after adding the domain | Cloudflare SSL mode is "Flexible". Switch it to "Full". |
| Pre-deploy (`prisma migrate deploy`) fails with "permission denied" or "database does not exist" | The role or database wasn't created, or the role doesn't own the database (§4.1). Check the database name and password in `DATABASE_URL`. |
| "Too many connections" | The apps share one instance's connection limit. Add `?connection_limit=5` to each app's `DATABASE_URL`. |
