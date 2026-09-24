# Meridian Underground — Design Document

> Home theater website for connor.works: public showcase pages, a movie collection, and a movie-night invitation system with RSVPs, seat reservations, and voting.
>
> **Audience:** Claude Code (implementation) and Connor (owner/admin).
> **Status:** v1 spec. Items marked **[ASSUMPTION]** are defaults chosen during design and may be changed; items in §15 are still open.

---

## 1. Overview

Meridian Underground is a 7.3.4 Dolby Atmos basement home theater. This site has three areas:

1. **Public showcase** at `/meridian-underground`: home, gallery, build blog, special thanks, and the system and gear list.
2. **Movie Collection** at `/movie-collection`: a public, browsable library of about 200 owned movies. Metadata comes from TMDb. It also provides a read API for the invitations feature.
3. **Movie Night** at `/movie-night`: per-guest invitation pages with RSVP, crescent seat map, voting (movie, dinner, date, time), and comments. Includes an admin dashboard for creating events and managing invitees, and friend profiles with stats.

This is one Next.js app in its own repo. It runs as a child app (a "zone") behind the main connor.works site, which launches first and owns the domain. The main site proxies this app's path prefixes to it using Next.js Multi-Zones (see §12 and the connor-works `ARCHITECTURE.md`).

---

## 2. Decisions (from owner Q&A)

| Topic | Decision |
|---|---|
| Stack | Next.js (App Router), TypeScript, Tailwind CSS |
| Hosting | Railway: this app's own service in the shared `connor-works` project, behind the main site |
| Database | PostgreSQL: its own `meridian_underground` database on the shared connor.works Postgres instance; ORM: Prisma **[ASSUMPTION]** |
| Structure | One codebase; Movie Collection is a module, not a separate app |
| Admin auth | Email + password; multiple admins supported, launch with one |
| Guest auth | Secret URL only (no token): `/movie-night/{event-slug}/{friend-slug}` |
| URL style | Hyphens everywhere (e.g. `david-myers`) |
| Events per date | One active event per date |
| Event ID | Internal ID (cuid). The date is the URL **slug**, not the ID. If the date changes, a new event is created and old links redirect to the new one |
| Seats | 4 seats, no names or numbers shown to users. Admin may reserve seats. Allowed +1s are set per invitee, per invitation |
| Link delivery | Copy-to-clipboard and native Share button only. No email or SMS in v1 |
| Notifications | None in v1 |
| Vote closing | Admin closes voting manually. Guests see totals, not who voted for what |
| Dinner | Admin enters options (free text + optional link). Guests may write in suggestions |
| Time voting | Free-form times, each explicitly labeled as either "dinner starts" or "movie starts" |
| Adding movies | TMDb search + CSV import |
| Custom per-title data | Format(s) owned: 4K UHD, Blu-ray, DVD, Digital |
| Scope | Movies only (no TV) |
| Collection visibility | Public |
| Collection size | About 200 titles |
| Theme | Dark mode only, off-white text, Rainstorm as the accent color, minimal (like the theater) |
| Fonts | Cinematic display font + clean sans-serif |
| Gallery | Admin uploads; images stored on Cloudflare R2 |
| Blog | Markdown files in the repo |
| Gear list | Show used prices publicly, show a total, link to products |
| Home page | Hero image, short intro, upcoming movie nights, links to public pages (never to invitations) |
| Friend stats | Nights attended (dates + total), favorite seat, movies watched, vote win rate |
| Friend profiles | Admin-only in v1. Built so friends can later access their own profile with a password |

---

## 3. Sitemap & Routes

The app owns **only** these top-level path prefixes: `/meridian-underground`, `/movie-night`, `/movie-collection`, and `/mu-static` (static assets). It must not create routes outside them. The main site owns `/`, `/robots.txt`, `/sitemap.xml`, `/favicon.ico`, and every other path.

### Public
| Route | Page |
|---|---|
| `/meridian-underground` | Home |
| `/meridian-underground/gallery` | Photo gallery |
| `/meridian-underground/blog` | Build blog index |
| `/meridian-underground/blog/[slug]` | Blog post |
| `/meridian-underground/thanks` | Special Thanks |
| `/meridian-underground/system` | System description & gear list |
| `/movie-collection` | Collection browser |
| `/movie-collection/[movieSlug]` | Movie detail (slug = `{title}-{year}`, e.g. `blade-runner-2049-2017`) |

### Guest (secret URL, `noindex`)
| Route | Page |
|---|---|
| `/movie-night/[eventSlug]/[friendSlug]` | Personal invitation / RSVP page |
| `/movie-night/[eventSlug]` | Generic page: "This invitation is personal. Ask your host for your link." No event details |
| `/movie-night` | Same generic page (no event list) |

### Admin (password-protected, `noindex`)
| Route | Page |
|---|---|
| `/meridian-underground/admin/login` | Login |
| `/meridian-underground/admin` | Dashboard |
| `/meridian-underground/admin/events/new` | Create movie night (wizard) |
| `/meridian-underground/admin/events/[id]` | Event management |
| `/meridian-underground/admin/friends` | Friends list |
| `/meridian-underground/admin/friends/[friendSlug]` | Friend profile & stats (v1 admin-only; see §9.4) |
| `/meridian-underground/admin/collection` | Manage collection |
| `/meridian-underground/admin/collection/import` | CSV import |
| `/meridian-underground/admin/lists` | Custom movie lists |
| `/meridian-underground/admin/gallery` | Gallery uploads |
| `/meridian-underground/admin/settings` | Admin accounts, welcome message templates |

### API (route handlers)
| Route | Purpose |
|---|---|
| `GET /movie-collection/api/movies` | Collection search (see §8.4) |
| `GET /movie-collection/api/movies/[id]` | Single movie |
| `GET /movie-collection/api/genres` | Genres present in the collection |
| `GET /movie-collection/api/lists` | Custom lists |
| `POST /meridian-underground/api/admin/gallery/upload` | Multipart image upload (admin only) |

Everything else (RSVP, votes, seat changes, admin actions) uses **Server Actions**.

### Navigation
- **Header (public):** Meridian Underground wordmark (links home) · Gallery · Build Blog · System · Collection · Thanks
- **Footer:** © Meridian Underground · TMDb attribution (required; see §8.5) · small "Admin" link
- **Never** link to invitation pages from public navigation.

