# garyramli.com — Personal Portfolio

A "living dashboard" personal site for Gary Ramli (ex-SWE, now runs Parklane
furniture). Static front-end + a tiny Vercel serverless backend that surfaces
real-time location, weather, daily activity from Apple Health, a 3D travel
globe with auto-tracking, activity trends, and a GitHub/LinkedIn/Parklane
reveal panel system.

**Live:** https://garyramli.com · **Repo:** labartist/musical-spoon (public) · **Host:** Vercel

## Stack

- **Front-end:** vanilla HTML/CSS/JS — no framework, no build step
- **Globe:** [globe.gl](https://globe.gl) (Three.js) via unpkg CDN, Natural Earth 110m GeoJSON
- **Weather/time:** [Open-Meteo](https://open-meteo.com) API (free, no key) — also the source of the local timezone/city
- **GitHub activity:** [github-contributions-api.jogruber.de](https://github-contributions-api.jogruber.de) (free, no key)
- **Backend:** Vercel serverless functions (`/api`, ESM) + Vercel KV (Upstash Redis)
- **Fonts:** Inter (Google Fonts)

## Files

| File | Purpose |
|------|---------|
| `index.html` | Single page: hero (name + GitHub/LinkedIn/Parklane reveal panels), globe, time/weather, Daily Vitals section (steps/distance/calories + trend), footer |
| `style.css` | All styling. Dark theme: bg `#08080c`, text `#ececf0`, muted `#444`/`#666` |
| `main.js` | Globe + travel trail + auto-tracking, vitals/weather/time fetch, hero-panel accordion animations, carousel drag-to-scroll, GitHub heatmap |
| `api/update.js` | `POST /api/update` — Bearer-auth, rate-limited (1/30s); writes latest `vitals`, upserts a daily `vitals_history` snapshot (one row per device-local day — optional `date`/`tz` from the Shortcut, Jakarta fallback; all merges take the per-metric max so a stale push can't wipe totals; optional `days: [{date, steps, distance, calories}]` back-fills recent dates, e.g. yesterday's final Health totals, ≤7 entries, future dates rejected; last 14 days), and appends distance-deduped stops to `location_history` (last 10) |
| `api/data.js` | `GET /api/data` — reads `vitals` + `vitals_history` + `location_history` (60s cache), returns `{...vitals, history, locations}` |
| `api/contact.js` | `POST /api/contact` — public enquiry box; honeypot + per-IP rate limit (1/min) + length caps; stores to KV list `enquiries` (newest first, cap 50; read in the Upstash data browser) and forwards to the inbox via Resend when `RESEND_API_KEY`/`CONTACT_EMAIL` are set (best-effort — KV write is the source of truth) |
| `package.json` | `"type": "module"` (api/ is ESM) + `@vercel/kv` |
| `og-image.png` | 1200×630 social share card (generated, dark themed). All text sits in the center ~830px so platform crops (e.g. LinkedIn Featured, ~1.32:1) can't cut it — keep new text inside that safe zone if regenerating |
| `CHECKLIST.md` | Manual verification checklist (run through after any change) |

## Data flow

1. **iOS Shortcut** (on Gary's phone) reads Apple Health (steps, distance,
   calories) + GPS, `POST`s JSON to `/api/update` with `Authorization: Bearer <AUTH_KEY>`.
2. `update.js` validates auth + rate limit, stores the latest `vitals` object,
   upserts today's entry into `vitals_history` (one row per *device-local* day
   — the Shortcut may send `date` (YYYY-MM-DD) or `tz` (IANA name) in the JSON
   body, else Jakarta is assumed; rows merge by per-metric `Math.max` because
   daily Health totals only grow — capped to 14). The Shortcut should also
   send `days: [{date, steps, distance, calories}]` with *yesterday's* final
   Health totals: a day whose last live push landed early (evening steps
   never sent) self-heals on the next day's pushes. Same max merge, ≤7
   entries, future dates rejected. Finally — if the ping is >80km from the
   last recorded stop — it's appended to `location_history` (capped to 10,
   dedupes daily movement).
3. Browser `GET`s `/api/data` on load and every 5 min; falls back to demo
   values when the API 404s (e.g. local dev). Response includes `history` + `locations`.
4. `lat/lng` repositions the globe pin and triggers the Open-Meteo weather/timezone fetch.
   `locations` are reverse-geocoded (BigDataCloud, free/no-key) client-side and
   appended onto the curated 2026 trail as new dots + arcs.

**KV keys:** `vitals` (latest snapshot), `vitals_history` (daily snapshots),
`location_history` (deduped travel stops), `last_update_time` (rate-limit guard),
`enquiries` (contact-form messages), `contact_rl:<ip>` (contact rate-limit, 60s TTL).

**Env vars (Vercel):** `AUTH_KEY` (shared secret with the iOS Shortcut) + the
`KV_*` connection vars (auto-injected by the Vercel KV integration) +
`RESEND_API_KEY`/`CONTACT_EMAIL` (optional — email forwarding for enquiries;
without them enquiries only land in KV).

## Globe behavior (main.js)

- **Hex-grid Earth** (`#baa6d0` dots), atmosphere `#6a5acd`, dark surface.
- **Day/night terminator** — a transparent shader shell 0.6% above the hex
  layer darkens the hemisphere facing away from the sun (deep-navy tint,
  soft `smoothstep(0.09, -0.12)` dusk band). Sun position = `subsolarPoint()`
  (solar declination + equation of time, client-side only), pushed to the
  `sunDir` uniform every 60s — the terminator drifts ~0.25°/min in real time.
  Three.js constructors are **borrowed from globe.gl's scene objects** (no
  extra library; `initTerminator()` retries while the scene builds, then
  gives up quietly if globe.gl internals ever change). Side effect (accepted):
  travel dots + arc endpoints also dim on the night side. When Jakarta is in
  darkness, the live beacon cross-fades to a warm glow
  (`.pin-glow-persistent.night`). Dials: night alpha `0.52` + tint
  `vec4(0.006, 0.006, 0.016, …)` in the fragment shader; warm-glow CSS.
