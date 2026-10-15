# connor.works — Deploy Guide

Step-by-step instructions for deploying connor.works to Railway. `ARCHITECTURE.md` explains *why* things are set up this way; this file is the *how*, in the order you do it.

- **Part 1: First-time deploy:** the Railway project, the main site, the shared Postgres instance, and the domain. Done once.
- **Part 2: Deploying a new child app:** done once per app, including its production database.
- **Part 3: Maintenance deploys:** everyday code changes, migrations, config package updates, secrets, rollbacks, and database care.
- **Part 4: Reference:** variables per service and handy commands.

**Where things live**

| Thing | Provider |
|---|---|
| Domain registration (`connor.works`) | Namecheap |
| DNS, `img.connor.works` (R2 images) | Cloudflare (Namecheap's nameservers point here) |
| Apps and Postgres | Railway, one project named `connor-works` |
| Code | GitHub, one repo per app plus `wbconnor/connor-works-config` |

**Railway applies variable changes in batches.** When you add or edit variables (or settings) in the dashboard, Railway collects them as *staged changes*. Click **Deploy** (top of the canvas) to apply them. Nothing changes until you do.

---

## Part 1: First-time deploy

### 1.1 Before you start

Accounts: GitHub, Railway (a paid plan is recommended for always-on services and backups), Cloudflare (Free plan is enough), Namecheap.

Tools on your Mac:

```bash
brew install pnpm           # package manager for every app; each repo's packageManager field pins the version
brew install railway        # Railway CLI
brew install libpq          # psql, pg_dump, pg_restore (client only)
brew link --force libpq
railway login
```

The main site repo must be deployable:

- [ ] Scaffolded, with `pnpm build` passing locally.
- [ ] `"start": "next start -H ::"` in `package.json`.
- [ ] A health route at `/api/health` that returns `200`.
- [ ] `next.config.ts` uses `zoneRewrites()` (`ARCHITECTURE.md` §5.2), and `@connor-works/config` is installed **from a pushed git tag**, not the local folder. Railway can't see `../connor-works-config`.
- [ ] `robots.txt`, `sitemap.xml` and `favicon.ico` exist (`ARCHITECTURE.md` §5.3, `DESIGN.md` §9).
- [ ] Pushed to `main` on `wbconnor/connor-works`.

### 1.2 Create the Railway project and the main site service

1. In Railway: **New Project → Deploy from GitHub repo → `wbconnor/connor-works`**. Give Railway access to the repo if asked.
2. Rename the project to `connor-works` and the service to **`main-site`**: open the service and click its title at the top of the panel (Settings has no name field). Then check **Settings → Networking → Private Networking** shows `main-site.railway.internal`, because other services reach it there. Renaming alone may not set it; if it's empty or different, set it to `main-site`.
3. **Service → Settings:**
   - **Source:** branch `main`. Turn on **Wait for CI** so a push only deploys after GitHub Actions passes.
   - **Build / Deploy:** enter the settings in `ARCHITECTURE.md` §5.1: build `pnpm build`, start `pnpm start`, healthcheck `/api/health` with timeout `120`, restart policy **On failure**. There's no config file; Railway no longer reads `railway.json` for new services.
   - Click **Deploy** to apply the staged changes, then check the settings stuck. Changes left staged are easy to lose.
4. Let the first build run. It may fail health checks until the variables below are set, which is fine.

### 1.3 Add the shared Postgres instance

You can do this now or wait until the first app needs a database. Doing it now keeps the project complete.

1. In the project canvas: **+ Create → Database → PostgreSQL**. Keep the service name **`Postgres`**, which the `${{Postgres.…}}` variable references depend on.
2. **Postgres → Settings → Networking:** don't generate a public HTTP domain. Make sure there's a **TCP proxy** to port `5432`. It's what lets you run `railway connect`, `pg_dump` and `psql` from your Mac; apps never use it. The template may not create one: if not, click **+ TCP Proxy**, confirm `5432`, then add this variable on **Postgres** (not the app service), and deploy the staged changes:
   ```
   DATABASE_PUBLIC_URL=postgresql://${{PGUSER}}:${{POSTGRES_PASSWORD}}@${{RAILWAY_TCP_PROXY_DOMAIN}}:${{RAILWAY_TCP_PROXY_PORT}}/${{PGDATABASE}}
   ```
   Without it, `railway connect Postgres` fails with "Connection URL should point to the Railway TCP proxy".
3. **Postgres → Backups** (if your plan has it): turn on scheduled backups, daily at least. These back up the **whole instance**. Part 3.7 covers per-app dumps.
4. Note the version: `railway connect Postgres`, then `SELECT version();`.
   - Your local `pg_dump --version` must be the same major version or newer, or backups (Part 3.7) fail. If it's older, run `brew upgrade libpq`.
   - Keep the local Docker image (`docker-compose.yml`) on the same major version as the server.

The default `railway` database stays as it is. Each app gets its own database and role, created when that app is first deployed (Part 2.2). The main site doesn't get one unless it needs one; if it does, follow Part 2.2 with `main_site` as the name and set the pre-deploy command (Part 3.3).

### 1.4 Set the main site's variables

**`main-site` → Variables:**

| Variable | Value | Notes |
|---|---|---|
| `SITE_URL` | `https://connor.works` | All absolute URLs are built from this. |
| `PORT` | `3000` | Pinned so child apps can call `/api/notify` (`ARCHITECTURE.md` §12.3). |

Don't set any `*_URL` child app variables yet. Without them, the main site deploys on its own with no rewrites.

Click **Deploy** to apply the staged changes.

### 1.5 Test on the Railway domain

1. **`main-site` → Settings → Networking → Generate Domain** (target port `3000`). You get `main-site-production-xxxx.up.railway.app`.
2. Check:
   - [ ] The deploy is **Active** and its health check passed (Deployments tab).
   - [ ] `https://<railway-domain>/` renders.
   - [ ] `https://<railway-domain>/api/health` returns `200`.
   - [ ] Links and OG tags point to `https://connor.works/...`, not the Railway domain. That confirms `SITE_URL` is used.

Keep the Railway domain for debugging, or remove it after the custom domain works.

### 1.6 Move DNS from Namecheap to Cloudflare

Namecheap stays the registrar (renewals and billing). Cloudflare runs DNS, because:
- it can do CNAME flattening at the apex, which Railway needs for `connor.works`, and
- R2's custom domain (`img.connor.works`) requires the zone to be on Cloudflare.

1. **Cloudflare → Add a domain → `connor.works`**, Free plan. Cloudflare imports any existing records. Delete the Namecheap parking records (usually a `CNAME www → parkingpage.namecheap.com` and a URL redirect record).
2. Cloudflare shows two nameservers (e.g. `ada.ns.cloudflare.com`, `bob.ns.cloudflare.com`).
3. **Namecheap → Domain List → connor.works → Manage:**
   - If **DNSSEC** is on (Advanced DNS tab), turn it **off** first. A stale DS record breaks resolution after the nameserver switch.
   - **Nameservers → Custom DNS**, enter both Cloudflare nameservers, and save.
4. Wait for Cloudflare to email that the zone is **Active**. This usually takes minutes, and at most 24–48 hours. Check with `dig NS connor.works +short`.
5. Optional, once active: enable DNSSEC in Cloudflare (**DNS → Settings**), then add the DS record it gives you in Namecheap (**Advanced DNS → DNSSEC**).

> **Note:** once nameservers move, Namecheap's free email forwarding stops working. If you used it, set up **Cloudflare Email Routing** instead.

### 1.7 Attach `connor.works` to the main site

1. **`main-site` → Settings → Networking → Custom Domain → `connor.works`** (target port `3000`). Repeat for `www.connor.works`.
2. Railway shows a **CNAME target** (e.g. `abc123.up.railway.app`) and a **TXT verification record** for each domain. Add them in **Cloudflare → DNS → Records**:

   | Type | Name | Content | Proxy |
   |---|---|---|---|
   | CNAME | `@` | Railway's target for `connor.works` | DNS only (grey) at first |
   | CNAME | `www` | Railway's target for `www.connor.works` | DNS only (grey) at first |
   | TXT | as shown (e.g. `_railway-verify`) | as shown | n/a |
   | TXT | as shown for `www` | as shown | n/a |

3. Wait until Railway shows both domains as verified, with a certificate issued (green check).
4. **Choose the proxy mode:**
   - **Simple:** leave the records grey (DNS only). Railway handles TLS end to end.
   - **Cloudflare proxy (orange):** gives caching, analytics and redirect rules. If you switch it on, set **SSL/TLS → Overview → Full** first. "Flexible" causes infinite redirects.
5. **Canonical host:** pick `https://connor.works`. Redirect `www`:
   - Proxied: **Cloudflare → Rules → Redirect Rules**: hostname equals `www.connor.works` → dynamic `concat("https://connor.works", http.request.uri.path)`, 301, preserve query string.
   - Not proxied: do the redirect in the main site (middleware or `redirects()` on host `www.connor.works`).
6. Verify:
   ```bash
   dig connor.works +short
   curl -sI https://connor.works/api/health        # HTTP/2 200
   curl -sI https://www.connor.works/              # 301 → https://connor.works/
   ```

### 1.8 Images domain (when the first app needs R2)

`img.connor.works` is separate from Railway: **Cloudflare → R2 → bucket → Settings → Custom Domains → Connect `img.connor.works`**. Cloudflare creates the DNS record itself. Each app's `R2_*` variables are set in Part 2.3.

### 1.9 Optional: admin email notifications

If the main site implements `/api/notify` (`ARCHITECTURE.md` §12):

1. **Resend → Domains → Add `connor.works`** (or a subdomain such as `notify.connor.works`). Add the SPF, DKIM (and optional DMARC) records it shows in Cloudflare DNS. Keep them **DNS only**. Wait until Resend says "Verified".
2. On `main-site`, set `RESEND_API_KEY`, `NOTIFY_EMAIL_FROM`, `NOTIFY_EMAIL_TO`, and `NOTIFY_API_KEY` (`openssl rand -hex 32`). Then deploy.

### 1.10 First-deploy checklist

- [ ] `https://connor.works` serves the main site over HTTPS. `www` redirects to it.
- [ ] `/api/health`, `/robots.txt`, `/sitemap.xml` and `/favicon.ico` all respond.
- [ ] The `Postgres` service is running, and backups are enabled if available.
- [ ] Every secret is also saved in your password manager.

---

## Part 2: Deploying a new child app

Do this once per child app. Meridian Underground is the example; swap in the values from the app's entry in `connor-works-config/src/zones.mjs`.

| Registry field | Meridian Underground |
|---|---|
| `service` | `meridian-underground` |
| `database` | `meridian_underground` |
| `urlEnv` | `MERIDIAN_UNDERGROUND_URL` |
| `healthPath` | `/meridian-underground/api/health` |
| `prefixes` / `assetPrefix` | `/meridian-underground`, `/movie-night`, `/movie-collection` / `/mu-static` |

### 2.1 Before you start

- [ ] The app was set up with the **`new-child-app` skill** (`ARCHITECTURE.md` §10). It's in `zones.mjs`, its repo is scaffolded, and the main site's docs and ignores are updated.
- [ ] The **config package tag** with the app's registry entry is pushed (`git -C connor-works-config push --tags`).
- [ ] The child app is pushed to GitHub. It installs `@connor-works/config` **from that tag**, and lint, typecheck, test and build pass in CI.
- [ ] The main site is bumped to the same config tag and pushed (`pnpm add "github:wbconnor/connor-works-config#vX.Y.Z"`). This is safe to deploy early: the new app's rewrites stay off until its `urlEnv` is set.

### 2.2 Create the app's production database

Skip this if the app's registry entry has `database: null`.

1. Generate a password. Use hex so it needs no escaping in a URL:
   ```bash
   openssl rand -hex 32
   ```
   Save it in your password manager as "connor.works Postgres: meridian_underground".
2. Connect as the superuser:
   ```bash
   cd ~/Dev/connor-works
   railway link                 # choose the connor-works project, production environment
   railway connect Postgres     # opens psql on the `railway` database
   ```
3. Create the role and database:
   ```sql
   CREATE ROLE meridian_underground LOGIN PASSWORD '<password from step 1>';
   CREATE DATABASE meridian_underground OWNER meridian_underground;
   REVOKE CONNECT ON DATABASE meridian_underground FROM PUBLIC;
   ```
   The role owns its database, so its migrations can create tables without extra grants. `REVOKE … FROM PUBLIC` stops other apps' roles from connecting to it.
4. Check:
   ```sql
   \l meridian_underground        -- owner = meridian_underground, no "=c/" entry for PUBLIC
   \du meridian_underground       -- LOGIN, no superuser/createdb
   ```
   Quit with `\q`.

Don't give production roles `CREATEDB`. That's only needed locally, for Prisma's shadow database.

### 2.3 Create the Railway service

1. In the `connor-works` project: **+ Create → GitHub Repo → `wbconnor/meridian-underground`**.
2. Rename the service to exactly **`meridian-underground`**, the registry's `service`. The private hostname comes from it.
3. **Settings:** branch `main`, **Wait for CI** on, and enter the build, start, healthcheck and restart settings from `ARCHITECTURE.md` §7.1 (healthcheck path = the registry's `healthPath`).
4. **Variables:**

   | Variable | Value |
   |---|---|
   | `PORT` | `3000` |
   | `SITE_URL` | `https://connor.works` |
   | `ALLOWED_ORIGINS` | `connor.works` |
   | `MU_DB_PASSWORD` | the password from 2.2 |
   | `DATABASE_URL` | `postgresql://meridian_underground:${{MU_DB_PASSWORD}}@${{Postgres.RAILWAY_PRIVATE_DOMAIN}}:5432/meridian_underground?connection_limit=5` |
   | `MAIN_SITE_URL` | `http://${{main-site.RAILWAY_PRIVATE_DOMAIN}}:${{main-site.PORT}}` (only if the app sends notifications) |
   | `NOTIFY_API_KEY` | the same value as on `main-site` (only if the app sends notifications) |
   | App-specific | e.g. `SESSION_SECRET`, `TMDB_API_READ_TOKEN`, `R2_*`, `THEATER_TIMEZONE`. See the app's `DESIGN.md` / `.env.example`. |

5. **Migrations:** if the app has Prisma migrations, set **Settings → Deploy → Pre-deploy command** to `pnpm prisma migrate deploy`. On the first deploy this creates all tables. If the app has no migrations yet, leave the command out, or the deploy fails.
6. Click **Deploy**.

### 2.4 Verify the app on its own

1. Deployments tab: the pre-deploy step (migrations) succeeded, the health check passed, and the deploy is **Active**.
2. Optional: **Settings → Networking → Generate Domain** to browse it directly at `*.up.railway.app<first prefix>`. To test Server Actions there, temporarily add that host to `ALLOWED_ORIGINS` (comma-separated).
3. Seed production data if the app needs it. The seed runs on your Mac, where `*.railway.internal` doesn't resolve, so connect through the Postgres TCP proxy (host and port from `DATABASE_PUBLIC_URL` on the `Postgres` service) as the app's own role:
   ```bash
   cd meridian-underground
   DATABASE_URL="postgresql://meridian_underground:<password>@<proxy-host>:<proxy-port>/meridian_underground" \
     pnpm prisma db seed
   ```

At this point the app runs but isn't reachable through `connor.works`. That's fine for staging (`ARCHITECTURE.md` §8, Stage 2).

### 2.5 Connect it to the main site (go live)

1. **`main-site` → Variables:**

   | Variable | Value |
   |---|---|
   | `MERIDIAN_UNDERGROUND_URL` | `http://${{meridian-underground.RAILWAY_PRIVATE_DOMAIN}}:${{meridian-underground.PORT}}` |

   Use `http://`: private-network traffic has no TLS.
2. Click **Deploy**. The main site rebuilds; rewrites are evaluated at build time, so they only take effect with this new build.
3. In the main site repo, if not already done: add the app's `Disallow` lines to `robots.txt` and its home page card to `app/projects.ts` (`DESIGN.md` §5.1). The `new-child-app` skill normally does both. Push. The card and the app's sitemap entry appear with the build from step 2, because both require the app's `urlEnv` to be set (`DESIGN.md` §5.2, §9.2).

### 2.6 Smoke test through `connor.works`

- [ ] `https://connor.works/meridian-underground` loads with styling. In DevTools → Network, the JS/CSS come from `/mu-static/_next/…` with status 200.
- [ ] Each prefix (`/movie-night/…`, `/movie-collection`) responds.
- [ ] A Server Action works (e.g. RSVP submit). If it fails with "Invalid Server Actions request", fix `ALLOWED_ORIGINS`.
- [ ] Login works, and cookies are named with the app's prefix (`mu_…`).
- [ ] Links, invitation URLs and OG images use `https://connor.works`.
- [ ] Images from `img.connor.works` load.
- [ ] `/robots.txt` includes the new rules.
- [ ] The home page shows the app's card, linking to its first prefix, and `/sitemap.xml` lists that URL.

### 2.7 Undo

To take the app offline without touching anything else, delete `MERIDIAN_UNDERGROUND_URL` from `main-site` and deploy. The prefixes fall back to the main site's 404, and the app and its data stay intact.

---

## Part 3: Maintenance deploys

### 3.1 Routine code changes

Each service redeploys automatically when its repo's `main` branch changes (after CI passes, with **Wait for CI** on). Repos deploy independently.

1. Work on a branch, open a PR, and let CI run (lint, typecheck, route-prefix test, build).
2. Merge to `main`. Railway builds, runs the pre-deploy command, and switches traffic only after the health check passes. If any step fails, **the previous deployment keeps serving**.
3. Watch it: **Service → Deployments → View logs**, or `railway logs --service <service>`.
4. Spot-check the pages you changed on `https://connor.works`.

**Main-site-only rule:** a child app's routing changes only when the **main site** redeploys. That covers config package bumps and `*_URL` changes. Code changes in a child app never need a main site deploy.

### 3.2 Deploys with database migrations

Each app runs its own migrations in its pre-deploy command (`pnpm prisma migrate deploy`) as its own role, against its own database only.

1. **Create the migration locally** against Docker Postgres: `pnpm prisma migrate dev --name <change>`. Commit the generated `prisma/migrations/…` folder.
2. **Keep it backward compatible.** Migrations run while the *old* code is still serving, and the old code keeps serving if the deploy fails. So:
   - Adding tables, nullable columns, or columns with defaults is safe in one deploy.
   - **Renames, drops, and new `NOT NULL` columns without defaults** need two deploys. First add the new shape and deploy code that works with both shapes. Then remove the old shape in a later deploy.
3. **Back up the app's database before risky migrations** (anything that drops, renames or rewrites data). See 3.7.
4. Merge. If the migration fails, the deploy stops, the old code keeps running, and Prisma records the failed migration. Fix it with `prisma migrate resolve` (see the Prisma docs) before redeploying.
5. **Rolling back code doesn't roll back the schema.** If a migration has to be undone, write a new forward migration, or restore from the backup.

### 3.3 Adding a database to an app that didn't have one

1. Change the registry first: set `database` in `zones.mjs`, release a tag, and bump the app to it (Part 3.4).
2. Production: create the role and database (Part 2.2) and set `<APP>_DB_PASSWORD` and `DATABASE_URL` on the service (Part 2.3).
3. Local: add the `CREATE ROLE … CREATEDB` / `CREATE DATABASE` lines to `docker/postgres-init/01-databases.sql`, and run them by hand in the running container (`ARCHITECTURE.md` §11).
4. When the PR with the first migration merges, set the service's **Pre-deploy command** to `pnpm prisma migrate deploy` (Settings → Deploy). Don't set it before migrations exist, or the deploy fails.

### 3.4 Updating the config package (`@connor-works/config`)

Apps only get a change when you bump their pinned tag.

1. In `connor-works-config/`: make the change, run `npm test`, bump the version (minor for registry changes), commit, `git tag vX.Y.Z`, and `git push && git push --tags`.
2. In each app that needs it: `pnpm add "github:wbconnor/connor-works-config#vX.Y.Z"`, run its checks, and push. The **main site** needs the bump whenever prefixes or asset prefixes change, because its rewrites come from the registry.

**Order for prefix changes:**

| Change | Order |
|---|---|
| Add a prefix to a child app | Tag → **child app** deploys the new routes → **main site** bumps and deploys (starts forwarding). |
| Remove a prefix from a child app | Tag → **main site** bumps and deploys (stops forwarding) → **child app** removes the routes. |
| Change an `assetPrefix` | Tag → bump and deploy **both** back to back. Expect a short window of unstyled pages, or do it at a quiet time. |

Also update `ARCHITECTURE.md` §2 and `robots.txt` in the same round (`AGENTS.md` rule 8).

### 3.5 Changing variables and rotating secrets

- Edit the variable in the service's **Variables** tab, then click **Deploy**. A variable change always means a new deployment.
- **Shared secrets** (e.g. `NOTIFY_API_KEY`) must match on several services. Change all of them in one staged batch, then deploy, so nothing runs with mismatched values for long.
- **Rotating an app's database password:**
  1. `railway connect Postgres`, then `ALTER ROLE meridian_underground PASSWORD '<new hex password>';`
  2. Immediately update `MU_DB_PASSWORD` on the service and deploy. Requests that open new connections fail until this deploy is live, so do it at a quiet time.
  3. Update your password manager.

### 3.6 Rolling back a bad deploy

- **Code:** **Service → Deployments → pick the last good deployment → ⋮ → Rollback** (or **Redeploy**). Then revert the commit on `main`, or the next push brings the bug back.
- **Schema:** see 3.2 step 5. The rollback doesn't undo migrations.
- **A child app breaks the site:** delete its `*_URL` on `main-site` and deploy (Part 2.7).

### 3.7 Database care

**Per-app backup** before risky migrations, or on a schedule you choose. Instance backups restore *every* app at once, so this is how you protect a single app.

```bash
# Public host, port and superuser password: Postgres service → Variables → DATABASE_PUBLIC_URL
pg_dump "postgresql://postgres:<PGPASSWORD>@<proxy-host>:<proxy-port>/meridian_underground" \
  -Fc -f ~/Backups/connor-works/meridian_underground-$(date +%F).dump
```

Keep dumps outside the repo, since they contain user data.

**Restore one app's database** (overwrites it):

```bash
pg_restore --clean --if-exists --no-owner --role=meridian_underground \
  -d "postgresql://postgres:<PGPASSWORD>@<proxy-host>:<proxy-port>/meridian_underground" \
  ~/Backups/connor-works/meridian_underground-2026-10-09.dump
```

Stop writes first, by temporarily removing the app's `*_URL` from `main-site` or pausing the service.

**Restore the whole instance:** **Postgres → Backups → Restore**. This rolls back **all** apps to that point. Use it only for instance-wide disasters.

**Health checks, now and then:**

```sql
-- connections per database (all apps share one limit)
SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;
SHOW max_connections;
-- size per database
SELECT datname, pg_size_pretty(pg_database_size(datname)) FROM pg_database ORDER BY 2 DESC;
```

If connections run short, lower each app's `connection_limit` in its `DATABASE_URL` before raising `max_connections`. Also watch the Postgres volume usage in its **Metrics** tab, and grow the volume before it fills.

**Upgrading Postgres major versions:** dump each app database (above), create a new Postgres service on the new version, recreate the roles and databases (Part 2.2), restore each dump, point each `DATABASE_URL` at the new service, then remove the old one. Update the local `docker-compose.yml` image to match (`ARCHITECTURE.md` §11).

### 3.8 Retiring a child app

1. Delete its `*_URL` from `main-site` and deploy. The app is now offline.
2. Take a final `pg_dump` of its database (3.7) and keep it.
3. Delete the Railway service.
4. Drop its database and role:
   ```sql
   DROP DATABASE meridian_underground;
   DROP ROLE meridian_underground;
   ```
5. Remove it from `zones.mjs` and release a tag. Bump the main site, and remove its `robots.txt` rules and its entry in `app/projects.ts` (its sitemap entry goes with the card). Update `ARCHITECTURE.md` §2, the root `AGENTS.md`, `.gitignore`/`tsconfig.json` excludes, and the local init SQL.

---

## Part 4: Reference

### 4.1 Variables by service

| Service | Variable | Value |
|---|---|---|
| `main-site` | `SITE_URL` | `https://connor.works` |
| | `PORT` | `3000` |
| | `<APP>_URL` (one per live child app) | `http://${{<service>.RAILWAY_PRIVATE_DOMAIN}}:${{<service>.PORT}}` |
| | `RESEND_API_KEY`, `NOTIFY_EMAIL_FROM`, `NOTIFY_EMAIL_TO`, `NOTIFY_API_KEY` | only with notifications (§1.9) |
| | `DATABASE_URL` (+ password var) | only if the main site gets a database |
| each child app | `PORT` | `3000` |
| | `SITE_URL` | `https://connor.works` |
| | `ALLOWED_ORIGINS` | `connor.works` |
| | `<APP>_DB_PASSWORD`, `DATABASE_URL` | if it has a database (§2.3) |
| | `MAIN_SITE_URL`, `NOTIFY_API_KEY` | if it sends notifications |
| | app-specific | see the app's `DESIGN.md` / `.env.example` |
| `Postgres` | *(managed by the template)* | don't edit |

### 4.2 Handy commands

```bash
railway link                                  # pick project/environment for this folder
railway status                                # what's linked
railway logs --service <service>              # tail logs
railway variables --service <service>         # list variables (shows secrets!)
railway connect Postgres                      # psql as superuser
dig connor.works +short                       # DNS check
curl -sI https://connor.works/<healthPath>    # health check through the domain
```

### 4.3 When something goes wrong

See `ARCHITECTURE.md` §13 for the symptom → fix table: unstyled child pages, 404s/502s on child prefixes, Server Action errors, redirect loops, migration permission errors, and too many connections.