---

## 4. Visual Design

### 4.1 Principles
The theater is minimal, and the site should feel like the room with the lights down:
- Dark surfaces and generous negative space.
- Thin 1px dividers; small corner radius (4px).
- No heavy shadows or gradients. The one exception is a subtle vignette on hero images.
- Poster art and photos provide the color. The UI stays quiet.
- Motion is subtle (150–250ms fades and slides) and disabled under `prefers-reduced-motion`.

### 4.2 Color tokens
Brand colors are fixed. Derived tokens (marked *derived*) were chosen for contrast and can be tuned.

| Token | Hex | Use |
|---|---|---|
| `bg` | `#2F2F30` | **Tricorn Black.** Page background |
| `bg-deep` | `#262627` | *Derived.* Header, footer, hero overlays, admin sidebar |
| `surface` | `#38383A` | *Derived.* Cards, sheets, inputs |
| `border` | `#585858` | **Peppercorn.** Dividers, input borders, available-seat outline |
| `muted` | `#585858` | **Peppercorn.** Disabled states, taken seats |
| `accent` | `#244653` | **Rainstorm.** Primary buttons, selected seats, selected votes, movie-page divider bars |
| `accent-hover` | `#2E5868` | *Derived.* Hover/active on accent |
| `accent-light` | `#7FB0C2` | *Derived.* Links, focus rings, and accent **text** on dark backgrounds (~5.7:1 on `bg`) |
| `text` | `#ECE9E4` | Off-white body text (~12:1 on `bg`) |
| `text-muted` | `#B5B5B5` | Secondary text (~6.6:1 on `bg`) |
| `danger` | `#C96A5A` | *Derived.* Destructive actions, errors |

**Contrast rules:**
- Rainstorm (`#244653`) on `bg` is only about 1.4:1. **Never use it for text or thin lines on dark backgrounds.** Use it as a *fill* with off-white content on top (about 8:1). Use `accent-light` for accent text and focus rings.
- Peppercorn is also too low-contrast for text (about 1.9:1). Use it for borders and fills only.
- Never show a state with color alone. Selected items also get a checkmark or ring; taken seats also get initials or an icon.

Implement the tokens as CSS variables mapped in the Tailwind theme (`bg-surface`, `text-accent-light`, etc.).

### 4.3 Typography
- **Display font:** Bebas Neue (via `next/font/google`). Use for page titles, section headers, and the wordmark. Uppercase, letter-spacing `0.04em`. Alternatives if it feels too loud: Oswald, Big Shoulders Display.
- **Body/UI font:** Inter.
- **Scale:** display 56/40/32px; body 16px; small 14px; micro labels 12px uppercase with letter-spacing.

### 4.4 Layout
- Max content width 1200px; gutters 16px (mobile), 24px (tablet), 32px (desktop).
- Breakpoints: Tailwind defaults (`sm` 640, `md` 768, `lg` 1024, `xl` 1280).
- Mobile-first. Guests will mostly open invitations on phones.

### 4.5 Core components
- `Button`: primary (Rainstorm fill), secondary (outline), ghost, danger.
- `Card`, `Sheet` (bottom sheet on mobile, modal on desktop), `Tabs`, `Badge` (e.g. `4K`, `BLU-RAY`), `Toast`.
- `SeatMap` (§7.3)
- `PagedMovieRail` (§7.4)
- `VoteOption` (a row or card with selected state and a total-count chip)
- `ReturnToInvitationPill` (§7.6)

---

## 5. Architecture

- **Framework:** Next.js App Router with React Server Components. Server Actions handle mutations.
- **Database:** the `meridian_underground` database on the shared connor.works Postgres instance (Railway), accessed via Prisma with its own login role. Migrations run with `prisma migrate deploy` as Railway's pre-deploy command. Never connect to other apps' databases on the instance.
- **Images:**
  - Gallery originals are processed with `sharp` at upload into WebP variants (480, 1200, 2400px wide) and stored in **Cloudflare R2**. They're served from a public R2 custom domain.
  - TMDb images use TMDb's CDN sizes (`w185`, `w342`, `w500`, `w780`, `original`).
  - Set `images.unoptimized = true`. All images arrive pre-sized, and this avoids image-optimizer problems behind the Multi-Zones proxy.
- **Blog:** Markdown in `content/blog/*.md` with frontmatter, rendered with `unified`/`remark`/`rehype` (GFM, heading anchors).
- **Timezone:** All event dates and times are in one theater timezone set by the `THEATER_TIMEZONE` env var (e.g. `America/Chicago`). Store the date as `DATE` and the time as `HH:mm` strings. Don't convert through UTC for display.

### 5.1 Project structure
```
/app
  /meridian-underground/(public)/...      public pages
  /meridian-underground/admin/...         admin (protected by middleware)
  /meridian-underground/api/admin/...     upload route
  /movie-collection/...                   collection pages
  /movie-collection/api/...               public collection API
  /movie-night/[eventSlug]/[friendSlug]/  invitation
/components                               shared UI (SeatMap, PagedMovieRail, ...)
/lib
  /db.ts                                  Prisma client
  /auth/                                  password hashing, sessions
  /tmdb/                                  TMDb client + caching
  /collection/                            collection queries (used by pages AND the API)
  /events/                                event logic: voting, seats, reschedule, stats
  /r2/                                    R2 upload helpers
/content/blog/*.md
/content/gear.ts, /content/thanks.ts      static content
/prisma/schema.prisma
/scripts/create-admin.ts                  CLI: create an admin account
/scripts/seed.ts                          dev seed data
/docs/DESIGN.md
```

**Rule:** The invitation feature must read the collection through `lib/collection`. The public API route calls the same functions, so the collection could be split into its own service later without changing behavior.

---

## 6. Data Model

Prisma sketch. Claude Code should finalize field names and relations.

