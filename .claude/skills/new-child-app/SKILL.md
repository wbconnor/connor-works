---
name: new-child-app
description: Add a new child app (zone) to connor.works, or set up the standard scaffolding for a child app that's already in the zone registry. Use when asked to create, add or set up a new child app, sub-site, section with its own repo, or zone under the connor.works domain.
---

# Add a child app to connor.works

A child app is a separate Next.js repo that owns a few URL prefixes on connor.works. The main site proxies those prefixes to it (`ARCHITECTURE.md` §1). This procedure touches four places:

| Place | Path (from the workspace root) |
|---|---|
| Config package (zone registry) | `connor-works-config/` (own git repo) |
| The new child app | `<folder>/` (own git repo) |
| Main site + workspace docs | `./` (the `wbconnor/connor-works` repo) |
| Local Postgres | `docker-compose.yml`, `docker/postgres-init/01-databases.sql` |

Run it with Claude started in `connor-works/`. Templates are in `templates/` next to this file.

**Never do these without asking first:** create GitHub repos, `git push` (including tags), or change anything on Railway, Cloudflare or the production database. Prepare everything locally, then hand off (step 8).

## 1. Gather inputs

Ask for anything not given. Propose defaults, and confirm them all in one message before changing anything.

| Input | Example | Default / rule |
|---|---|---|
| `app` (slug) | `photo-journal` | Lowercase, hyphenated. Also the Railway service name and the folder name. |
| Title | `Photo Journal` | Used in `AGENTS.md` |
| One-line description | `a photo blog of road trips` | Used in `AGENTS.md` |
| `prefixes` | `/photos` | One or more single-segment prefixes |
| `assetPrefix` | `/pj-static` | `/<short>-static` |
| `cookiePrefix` | `pj_` | `<short>_` |
| `database` | `photo_journal` or none | Slug with `_`; ask whether the app needs a database |
| `repo` | `wbconnor/photo-journal` | `wbconnor/<app>` |
| `urlEnv` | `PHOTO_JOURNAL_URL` | `<APP_IN_CAPS>_URL` |
| `healthPath` | `/photos/api/health` | `<first prefix>/api/health` |

**If the app is already in `connor-works-config/src/zones.mjs`** (e.g. `meridian-underground` before its Phase 0), take the inputs from the registry, skip step 3, and apply only the steps that aren't done yet.

## 2. Validate before changing anything

1. Check that `connor-works-config/` exists and has no uncommitted changes (`git -C connor-works-config status --porcelain`). If it's missing, stop and ask; it should be cloned from `wbconnor/connor-works-config`.
2. Check that `<folder>/` doesn't exist yet, unless the app is already registered and the folder holds only docs such as `DESIGN.md`.
3. Add the new entry to a **copy** of the registry and validate it:
   ```bash
   node --input-type=module -e "
     import { zones, validateZones } from './connor-works-config/src/index.mjs';
     const next = { ...zones, '<app>': { /* new entry */ } };
     console.log(validateZones(next));
   "
   ```
   The printed list must be empty.
4. If the main site has an `app/` directory, check that none of the new prefixes collide with main-site pages. Run `findRouteViolations({ app: 'main-site', appDir: 'app', registry: next })` from `./connor-works-config/src/routes.mjs` the same way. It must return `[]`.

Stop and report any conflict. Don't work around it.

## 3. Register the app in the config package

In `connor-works-config/`:
1. Add the entry to `src/zones.mjs`, after the existing child apps, with the same fields and comment style.
2. Add the new folder to the `workspaceFolders` expectation in `test/zones.test.mjs`.
3. Run `npm test`. Everything must pass.
4. Bump the **minor** version in `package.json`. Commit: `Add <app> to the zone registry`. Create the tag locally: `git tag v<version>`.
5. Ask whether to push the commit and tag now. Apps install the package from GitHub by tag, so the tag must be pushed before step 4 can install it from GitHub.
   - **Yes:** `git push && git push --tags`. In step 4, install from the tag.
   - **No:** in step 4, install from the local folder (`pnpm add ../connor-works-config`), and list "push the tag, then switch to the tag" in the handoff.

## 4. Scaffold the child app

From the workspace root:

1. **Create the app:** `pnpm create next-app@latest <folder> --ts --tailwind --eslint --app --no-src-dir --import-alias "@/*" --use-pnpm --yes`.
   - Check `pnpm create next-app@latest --help` first if a flag is rejected.
   - For an already-registered app whose folder exists with docs, create in a temporary folder and move the files in, keeping the existing docs.
2. **Initialize git:** `create-next-app` skips `git init` inside an existing git repo, and `connor-works/` is one. So in `<folder>/`: `git init -b main`, then `git remote add origin git@github.com:<repo>.git`.
3. **Install:**
   - `pnpm add "github:wbconnor/connor-works-config#v<version>"` as a regular dependency. Use the local folder instead if the tag wasn't pushed (step 3.5).
   - `pnpm add -D vitest`.
   - `eslint` must be `^9`, since `eslint-config-next` 16 doesn't support ESLint 10. Downgrade it if `create-next-app` installed a newer major.