- **Travel trail** — curated 2026 journey (`HOME` → `PLACES` → `JOURNEY`,
  round-trips from the Jakarta hub, deduped undirected `buildArcs()`) as the
  base, with **auto-tracked stops** (`applyLocations()`) appended on top as
  new dots + arcs once real travel is recorded in `location_history`.
  Arcs are smooth (128-seg) with a gentle flowing shimmer fading out from Jakarta.
  ⚠️ Bali sits slightly over water — 110m GeoJSON drops small islands (known, accepted).
- **Pins** — live location = small white beacon + CSS glow overlay; travel
  stops (curated + auto) = periwinkle dots. Each has a large invisible hit-target for easy hover.
- **Hover tooltips** (`pointLabel`) — city + date for stops, current city +
  "Current location" for the live pin.
- **Auto-spin** — pauses while dragging/hovering the globe, eases back up to
  speed ~0.5s after 3s of stillness (`updateAutoSpin()` in the `trackPin` loop).
- **Guided-replay comet** — merged (PR #44). Flies the journey
  chronologically. The trail is a **canvas overlay** (`.replay-trail-canvas`,
  DPR-aware, sized from the globe's WebGL canvas because globe.gl's wrapper
  div is 0×0): exact Bézier positions are buffered with timestamps
  (`trailHistory`) and resampled uniformly over the last `TRAIL_MS`, drawn as
  one tapered two-pass stroke (soft periwinkle glow + bright core, `lighter`
  compositing) — continuous at any speed (the old DOM-dot trail tore into
  visible dots on fast legs), flows across leg boundaries, and eases into a
  city during the arrival hold. Far-side culling is a true depth test:
  `isBehindGlobe()` intersects the sightline from the *real* camera position
  (`globe.camera().position`, via `getCoords`/`getGlobeRadius`) with the globe
  sphere — a point is hidden iff the sphere is hit strictly before it (small
  epsilon so surface points don't self-occlude). This replaced the old
  analytic `horizonAngle()` estimate, which trusted `pointOfView().altitude`
  as the camera distance and let the comet/trail peek through near the limb.
  Arrival popup (`.replay-label`) shows at every stop, Jakarta included, and
  uses the same check. Tuning dials in main.js: `TRAIL_MS` (tail length),
  `TRAIL_SAMPLES`, the `fade*fade` alpha curve + `rgba` peaks in the stroke
  loop, and `COMET_HOLD_MS` / `COMET_LEG_BASE_MS` / `COMET_LEG_DIST_MS`
  (pacing). Respects `prefers-reduced-motion` (comet off).

## Hero reveal panels (GitHub / LinkedIn / Parklane)

All three social links share one pattern: **icon = toggle** (opens an inline
panel below the nav), **text = real outbound link** (new tab). Panels are
accordion-style — opening one closes any other (`registerHeroPanel()` in main.js).

- **GitHub** (octocat icon) → activity heatmap. Lazy-loads on page load (not
  just on open) from the jogruber API; ~4-month grid anchored to *today*
  (local date, not UTC) so the current week always shows. Touch support +
  pinch-zoom-aware tooltip positioning (`visualViewportBox()`).
- **LinkedIn** ("in" mark icon) → static About blurb (headline + bio). No live
  API — LinkedIn has no public profile endpoint, so this is hand-authored text
  in `index.html`, not KV/JS driven.
- **Parklane** (the real Parklane favicon, dimmed via `filter: brightness()`)
  → the product carousel (moved here from the old bottom dropdown).

**Icon styling:** all three use `.gh-toggle` — muted grey at rest, glow on
hover *and* while its panel is open (`[aria-expanded="true"]`), no underline
animation (unlike the plain text links, which do get the underline). The glow
color is one dial: the `--icon-glow` CSS var (`:root`, currently `#aa9fc6`) —
icon SVGs use `currentColor`; the Parklane favicon (`<img>`, no `currentColor`)
gets a matching `drop-shadow(... var(--icon-glow))` instead. ⚠️ The hover rule
is scoped `.social-links a.gh-toggle:hover` on purpose: it must out-specify
`.social-links a:hover` (which sets grey `#d0d0d5`), or hover reverts to grey
while only the open state shows the glow. Keep the `.social-links a.gh-toggle`
scoping if you touch it.

## UI conventions

- **Reveal panels** (`.github-panel`) — the live accordion, plain `<div>`s
  driven by `registerHeroPanel()`, animated open/closed via a grid-rows slide
  (`grid-template-rows: 0fr → 1fr`). Opening one closes the others. (The old
  `<details>`-based `.dropdown` pattern was fully deleted once nothing used it
  — resurrect from git history if ever needed.)
- **Daily Vitals** — plain always-on `<section class="vitals">` (static
  `DAILY VITALS` heading → steps/distance/calories grid → weekly trend chart),
  no longer collapsible.
- **Contact corner** — fixed bottom-right `CONTACT` toggle (dark text-shadow
  halo for legibility over content) + compact enquiry card (subject/message/
  reply email, honeypot field). POSTs to `/api/contact`; the email address
  appears nowhere in the page. Card animates via opacity/translate (not
  display), status text auto-clears. Status messages ("Sending…", "Sent — …",
  errors) enter with a slide-up/fade (`setStatus()` in main.js re-adds
  `.contact-status.pop` after a reflow flush so every message retriggers the
  keyframes; disabled under `prefers-reduced-motion`). ⚠️ `.contact-corner`
  is `pointer-events: none` — its box silently spans the closed card's full
  size over the bottom of the page (it blocked the trend chart's taps on
  phones); only the toggle and the `.open` card re-enable pointer events.
  Keep that if you add children to the corner.
- **Labels** — uppercase, letter-spaced, `#666` weight 600.
- **Carousel** — horizontal scroll-snap track, drag-to-scroll (a real drag
  suppresses the card link click; native link/image drag is blocked).
- **Trend chart** — weekly steps/distance/calories overlay under Daily Vitals,
  hover/tap for a per-day tooltip (pinch-zoom aware and edge-clamped, same as
  the GitHub tooltip).

## Local preview

Work **directly in the main repo on `master`** — no worktrees. `.claude/launch.json`
(gitignored, local) runs `python -m http.server --directory <main repo>`, so the
preview serves the main repo itself. The API routes 404 locally (no Vercel
runtime), so vitals/trend/locations fall back to demo values — this is expected.

⚠️ **Browser caches JS/CSS aggressively on a fixed port.** When iterating, bump
the port number in `.claude/launch.json` and restart the preview to force a fresh load.

Run through `CHECKLIST.md` after non-trivial changes.

## Workflow notes

- **Ask before pushing.** Preview changes first, then confirm before `git push`.
- **No worktrees.** The harness may create `.claude/worktrees/*` checkouts —
  ignore them. Edit, commit, push, and preview from the main repo only; never
  copy files into a worktree or `git reset --hard` one to "keep it in sync."
- **Leave the preview server running and give Gary the localhost URL** so he
  can verify himself — don't rely solely on eval/screenshot self-verification
  for interactive behavior (this preview environment's screenshot/resize tools
  have shown flakiness with multi-panel click state; direct DOM `.click()` +
  computed-style checks are more reliable for logic verification, but Gary's
  own click-through is the real test). ⚠️ The preview tab sometimes loads
  **hidden** (`document.visibilityState === 'hidden'`, even `innerWidth: 0`)
  — `requestAnimationFrame` never fires there, so *any* animation (globe
  spin, comet, trail) reads as dead/0 in eval probes. Check `visibilityState`
  before concluding an animation is broken.
- Main branch: `master`. Vercel auto-deploys on push. Repo is **public** — no
  secrets belong in the repo itself (env vars only).
- Check `git fetch && git log origin/master` before starting new work — other
  sessions (e.g. iOS Claude) may have pushed/merged PRs directly.

## Branches

Only `master` — everything is merged and stale branches were purged (2026-07).
If a `vercel/*` branch appears, it's the Vercel dashboard's agent auto-generating
an "integration" PR — those over-engineer (npm + Vite on a no-build site); prefer
implementing the one-liner ourselves and deleting the bot branch.

## Roadmap / parked ideas

- ~~Comet limb bug~~ — fixed 2026-07: far-side culling is now an exact
  ray-sphere depth test against the real camera (`isBehindGlobe()` in
  main.js), replacing the analytic horizon-angle estimate.
- **Projects showcase** — Experience now lives in the LinkedIn panel; a
  separate projects/cards section is still open if Gary wants one.
- ~~OG image refresh~~ — regenerated 2026-07 with a crop-safe centered layout
  (LinkedIn's Featured crop was cutting the old left-aligned name). After a
  redeploy, re-scrape via LinkedIn Post Inspector to bust its cache.
- **Enquiry notifications beyond email** — Resend forwarding is wired; an iOS
  Shortcut poll of an authed enquiries endpoint is a possible alternative.