```prisma
// ---------- Auth ----------
model Admin {
  id           String    @id @default(cuid())
  email        String    @unique
  name         String
  passwordHash String
  createdAt    DateTime  @default(now())
  sessions     Session[]
}

model Session {
  id        String   @id            // random 32-byte token, hashed at rest
  adminId   String
  admin     Admin    @relation(fields: [adminId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
}

// ---------- People ----------
model Friend {
  id           String       @id @default(cuid())
  name         String                  // "David Myers"
  slug         String       @unique    // "david-myers"; on collision "david-myers-2"
  passwordHash String?                 // future: friend self-access to profile
  notes        String?
  createdAt    DateTime     @default(now())
  invitations  Invitation[]
  attendance   Attendance[]
}

// ---------- Movies ----------
model Movie {                          // TMDb metadata cache; may exist without being owned (write-ins)
  id            String          @id @default(cuid())
  tmdbId        Int             @unique
  slug          String          @unique  // "blade-runner-2049-2017"
  title         String
  releaseDate   DateTime?       @db.Date
  overview      String?
  posterPath    String?
  backdropPath  String?
  runtime       Int?
  voteAverage   Float?          // TMDb rating (0–10)
  certification String?         // US rating, e.g. "PG-13"
  genres        MovieGenre[]
  tmdbFetchedAt DateTime
  owned         CollectionItem?
}

model Genre {
  id     Int          @id        // TMDb genre id
  name   String
  movies MovieGenre[]
}

model MovieGenre {
  movieId String
  genreId Int
  movie   Movie @relation(fields: [movieId], references: [id], onDelete: Cascade)
  genre   Genre @relation(fields: [genreId], references: [id])
  @@id([movieId, genreId])
}

enum Format { UHD_4K BLURAY DVD DIGITAL }

model CollectionItem {                 // presence = "we own it"
  id      String   @id @default(cuid())
  movieId String   @unique
  movie   Movie    @relation(fields: [movieId], references: [id], onDelete: Cascade)
  formats Format[]
  addedAt DateTime @default(now())
}

model MovieList {                      // custom lists, e.g. "Halloween", "Atmos Demos"
  id          String          @id @default(cuid())
  name        String
  slug        String          @unique
  description String?
  isAdHoc     Boolean         @default(false) // created by the event wizard's hand-pick; hidden from Lists page
  items       MovieListItem[]
}

model MovieListItem {
  listId    String
  movieId   String
  sortOrder Int
  @@id([listId, movieId])
}

// ---------- Events ----------
enum EventStatus { DRAFT OPEN LOCKED COMPLETED CANCELLED SUPERSEDED }
enum TimeKind    { DINNER_START MOVIE_START }
enum MovieMode   { FIXED VOTE }
enum ScopeType   { LIST GENRE UHD_4K ALL }
enum DinnerMode  { NONE PLANNED VOTE }

model Event {
  id                   String      @id @default(cuid())
  slug                 String      // "2026-09-14"; unique among non-SUPERSEDED events (partial unique index via raw SQL migration)
  status               EventStatus @default(DRAFT)
  welcomeMessage       String
  date                 DateTime    @db.Date
  time                 String?     // "18:30"
  timeKind             TimeKind    @default(MOVIE_START)

  movieMode            MovieMode
  fixedMovieId         String?     // when FIXED
  scopeType            ScopeType?  // when VOTE
  scopeValue           String?     // listId | genreId | null
  allowMovieWriteIns   Boolean     @default(false)
  finalMovieId         String?

  allowDateVoting      Boolean     @default(false)
  allowTimeVoting      Boolean     @default(false)

  dinnerMode           DinnerMode  @default(NONE)
  dinnerDetails        String?     // when PLANNED, e.g. "Smoked brisket at the house"
  askWhetherDinner     Boolean     @default(false) // VOTE mode: "Do you want dinner?" yes/no
  allowDinnerWriteIns  Boolean     @default(false)
  finalDinnerOptionId  String?
  dinnerDecided        Boolean?    // result of the whether-to-have-dinner vote

  movieVotingClosedAt  DateTime?
  dinnerVotingClosedAt DateTime?
  dateVotingClosedAt   DateTime?
  timeVotingClosedAt   DateTime?
  finalDate            DateTime?   @db.Date // result of date vote (may trigger reschedule)
  finalTime            String?
  finalTimeKind        TimeKind?

  supersededById       String?     // set when rescheduled
  createdById          String
  createdAt            DateTime    @default(now())

  invitations          Invitation[]
  seats                SeatReservation[]
  movieOptions         EventMovieOption[]
  pollOptions          PollOption[]
}

model Invitation {                     // one per friend per event
  id             String     @id @default(cuid())
  eventId        String
  friendId       String
  plusOnes       Int        @default(0) // extra seats allowed for this guest
  status         RsvpStatus @default(PENDING)
  wantsDinner    Boolean?
  comment        String?
  submittedAt    DateTime?
  needsReconfirm Boolean    @default(false) // set when the event was rescheduled
  firstViewedAt  DateTime?
  lastViewedAt   DateTime?
  @@unique([eventId, friendId])
}
enum RsvpStatus { PENDING YES MAYBE NO }

model SeatReservation {
  id           String  @id @default(cuid())
  eventId      String
  seatIndex    Int     // 1–4, left to right from the audience's view facing the screen
  invitationId String? // null = held by host/admin
  adminId      String?
  @@unique([eventId, seatIndex])  // prevents double-booking
}

model EventMovieOption {               // materialized options: LIST scope items are resolved live; this table holds write-ins
  id                      String  @id @default(cuid())
  eventId                 String
  movieId                 String
  suggestedByInvitationId String?
  @@unique([eventId, movieId])
}

model MovieVote {
  id           String @id @default(cuid())
  eventId      String
  invitationId String
  movieId      String
  @@unique([eventId, invitationId])   // one movie vote per guest (changeable)
}

enum PollCategory { DATE TIME DINNER }

model PollOption {                     // dates, times, dinner options (admin-seeded or guest write-ins)
  id                      String       @id @default(cuid())
  eventId                 String
  category                PollCategory
  label                   String?      // dinner: "Tacos from La Paz"
  url                     String?      // dinner: optional link
  date                    DateTime?    @db.Date // DATE
  time                    String?      // TIME: "18:00"
  timeKind                TimeKind?    // TIME: dinner vs. movie start
  suggestedByInvitationId String?
  createdAt               DateTime     @default(now())
}

model PollVote {
  id           String       @id @default(cuid())
  eventId      String
  invitationId String
  category     PollCategory
  optionId     String
  @@unique([invitationId, category])  // one vote per category per guest
}

model Attendance {                     // recorded when admin completes an event; source of truth for stats
  eventId   String
  friendId  String
  seatIndex Int?
  @@id([eventId, friendId])
}

// ---------- Content ----------
model GalleryImage {
  id        String   @id @default(cuid())
  r2KeyBase String   // e.g. "gallery/2026/abc123"
  variants  Json     // { "480": url, "1200": url, "2400": url }
  width     Int
  height    Int
  alt       String
  caption   String?
  sortOrder Int
  isHero    Boolean  @default(false) // exactly one hero at a time
  published Boolean  @default(true)
  createdAt DateTime @default(now())
}

model WelcomeTemplate {
  id    String @id @default(cuid())
  label String // "Classic", "Horror Night", ...
  body  String // supports {friendFirstName} and {date} placeholders
}
```

