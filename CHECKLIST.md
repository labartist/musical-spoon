# Verification checklist

The things to verify after a change — the same checks I run during preview, so
they're covered whoever's testing. Preview locally first. Note: the `/api`
routes 404 locally (no Vercel runtime), so vitals/trend/locations fall back to
demo values and the contact form reports "couldn't send" — that's expected, not a bug.

## Every change — quick smoke test
- **Hard-refresh** (Ctrl/Cmd+Shift+R), or use the fresh preview port to dodge cache.
- **Console** (F12 → Console): no red errors.
- Globe still renders (globe.gl is pinned + `defer`; main.js must stay `defer`
  *after* it in document order).
- Page renders fully; nothing overlaps, clips, or overflows.
- **Resize narrow** (DevTools device toolbar) → mobile layout holds.

## Globe
- Loads, auto-spins slowly, pin glows on Jakarta.
- Day/night terminator: hexes on the sun-facing side bright periwinkle,
  night side dimmed navy, soft dusk band between — positioned correctly for
  the current UTC time (sun over ~15°E at noon UTC, drifting west).
- Pin glow: white while the **pin's** location is in daylight, warm sodium
  glow once the sun is actually down there — it follows the pin, not Jakarta
  (abroad it must stay white at midday). Switches at real sunset/sunrise, in
  step with the globe shading under it.
- Weather line: ☾ appears only on a clear night *after real sunset* at the
  pin (Jakarta ≈ 17:40–18:20 depending on season) — never on a fixed 18:00.
  Quick console check: `isDark(lat, lng)` agrees with what the globe shows.
- Travel arcs + periwinkle city dots render.
- Round trips draw **two** arcs — a tall one out, a shallow one home (spin
  side-on to Jakarta⇄Bali or Jakarta⇄Shanghai to see them split); the comet
  flies out and back along them. New tracked travel extends both the arcs and
  the comet's route on the next data refresh.
- Hover a city dot → "City — date" tooltip; hover the white pin → current city.
- Drag it → spin pauses; release → eases back up after ~3s.

## Replay comet
- Comet flies the journey city-to-city along the arcs, with a continuous
  tapered trail (a solid streak — never separate dots, even on fast legs).
- Arrival popup (name only; "Home" subtitle for Jakarta) at every stop.
- Trail eases into the city during the arrival hold, then regrows on departure.
- Comet, trail and arrival popup disappear exactly at the globe's edge when
  they pass behind it — never visible through the globe (exact depth test,
  `isBehindGlobe()`; fixed 2026-07).
- With OS reduced-motion enabled: no comet at all.

## Hero reveal panels (GitHub / LinkedIn / Parklane)
- Icon click opens its panel; opening another closes the first (accordion).
- Icon glows (--icon-glow) on hover and stays lit while its panel is open;
  text links underline on hover, icons never do.
- GitHub → heatmap renders (preloaded — visible immediately), current week
  present, hover a cell → `date · count` tooltip.
- LinkedIn → bio + divider + Experience rows (scroll + bottom fade only if
  the list overflows).
- Parklane → carousel: click-drag scrolls, release snaps; a real drag does
  **not** open the product link, a plain click does; no ghost-drag artifacts.
- Text links open the real profiles/sites in a new tab.

## Daily Vitals (always-on section)
- DAILY VITALS heading → steps/distance/calories values render.
- Trend chart below (demo data locally; hidden live until ≥2 days are banked).
- Label reads `<total> STEPS · PAST N DAYS`; total matches the sum of the plotted days.
- Hover → date + per-metric tooltip that tracks the cursor.
- `· So Far` appears only on the day still in progress **on the pin's clock**
  — not on a finished day, even for a visitor in another timezone.
- Freshness label: "x min/hr ago" for today's snapshot; "yesterday" between
  midnight and the first push of the day (the numbers shown are yesterday's).

## Contact corner (bottom-right)
- CONTACT label legible even over page content (dark text-shadow halo).
- Click → card fades/rises in; second click closes; status line is empty on open.
- Empty/invalid fields → "All fields required"; errors clear after ~3s.
- Locally the send fails (no API) — that's the expected 404 fallback.
- The email address must appear NOWHERE in the page source (view-source check).

## After deploy (live site only)
- Hard-refresh garyramli.com.
- `garyramli.com/api/data` → JSON with real `steps/lat/lng` + `history` + `locations` (not a 404).
- Second (normal) reload: vitals/trend paint instantly from `localStorage`
  before the fetch lands; freshness label shows the cached age, then updates.
- Vitals / time / weather reflect the latest push.
- Sparklines appear once ≥2 days are banked; new travel (>80 km from the last stop) shows on the globe.
- Contact form round-trip: send a test enquiry → lands in KV `enquiries`
  (Upstash data browser) and, if Resend env vars are set, in the inbox.
- `/_vercel/insights/script.js` returns 200 (analytics enabled).

## How I verify during preview (for reference)
- Read the browser console for errors.
- Inspect element state — counts (dots, arcs, trail), and computed styles for exact colors/sizes.
- Simulate the interaction (click/hover), then re-check the resulting state.
- Screenshot for layout/visual; but use computed styles, not the screenshot, to confirm precise colors/fonts.
- If animations look dead, check `document.visibilityState` first — a hidden
  preview tab never fires requestAnimationFrame.
