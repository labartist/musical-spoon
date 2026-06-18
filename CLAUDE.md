# garyramli.com — Personal Portfolio

A "living dashboard" personal site for Gary Ramli (ex-SWE, now runs Parklane
furniture). Static front-end + a tiny Vercel serverless backend that surfaces
real-time location, weather, daily activity from Apple Health, a 3D travel
globe, and a Parklane product showcase.

**Live:** https://garyramli.com · **Repo:** labartist/musical-spoon · **Host:** Vercel

## Stack

- **Front-end:** vanilla HTML/CSS/JS — no framework, no build step
- **Globe:** [globe.gl](https://globe.gl) (Three.js) via unpkg CDN, Natural Earth 110m GeoJSON
- **Weather/time:** [Open-Meteo](https://open-meteo.com) API (free, no key) — also the source of the local timezone/city
- **Backend:** Vercel serverless functions (`/api`) + Vercel KV (Upstash Redis)
- **Fonts:** Inter (Google Fonts)

## Files

| File | Purpose |
|------|---------|
| `index.html` | Single page: hero, globe, time/weather, Daily Vitals dropdown, Parklane Collections dropdown, footer |
| `style.css` | All styling. Dark theme: bg `#08080c`, text `#ececf0`, muted `#444`/`#666` |
| `main.js` | Globe + travel trail, vitals/weather/time fetch, dropdown animations, carousel drag-to-scroll |
| `api/update.js` | `POST /api/update` — Bearer-auth, rate-limited (1/30s); writes latest `vitals` + upserts a daily `vitals_history` snapshot (last 14 days) to KV |
| `api/data.js` | `GET /api/data` — reads `vitals` + `vitals_history` (60s cache), returns `{...vitals, history}` |
| `package.json` | Only dep: `@vercel/kv` |
| `og-image.png` | 1200×630 social share card (generated, dark themed) |

## Data flow

1. **iOS Shortcut** (on Gary's phone) reads Apple Health (steps, distance,
   calories) + GPS, `POST`s JSON to `/api/update` with `Authorization: Bearer <AUTH_KEY>`.
2. `update.js` validates auth + rate limit, stores the latest `vitals` object,
   and upserts today's entry into `vitals_history` (one row per Jakarta day,
   capped to the last 14) in KV.
3. Browser `GET`s `/api/data` on load and every 5 min; falls back to demo
   values when the API 404s (e.g. local dev). Response includes `history`.
4. `lat/lng` from the response repositions the globe pin and triggers the
   Open-Meteo weather/timezone fetch.

**KV keys:** `vitals` (latest snapshot), `vitals_history` (array of daily
snapshots), `last_update_time` (rate-limit guard).

**Env vars (Vercel):** `AUTH_KEY` (shared secret with the iOS Shortcut) + the
`KV_*` connection vars (auto-injected by the Vercel KV integration).

## Globe behavior (main.js)

- **Hex-grid Earth** (`#baa6d0` dots), atmosphere `#6a5acd`, dark surface.
- **Travel trail** — hardcoded 2026 journey as **round-trips from the Jakarta
  hub** (`HOME` → `PLACES` → `JOURNEY` → deduped undirected `TRAVEL_ARCS`).
  Arcs are smooth (128-seg) with a gentle flowing shimmer fading out from Jakarta.
  ⚠️ Bali sits slightly over water — 110m GeoJSON drops small islands (known, accepted).
- **Pins** — live location = small white beacon + CSS glow overlay; travel
  stops = periwinkle dots. Each has a large invisible hit-target for easy hover.
- **Hover tooltips** (`pointLabel`) — city + date for stops, current city +
  "Current location" for the live pin.
- **Auto-spin** — pauses while dragging/hovering the globe, eases back up to
  speed ~0.5s after 3s of stillness (`updateAutoSpin()` in the `trackPin` loop).

## UI conventions

- **Dropdowns** (`.dropdown` / `.dropdown-toggle` / `.dropdown-content`) — shared
  `<details>`/`<summary>` pattern with JS-driven grid-rows slide animation
  (native marker hidden, custom rotating arrow).
- **Labels** — uppercase, letter-spaced, `#666` weight 600.
- **Carousel** — horizontal scroll-snap track, drag-to-scroll (a real drag
  suppresses the card link click; native link/image drag is blocked).

## Local preview

`.claude/launch.json` runs `python -m http.server` against the **main repo**
(not the worktree) via `--directory`. The API routes 404 locally (no Vercel
runtime), so vitals show demo values — this is expected.

⚠️ **Browser caches JS/CSS aggressively on a fixed port.** When iterating, bump
the port number in `launch.json` and restart the preview to force a fresh load.

## Workflow notes

- **Ask before pushing.** Preview changes first; keep the worktree clean
  (`git reset --hard origin/master` after pushing).
- Main branch: `master`. Vercel auto-deploys on push.

## Roadmap / parked ideas

- **Activity sparklines** — 7-day trends under the vitals. Data plumbing is
  DONE (`vitals_history`); needs a few days banked + the front-end charts.
- **About / Projects section** — the portfolio still has no bio/work content
  (waiting on Gary's bio + project list).
- **Location auto-tracking** — append each ping to a location history (cap last
  10 stops, dedupe by city) so the travel trail self-updates instead of staying
  hardcoded. The thornier half of the KV work — not started.
- **Guided-replay comet** — animate the journey in chronological order.