---

## 7. Movie Night: Guest Experience

### 7.1 Guest user story
A guest receives a link like `connor.works/movie-night/2026-09-14/david-myers`. On that page they can:
- Read the welcome message and see the event details.
- Reserve seat(s) up to their allowance (1 + their +1s).
- Vote on the movie, from a curated subset or the whole library depending on admin settings, and write in a suggestion if allowed.
- Vote on or suggest dinner, date, and time, if the admin enabled each.
- Leave a comment and submit their RSVP.

They can leave to browse the collection or the theater pages mid-way and come back to finish. Nothing they've entered is lost.

### 7.2 Invitation page layout (top to bottom)
1. **Hero:** backdrop of the fixed or leading movie if there is one, otherwise the site hero image.
   - Overlaid: the personalized welcome message (placeholders resolved), date, and time with its label ("Movie starts 7:00 PM" or "Dinner starts 6:00 PM").
   - Status chip: *Voting open* / *Locked in* / *Rescheduled* / *Cancelled*.
2. **RSVP:** segmented control: **Going** / **Maybe** / **Can't make it**. Choosing "Can't make it" collapses the seat section and releases any seats the guest holds.
3. **Seats** (§7.3).
4. **Movie:** a single fixed movie card with synopsis, or the voting rail (§7.4).
5. **Date** (if enabled): candidate dates with vote totals, plus "Suggest another date."
6. **Time** (if enabled): candidate times, each showing its kind ("🍽 Dinner at 6:00 PM" / "🎬 Movie at 7:30 PM"), plus "Suggest a time."
   - The suggestion form requires a time and a radio choice: *Dinner starts* / *Movie starts*.
7. **Dinner:** depends on the dinner mode:
   - NONE: hidden.
   - PLANNED: show the details.
   - VOTE: optional "Do you want dinner?" yes/no, a list of options (label + link), and a write-in field if allowed.
8. **Who's coming:** first names of guests marked Going **[ASSUMPTION]**.
9. **Comments:** a textarea labeled "Anything else? Suggestions, dietary needs, requests."
10. **Submit RSVP:** sticky bottom bar on mobile showing progress (e.g. "RSVP ✓ · Seat ✓ · Movie —") and the Submit button.

**Behavior:**
- **Auto-save.** Every selection saves immediately via a Server Action, with optimistic UI and a toast on failure.
  - "Submit RSVP" sets `submittedAt` and shows a confirmation state.
  - Guests can edit until the event is LOCKED. Categories whose voting is closed become read-only and show the result.
- **Vote totals:** visible to guests as counts only (e.g. "3 votes"). Never show who voted.
- **After voting closes:** the winning option is highlighted with a "Selected" badge.
- **Visit tracking:** record `firstViewedAt` and `lastViewedAt` on each visit so the admin can see "Viewed" vs. "Not opened."
- **Unknown friend slug for an existing event:** show the generic "This invitation is personal" page (no 404 details).
- **Superseded event:** 308 redirect to `/movie-night/{newSlug}/{friendSlug}`, following the chain if rescheduled more than once. On the new page, if `needsReconfirm` is set, show a banner: "The date changed from Sep 14 to Sep 21. Please confirm you can still make it."
- **Cancelled event:** show a cancelled state with the admin's note. No inputs.

### 7.3 Seat map
The physical layout is one row of 4 seats. Large wedge-shaped armrests between the seats make the whole couch curve like a crescent. Render it like a ticketing seat picker.

**Rendering (SVG, responsive):**
- A "SCREEN" bar at the top (a thin off-white line with a subtle glow and a micro label).
- Four seats laid out on an arc, with the ends curving toward the screen.
  - Each seat is a rounded, slightly trapezoidal shape rotated to follow the arc.
  - Between adjacent seats there's a visibly wider **wedge-shaped armrest** (3 total), narrow at the back and wide at the front, so the crescent reads clearly.
  - The two end armrests are standard width.
- Seats show no numbers or labels. Internally they are `seatIndex` 1–4, left to right from the audience's view.
- A legend below the map.

**Seat states:**
| State | Visual |
|---|---|
| Available | `surface` fill, Peppercorn outline; hover/focus shows an `accent-light` outline |
| Yours | Rainstorm fill, off-white check icon |
| Host | Peppercorn fill, small star or "Host" micro label |
| Taken | Peppercorn fill, guest's initials **[ASSUMPTION]** |
| Unavailable (event locked, or RSVP = No) | 40% opacity |

**Rules:**
- A guest can hold at most `1 + plusOnes` seats. The counter reads "2 of 2 seats selected." Tapping a held seat releases it.
- Seat changes save immediately and are first-come, first-served. The database unique constraint on `(eventId, seatIndex)` guarantees no double booking. On conflict, refresh the map and toast "Someone just grabbed that seat."
- If every seat is taken, show: "All seats are reserved. You can still RSVP and your host will sort it out." (see §15 waitlist question).

**Accessibility:**
- Each seat is a `<button>` with an `aria-label` like "Seat 2 of 4 from left, available."
- Arrow keys move between seats; Enter or Space toggles.
- States are never shown by color alone.

### 7.4 PagedMovieRail (movie voting list)
**Requirements (from owner):**
- Movies display in "pages" of about 20 that extend horizontally.
- Each page is separated by a Rainstorm-colored bar.
- On mobile the list must **snap page-by-page**, not scroll freely.

**Spec:**
- `PAGE_SIZE = 20` (a constant).
- Each page is a grid:

  | Breakpoint | Columns × Rows |
  |---|---|
  | `lg` and up | 10 × 2 |
  | `md` | 5 × 4 |
  | Mobile | 4 × 5 (compact posters, titles hidden; tap for details) |