4. **Copy templates,** replacing every `{{PLACEHOLDER}}`:
   | Template | Destination |
   |---|---|
   | `next.config.ts` | `next.config.ts` (replace the generated one) |
   | `eslint.config.mjs` | `eslint.config.mjs` (replace the generated one) |
   | `railway.json` | `railway.json` |
   | `health-route.ts` | `app<healthPath>/route.ts` |
   | `test/route-prefixes.test.ts` | `test/route-prefixes.test.ts` |
   | `vitest.config.ts` | `vitest.config.ts` |
   | `ci.yml` | `.github/workflows/ci.yml` |
   | `claude-settings.json` | `.claude/settings.json` |
   | `claude-hooks/*.mjs` | `.claude/hooks/*.mjs` |
   | `AGENTS.md` | `AGENTS.md` |

   **Placeholder values:**
   - `{{APP}}`, `{{TITLE}}`, `{{DESCRIPTION}}`, `{{ASSET_PREFIX}}`, `{{COOKIE_PREFIX}}`, `{{HEALTH_PATH}}`: from the inputs.
   - `{{PREFIXES_MD}}`: the prefixes as a Markdown list in prose, e.g. `` `/photos` and `/trips` ``.
   - `{{DATABASE_RULE}}`: with a database: "use only the `<database>` database via `DATABASE_URL`. Never touch other apps' databases on the shared instance." Without one: "none. Ask before adding one; it needs a registry change."
   - If `AGENTS.md` already exists (a registered app), merge in anything it's missing instead of overwriting.
5. **Write `CLAUDE.md`** containing the single line `@AGENTS.md`.
6. **Move the root page.** `create-next-app` generates `app/page.tsx` at `/`, which belongs to the main site. Move it to `app/<first prefix>/page.tsx`. Leave `app/layout.tsx` and `app/globals.css` where they are. Delete `app/favicon.ico`.
7. **Set up `package.json`:**
   - Scripts: `"dev": "next dev"`, `"build": "next build"`, `"start": "next start -H ::"`, `"lint": "eslint ."`, `"typecheck": "tsc --noEmit"`, `"test": "vitest run"`.
   - Keep the `packageManager` field that `create-next-app` set. CI's pnpm setup reads it.
8. **Add `.env.example`:**
   - Every app: `SITE_URL=https://connor.works` and `ALLOWED_ORIGINS=localhost:3000`.
   - With a database, also `DATABASE_URL=postgresql://<database>:dev@localhost:5432/<database>`.
   - Copy it to `.env` for local use. `.env*` must be git-ignored; `.env.example` stays committed, so add `!.env.example` to `.gitignore` if needed.
9. **Verify:**
   - `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build` all pass.
   - Temporarily add `app/about/page.tsx` and confirm the route test fails. Then add `<Link href="/">` in a page and confirm lint fails. Undo both.
10. **Commit** in `<folder>/`: `Scaffold <app> as a connor.works child app`.

## 5. Main site and workspace (root repo)

1. Add `<folder>/` to the root `.gitignore`.
2. If `tsconfig.json` exists at the root, add `<folder>` to its `exclude`. Do the same for any Prettier or test-runner ignore lists. ESLint needs no change, because `connorWorks({ app: 'main-site' })` ignores registry folders.
3. If the main site depends on `@connor-works/config`, bump it to the new tag (or the local folder, per step 3.5). The main site's rewrites come from `zoneRewrites()`, so no rewrite code changes.
4. If the main site has a `robots.txt`/`robots.ts`, ask which of the app's paths should be disallowed, and add them.
5. **Update `ARCHITECTURE.md`:** add a row to the §2 registry table, and add the folder to the §2 local layout tree.
6. **Update the root `AGENTS.md`:** add the app to the child app list under **Layout**.
7. Show the root repo diff and ask before committing it.

## 6. Local database (if the app has one)

1. If `docker-compose.yml` or `docker/postgres-init/01-databases.sql` is missing, create them from `ARCHITECTURE.md` §11.
2. Append to `01-databases.sql`:
   ```sql
   CREATE ROLE <database> LOGIN PASSWORD 'dev' CREATEDB;
   CREATE DATABASE <database> OWNER <database>;
   ```
3. If the container is running (`docker compose ps`), run the same two statements now. The init script only runs on an empty volume:
   ```bash
   docker compose exec -T postgres psql -U postgres -c "CREATE ROLE <database> LOGIN PASSWORD 'dev' CREATEDB;" -c "CREATE DATABASE <database> OWNER <database>;"
   ```
4. Once the app has migrations, add `"preDeployCommand": ["pnpm prisma migrate deploy"]` (or the app's migrate command) to its `railway.json`. Don't add it before migrations exist, or the deploy fails.

## 7. Final check

- `git status` in each of the three repos shows only the intended changes, and each is committed or waiting for approval.
- `npm test` passes in `connor-works-config/`. In `<folder>/`, lint, typecheck, test and build all pass.

## 8. Hand off

Print this checklist, filled in with the real values, and list anything from steps 3–6 that was skipped:

1. Create the GitHub repo `<repo>` (public or private), then push: `git -C <folder> push -u origin main`.
2. Push the config package, if not done in step 3: `git -C connor-works-config push && git -C connor-works-config push --tags`. Then switch every local install to the tag: `pnpm add "github:wbconnor/connor-works-config#v<version>"` in `<folder>/` and in the main site.
3. **Production database** (if any): run the §4.1 SQL on the Railway Postgres with a generated password:
   `CREATE ROLE <database> LOGIN PASSWORD '...'; CREATE DATABASE <database> OWNER <database>; REVOKE CONNECT ON DATABASE <database> FROM PUBLIC;`
4. **Railway:** in the `connor-works` project, add a service from `<repo>` named `<app>`, and set its variables:
   - `PORT=3000`, `SITE_URL=https://connor.works`, `ALLOWED_ORIGINS=connor.works`
   - with a database: `DATABASE_URL`, per `ARCHITECTURE.md` §4.2
5. Deploy it, and check that `<healthPath>` passes.
6. On `main-site`, set `<urlEnv>` = `http://${{<app>.RAILWAY_PRIVATE_DOMAIN}}:${{<app>.PORT}}`, and redeploy the main site with the new config package tag.
7. Smoke-test through `https://connor.works<first prefix>`: pages load with styling (assets from `<assetPrefix>/_next/`), links work, and any Server Actions succeed.