- The container is a horizontal flex scroller.
  - Each page is `flex: 0 0 100%` of the container width, with `scroll-snap-align: start` and `scroll-snap-stop: always`.
  - The container uses `scroll-snap-type: x mandatory` and `overscroll-behavior-x: contain`.
- **Page divider:** a 4px vertical Rainstorm bar spanning the grid height, between every pair of pages (not before the first or after the last).
- **Controls:**
  - "Page 3 of 10" indicator plus dots.
  - Prev/Next arrow buttons on `md`+.
  - Keyboard: arrows move between cards; PageUp/PageDown move between pages.
- **Search box above the rail:** filters titles within the current scope and re-paginates from page 1.
- **Movie card:**
  - Poster (TMDb `w185`/`w342`), title and year below on `md`+, and a `4K` badge if owned in UHD.
  - When voting is visible, a vote-count chip.
  - Selected state: Rainstorm ring, check badge, and `aria-pressed="true"`.
- **Tapping a card** opens a `Sheet` with:
  - Backdrop and poster, title, year, runtime, certification, TMDb rating (★ 7.8), genres, synopsis, owned formats.
  - A **"Vote for this movie"** button (or "Your vote ✓" to un-vote).
- **Write-in** (if enabled): a "Suggest a movie" button at the end of the rail. It opens a TMDb search, which is **not** limited to the collection. Picking a result:
  - Creates or fetches the `Movie` row.
  - Adds an `EventMovieOption` and casts the guest's vote for it.
  - Write-ins show a "Suggested" badge, plus "Not in collection" if the movie isn't owned.
- **Order:** by current vote count (desc), then title. Before any votes, order by title. **[ASSUMPTION]**
- The same component, without voting, is used on the public `/movie-collection` page.

### 7.5 Movie scope (what guests can pick from)
Resolved by `lib/events/getMovieOptions(event)`:

| Admin setting | Options shown |
|---|---|
| FIXED | No voting; a single movie card |
| VOTE + LIST | Items of the chosen `MovieList` (saved list, or an ad-hoc list from hand-picking in the wizard) + write-ins |
| VOTE + GENRE | Owned movies with that TMDb genre + write-ins |
| VOTE + UHD_4K | Owned movies with the `UHD_4K` format + write-ins |
| VOTE + ALL | The entire collection + write-ins |

### 7.6 Return to invitation
- When a guest opens their invitation, set a cookie `mu_invite` containing `{eventSlug, friendSlug}`. It expires the day after the event.
- On every public theater page, if that cookie is set and the event isn't completed or cancelled, show a floating pill (bottom-right; bottom-center on mobile): **"← Back to your invitation."**
- Invitation pages include links like "Browse the full collection" and "See the theater," which open in the same tab. Auto-save guarantees nothing is lost.

---

## 8. Movie Collection

### 8.1 Public collection page (`/movie-collection`)
- Title, owned count ("214 movies"), and a filter bar:
  - Search (title)
  - Genre (multi-select)
  - Format (4K / Blu-ray / DVD / Digital)
  - Custom list
  - Sort: Title · Year · Recently added · TMDb rating
- Results in `PagedMovieRail` (no voting). Filters are reflected in URL query params so views are shareable.

### 8.2 Movie detail (`/movie-collection/[movieSlug]`)
- Backdrop hero, poster, title, year, runtime, certification, rating, genres, synopsis, owned formats.
- "Appears in lists: …"
- Admin-only "Edit" link.

### 8.3 Admin: managing the collection
- **Add via TMDb:** a search box calls TMDb `/search/movie`. Results show poster, title, year, and an "Owned" indicator. "Add" opens a format picker (multi-select) and saves.
- **Edit:** change formats, refresh TMDb metadata, remove from the collection. Removing deletes the `CollectionItem` but keeps the `Movie` row if it's referenced by votes.
- **CSV import** (`/admin/collection/import`):
  1. **Columns:** `title` (required), `year` (optional), `tmdb_id` (optional), `formats` (optional; semicolon-separated, e.g. `4K;Blu-ray`).
  2. **Upload, then match:** if `tmdb_id` is present, use it directly. Otherwise search by title + year and take the top result.
  3. **Review table:** CSV row → matched poster, title, and year, with a confidence flag (exact / fuzzy / none). Each row has "Change match" (inline TMDb search) and "Skip."
  4. **Confirm:** import. Existing titles merge formats instead of duplicating.
  5. **Summary:** added / merged / skipped counts.
- **Custom lists** (`/admin/lists`): create, rename, and delete lists; add movies from the collection; drag to reorder.

### 8.4 Collection API
`GET /movie-collection/api/movies`
Query params: `q`, `genre` (id, repeatable), `format` (repeatable), `list` (slug), `sort` (`title|year|added|rating`), `page` (1-based), `pageSize` (default 20, max 100).

```json
{
  "page": 1, "pageSize": 20, "total": 214, "totalPages": 11,
  "results": [{
    "id": "cl...", "tmdbId": 335984, "slug": "blade-runner-2049-2017",
    "title": "Blade Runner 2049", "year": 2017, "runtime": 164,
    "certification": "R", "rating": 7.6,
    "genres": [{"id": 878, "name": "Science Fiction"}],
    "formats": ["UHD_4K", "BLURAY"],
    "posterUrl": "https://image.tmdb.org/t/p/w342/....jpg",
    "overview": "..."
  }]
}
```
The API is public and read-only, with `Cache-Control: s-maxage=300`. It's backed by `lib/collection/searchMovies()`, which the invitation feature also calls directly.

### 8.5 TMDb integration
- Use a v4 read access token (`TMDB_API_READ_TOKEN`) as a Bearer header.
- **Endpoints:**
  - `/search/movie`
  - `/movie/{id}?append_to_response=release_dates` (the US certification comes from `release_dates`)
  - `/genre/movie/list` (sync genres on first run)
- **Caching:**
  - Store metadata on `Movie`. Never call TMDb when rendering public pages.
  - Refresh on demand (admin "Refresh" button) and via an admin "Refresh all stale" action (older than 90 days).
- **Rate limiting:** stay well under TMDb's limits (batch imports at about 5 requests/second, with retry/backoff on 429).
- **Attribution (required):** show the TMDb logo and the notice *"This product uses the TMDB API but is not endorsed or certified by TMDB."* in the footer of collection and invitation pages.

---

## 9. Admin

### 9.1 Authentication
- Email + password. Hash with Argon2id (`@node-rs/argon2`).
- Sessions:
  - Random token stored hashed in the `Session` table.
  - Cookie `mu_session`: `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, 30-day sliding expiry.
- Middleware protects `/meridian-underground/admin/**` (except `/login`) and the admin API routes. All admin Server Actions re-check the session.
- Login rate limit: 5 failed attempts per email per 15 minutes.
- The first admin is created with `pnpm admin:create --email ... --name ...` (prompts for the password). Later admins are added in Settings. There's no public sign-up.

### 9.2 Dashboard (`/admin`)
- **Upcoming movie nights:** a card per event showing date, status, and RSVP counts (Going / Maybe / No / Pending), seats filled out of 4, and the leading movie.
- **Quick actions:** New movie night · Add movie · Upload photos.
- **Past events:** a compact list.

### 9.3 Admin user story: create a movie night
The wizard lives at `/admin/events/new`. Progress saves as a DRAFT event.

1. **Welcome message**
   - Pick a `WelcomeTemplate` or write a custom message; editing a template is allowed.
   - Supports `{friendFirstName}` and `{date}` placeholders.
   - Live preview.
2. **Date & time**
   - Proposed date (must not match another active event's date).
   - Optional time, with a required label: *Dinner starts* or *Movie starts*.
   - Toggles: "Let guests vote on date" and "Let guests vote on time." When on, optionally seed candidate dates or times.
3. **Movie**
   - **Fixed:** search the collection (or TMDb) and pick one movie.
   - **Vote:** choose a scope — saved list, genre, 4K only, entire library, or hand-pick movies (which creates an ad-hoc list).
   - Toggle "Allow write-in suggestions."
   - Preview of how many movies are in scope.
4. **Your seats:** the SeatMap in admin mode. Select 0–4 host seats.
5. **Dinner**
   - None.
   - Planned: enter details.
   - Vote: toggles "Ask if guests want dinner" and "Allow write-ins," plus optional seeded options (label + optional link).
6. **Review:** a summary of everything, then **"Create & invite."** The event becomes OPEN.
7. **Invitees**
   - A list of all past friends, sorted by most recently invited, with checkboxes.
   - Each selected friend has a **+1s stepper** (0–3, limited by seats remaining).
   - "Add new invitee" (name field) creates a `Friend` with an auto-generated slug, shown for editing before saving.
   - Each invitee row shows their link `connor.works/movie-night/{eventSlug}/{friendSlug}` with a **Copy** button and a **Share** button (Web Share API; hidden when unsupported).
   - The admin can add or remove invitees later from the event page.

### 9.4 Event management (`/admin/events/[id]`)
**Tabs:**
- **Overview:** details and status, with Edit (message, time, dinner details, scope).
- **Guests:** each invitee's RSVP status, viewed/not-opened, seats held, +1 allowance (editable), comment, and link with Copy/Share.
- **Votes:** tallies per category. The admin **can** see who voted for what.
  - Each category has a **"Close voting & pick"** button. It defaults to the top option and forces an explicit choice on ties. It sets `*VotingClosedAt` and the final value.
  - Categories can be re-opened.
- **Seats:** the SeatMap showing all holders. The admin can move or release any seat.

**Actions:**
- **Lock event:** all voting closed; the invitation becomes read-only except RSVP status changes.
- **Reschedule:** requires a new date that no active event is using.
  1. Creates a new event (slug = the new date) copying settings, invitations, +1s, votes, write-ins, poll options, and seat reservations.
  2. Sets `needsReconfirm = true` on every invitation.
  3. Marks the old event SUPERSEDED with `supersededById` set.
  4. Old links redirect.
  - This is also the path taken when a date vote picks a different date.
- **Cancel:** optional note shown to guests.
- **Complete event** (after the date): a checklist pre-filled from Going RSVPs and seat reservations. The admin confirms who actually attended and where they sat, which creates `Attendance` rows. Stats come **only** from Attendance.

### 9.5 Friend profiles & stats (`/admin/friends/[friendSlug]`)
- Name (editable), slug (editable, with a warning that this changes their future links), and notes.
- **Stats (from Attendance and votes):**
  - **Nights attended:** total count plus a list of dates, each linking to the admin event page.
  - **Favorite seat:** the most frequent `seatIndex` across attendance, shown on a mini seat map with a count ("Sat here 5 of 7 times"). Ties show all tied seats.
  - **Movies watched:** posters of `finalMovie` for each attended event.
  - **Vote win rate:** among completed events where the friend cast a movie vote and a final movie was chosen, the percentage where their vote matched the final movie. Show "4 of 6 (67%)." Show "—" if there are no votes.
- **Future-proofing:** keep the stats UI in a `FriendProfile` component that takes a `friendId` and has no admin-only dependencies. A later phase can mount it at a friend-facing route behind `Friend.passwordHash` login. Don't build that route in v1.

### 9.6 Gallery admin (`/admin/gallery`)
- Drag-and-drop multi-file upload (JPEG/PNG/HEIC, up to 25 MB each).
- The server:
  - Converts HEIC and normalizes EXIF orientation.
  - Strips EXIF, **including GPS**.
  - Generates WebP variants at 480, 1200, and 2400px wide.
  - Uploads to R2 and stores dimensions.
- Grid of images with drag-to-reorder, and per-image edits for alt text (required before publishing), caption, and published toggle.
- "Set as home hero" makes one image the hero.
- "Copy URL" copies the 1200px variant URL for use in Markdown blog posts.

### 9.7 Settings
- Admin accounts: add, remove, change password. The last remaining admin can't be removed.
- Welcome message templates (CRUD).

---

## 10. Public Pages

### 10.1 Home (`/meridian-underground`)
1. **Hero:** full-bleed hero image (from the gallery `isHero`) with a vignette. Overlaid: the "MERIDIAN UNDERGROUND" wordmark and the tagline *"A 7.3.4 Dolby Atmos home theater, built by hand."* (see §15).
2. **Intro:** 2–3 sentences, editable in `content/home.md`.
3. **Upcoming movie nights:** only if any OPEN or LOCKED events exist in the future.
   - Each card shows date, time (with label), movie title and poster if decided (otherwise "Voting in progress"), and seats available ("2 of 4 seats open").
   - **No guest names and no invitation links.**
   - Hidden entirely when there are no upcoming events.
4. **Explore:** link cards to Gallery, Build Blog, System & Gear, Movie Collection, and Special Thanks, each with a representative image.

### 10.2 Gallery (`/meridian-underground/gallery`)
- Responsive masonry grid (1/2/3 columns) using the 480 or 1200 variants with `srcset`.
- Clicking opens a lightbox with the 2400 variant, the caption, keyboard and swipe navigation, and Esc to close.

### 10.3 Build Blog
- **Files:** `content/blog/YYYY-MM-DD-slug.md`.
- **Frontmatter:**
```yaml
  title: "Demolition Day"
  date: 2025-03-02
  summary: "Tearing out the old basement with Kyle."
  cover: "https://img.connor.works/gallery/....webp"   # optional
  tags: [demolition]
  draft: false
```
- **Index:** reverse-chronological list of cards (cover, title, date, summary). Drafts are hidden in production.
- **Post page:** readable max width of about 720px, styled prose, and prev/next post links.
- Include one sample post, `content/blog/0000-00-00-hello-world.md` with `draft: true`, to show the format.

### 10.4 Special Thanks (`/meridian-underground/thanks`)
Rendered from `content/thanks.ts`, one quiet card per person (name in the display font, contribution below):

| Name | Contribution |
|---|---|
| My wife & kids | For supporting this ridiculous hobby |
| Vince Mitchell | General building guidance and assistance |
| Kyle Kinney | Demolition guidance and assistance, use of and assistance with CNC router |
| Sam Bantner | Use of and assistance with high-quality woodworking tools |
| David Myers | Assistance with building |
| Cory Allender | Assistance with building |
| David Culberson | Donation of server rack and LED light fixture pieces |

### 10.5 System & Gear (`/meridian-underground/system`)
**Description (verbatim from owner; confirm the channel count, see §15):**
> The Meridian Underground is a 7.4.3 Atmos home theater system controlled by a Marantz receiver, amplified with Emotiva and Behringer power amps. Display is provided by a JVC projector and source is a Panasonic blu ray player or an HD Chromecast.

Optional: a simple channel diagram (top-down room view showing LCR, surrounds, Atmos, and subs) in a later phase.

**Gear list:** rendered from `content/gear.ts` and grouped by category. Each item has: name, quantity, notes, price paid (used), and product URL. Product links are placeholders for Connor to fill in.

| Category | Item | Qty | Notes | Paid (used) |
|---|---|---|---|---|
| Display | JVC DLA-X570 projector | 1 | | $600 |
| Sources | Panasonic Blu-ray player | 1 | Model TBD | — |
| Sources | Chromecast HD | 1 | | — |
| Processing | Marantz AV7702mkII | 1 | AV processor | $300 |
| Processing | MiniDSP 2x4 | 1 | Bass management | — |
| Amplification | Emotiva UPA-7 | 1 | | $300 |
| Amplification | Emotiva BasX A500 | 1 | | $150 |
| Amplification | Behringer NX3000 | 1 | | $150 |
| Amplification | Behringer NX6000 | 1 | | $120 |
| Speakers | JBL Northridge E80 | 3 | Left / Center / Right | — |
| Speakers | JBL Northridge E10 | 4 | Surrounds | — |
| Speakers | JBL Northridge E10 | 4 | Re-boxed for Atmos | — |
| Bass | Dayton Audio Reference 18" w/ dual passive radiators | 1 | | $650 |
| Bass | JBL 4638 | 1 | Split into 2 mid-bass modules | $75 |
| Tactile | Dayton Audio BST-1 | 2 | Bass shakers | — |

- **Total:** computed from items with a price. Currently **$2,345**. Label it "Total spent (items with known prices)." Items without a price show "—."
- Prices display as whole dollars.

---

## 11. Security, Privacy & SEO
- **Robots:**
  - The main site serves `robots.txt` for all of connor.works. It must include `Disallow: /movie-night/` and `Disallow: /meridian-underground/admin/`. This app doesn't serve `/robots.txt`.
  - Those routes also send `X-Robots-Tag: noindex, nofollow` and `<meta name="robots" content="noindex">`.
- **Guest privacy:**
  - Invitation URLs are guessable by design (owner decision). Keep the blast radius small: invitation pages show only first names, and the public home page never shows guest names.
  - Server Actions validate that the invitation belongs to the event and slug in the URL.
- **Validation:** all input is validated with Zod. Comments and write-ins are limited to 1,000 and 200 characters, and are rendered as plain text (never HTML).
- **Uploads:** admin-only, with MIME and size checks. EXIF (including GPS) is stripped.
- **Social previews:** public pages get Open Graph metadata (title, description, hero image). Invitation pages get a generic OG image ("You're invited to a movie night") with no event details.

---

## 12. Deployment (Railway) & Multi-Zones

See the connor-works `ARCHITECTURE.md` for the full multi-repo setup: the main site, DNS, the shared database, and rollout.

### 12.1 Railway setup
- **Project:** "connor-works" (shared with the main site and future child apps)
  - Service **`meridian-underground`**, deployed from this GitHub repo. Configure it in `railway.json`:
    - Build: `pnpm build` (`prisma generate && next build`)
    - Start: `pnpm start` (`next start -H ::`). Binding to `::` lets the main site reach the app over Railway's IPv6 private network. Next.js listens on `$PORT`, which is pinned to `3000`.
    - Pre-deploy: `pnpm prisma migrate deploy`
    - Health check: `/meridian-underground/api/health`, which returns 200 and checks the database connection. It isn't listed in §3; add it with the other API routes.
  - **Database:** the shared **`Postgres`** service. This app uses its own `meridian_underground` database, owned by a `meridian_underground` login role (created once with `CREATE ROLE` / `CREATE DATABASE ... OWNER`; see the `ARCHTIECTURE.md` in connor-works).
- **Domain:** none. The `connor.works` custom domain belongs to the main site, which proxies this app's prefixes to `http://meridian-underground.railway.internal:3000`. An optional `*.up.railway.app` domain may be kept for testing.

### 12.2 Environment variables
| Variable | Purpose |
|---|---|
| `PORT` | `3000` (pinned so the main site can reach the app over the private network) |
| `MU_DB_PASSWORD` | Password for the `meridian_underground` Postgres role |
| `DATABASE_URL` | `postgresql://meridian_underground:${{MU_DB_PASSWORD}}@${{Postgres.RAILWAY_PRIVATE_DOMAIN}}:5432/meridian_underground?connection_limit=5` |
| `SESSION_SECRET` | 32+ random bytes |
| `TMDB_API_READ_TOKEN` | TMDb v4 read token |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Cloudflare R2 |
| `R2_PUBLIC_BASE_URL` | e.g. `https://img.connor.works` |
| `SITE_URL` | `https://connor.works` (used for building invitation links and OG URLs) |
| `THEATER_TIMEZONE` | e.g. `America/Chicago` |
| `ALLOWED_ORIGINS` | Comma-separated origins for `serverActions.allowedOrigins` (e.g. `connor.works`) |

The main site sets `MERIDIAN_UNDERGROUND_URL=http://${{meridian-underground.RAILWAY_PRIVATE_DOMAIN}}:${{meridian-underground.PORT}}` on its own service. That turns on its rewrites to this app.

### 12.3 Multi-Zones requirements
- Only create routes under `/meridian-underground`, `/movie-night`, and `/movie-collection`. There is no `/` route or redirect.
- `next.config.ts`:
```ts
  const nextConfig = {
    assetPrefix: process.env.NODE_ENV === 'production' ? '/mu-static' : undefined,
    images: { unoptimized: true },
    experimental: {
      serverActions: { allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '').split(',').filter(Boolean) },
    },
  };
```
  Verify how `assetPrefix` behaves with the installed Next.js version. The main site rewrites `/mu-static/:path*` to this service, along with the three route prefixes.
- Build all absolute links from `SITE_URL`, never from the request host, so links are correct behind the proxy.
- Link to main-site pages (e.g. `/`) with plain `<a href>`, not `next/link`. Navigating between apps is a full page load.
- Cookie names must be prefixed with `mu_` (e.g. `mu_session`). All apps on connor.works share the domain's cookies.

---

## 13. Testing
- **Unit (Vitest):**
  - Slug generation and collisions
  - Vote tallying and tie detection
  - Movie scope resolution
  - Seat allowance and conflict handling
  - Reschedule copy and redirect chain
  - Stats calculations: favorite seat ties, win rate with no votes
- **E2E (Playwright), key flows:**
  1. The admin creates an event through the wizard, adds a new invitee, and copies the link.
  2. A guest opens the link, reserves a seat, votes for a movie, leaves to `/movie-collection`, returns via the pill, submits the RSVP, and sees totals.
  3. Two guests race for the same seat; exactly one succeeds.
  4. The admin closes movie voting and the guest sees the winner.
  5. The admin reschedules; the old link redirects and the reconfirm banner shows.
  6. Mobile viewport: the movie rail snaps one page per swipe.
- **Seed script:** 2 admins, 8 friends, about 40 real TMDb movies with formats, 2 lists, 1 past completed event with attendance, and 1 open event with votes.

---

## 14. Build Phases
Each phase ends deployable on Railway, with its acceptance criteria met.

**Phase 0: Foundation**
- Next.js + TS + Tailwind + Prisma + Postgres; design tokens, fonts, and base components.
- Database and role on the shared Postgres instance; Railway deploy with health check; Multi-Zones config (§12.3).
- *Accept:* the app deploys, the health check passes, `/meridian-underground` renders with the token styles, and it's reachable at `connor.works/meridian-underground` through the main site. Or, if the main site isn't connected yet, at the service's `*.up.railway.app` URL.

**Phase 1: Public showcase**
- Header and footer; Home (static hero placeholder); Thanks; System & Gear with computed total; Blog from Markdown.
- *Accept:* all public pages render on mobile and desktop, and the gear total equals $2,345.

**Phase 2: Admin auth & gallery**
- Admin login, sessions, middleware, `admin:create` script.
- Gallery upload to R2 with variants, the public gallery with lightbox, and hero selection wired into the Home page.
- *Accept:* an admin can upload, caption, reorder, and set a hero; logged-out users can't reach admin pages.

**Phase 3: Movie collection**
- TMDb client and genre sync; add, edit, and remove titles; formats; custom lists; CSV import with review.
- The public collection page with `PagedMovieRail`; the detail page; the collection API; TMDb attribution.
- *Accept:* importing a 200-row CSV works end to end, filters work and are reflected in the URL, and the rail snaps on mobile with Rainstorm dividers.

**Phase 4: Movie nights, core**
- Friends; the event wizard; invitations and links (copy/share).
- The invitation page with RSVP, SeatMap, fixed movie, planned dinner, comments, and auto-save.
- The return-to-invitation pill; upcoming events on Home.
- *Accept:* E2E flows 1, 2 (without voting), and 3 pass.

**Phase 5: Voting**
- Movie voting with scopes and write-ins; date, time, and dinner polls and write-ins.
- Totals for guests; admin close-and-pick; lock; reschedule with redirects; cancel.
- *Accept:* E2E flows 2, 4, and 5 pass.

**Phase 6: Completion & stats**
- The complete-event attendance checklist; friend profiles with all four stats.
- *Accept:* unit tests for the stats pass, and the seeded past event produces correct stats.

**Phase 7: Polish**
- OG images; empty and loading states; accessibility pass (keyboard, screen reader labels, contrast); `prefers-reduced-motion`; Lighthouse ≥ 90 on public pages.

---

## 15. Open Questions (defaults in effect until answered)
1. **Channel count:** the description says 7.4.3, but the gear list suggests **7.3.4**: 7 bed-layer speakers (3 E80 + 4 E10), 3 bass units (Dayton 18" + 2 JBL mid-bass modules), and 4 Atmos (re-boxed E10s). In Dolby notation the last number is the height channels. *Default:* use 7.3.4 in the tagline and flag the description text for Connor to confirm.
2. **Seat overflow:** when all 4 seats are taken, should there be a waitlist, or is RSVP-without-seat enough? *Default:* RSVP allowed without a seat, and the admin sorts it out.
3. **Names on seats and "Who's coming":** is showing guests' initials and first names to other invitees okay? *Default:* yes.
4. **Rescheduling:** should votes and seats carry over to the new date? *Default:* yes, with every guest asked to reconfirm.
5. **Plus-ones:** do +1s get their own seat only, or can they also vote? *Default:* seats only; one set of votes per invitation.
6. **Product links and missing prices** for the gear list: Connor to fill in `content/gear.ts`.
7. **Hero image and intro copy:** Connor to supply.