# Verification checklist

The things to verify after a change — the same checks I run during preview, so
they're covered whoever's testing. Preview locally first. Note: the `/api`
routes 404 locally (no Vercel runtime), so vitals/trend/locations fall back to
demo values and the contact form reports "couldn't send" — that's expected, not a bug.

## Every change — quick smoke test
- **Hard-refresh** (Ctrl/Cmd+Shift+R), or use the fresh preview port to dodge cache.
- **Console** (F12 → Console): no red errors.
- Page renders fully; nothing overlaps, clips, or overflows.
- **Resize narrow** (DevTools device toolbar) → mobile layout holds.

## Globe
- Loads, auto-spins slowly, pin glows on Jakarta.
- Day/night terminator: hexes on the sun-facing side bright periwinkle,
  night side dimmed navy, soft dusk band between — positioned correctly for
  the current UTC time (sun over ~15°E at noon UTC, drifting west).
- Jakarta beacon: white by day, warm sodium glow while Jakarta is dark
  (~18:00–06:00 WIB).
- Travel arcs + periwinkle city dots render.
- Hover a city dot → "City — date" tooltip; hover the white pin → current city.
- Drag it → spin pauses; release → eases back up after ~3s.

## Replay comet
- Comet flies the journey city-to-city along the arcs, with a continuous
  tapered trail (a solid streak — never separate dots, even on fast legs).
- Arrival popup (name only; "Home" subtitle for Jakarta) at every stop.
- Trail eases into the city during the arrival hold, then regrows on departure.
- ⚠️ Known open issue: comet/trail occasionally visible behind the globe near
  the limb — don't chase it during unrelated changes (see CLAUDE.md).
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
- Hover → date + per-metric tooltip that tracks the cursor.

## Contact corner (bottom-right)
- CONTACT label legible even over page content (dark text-shadow halo).
- Click → card fades/rises in; second click closes; status line is empty on open.
- Empty/invalid fields → "All fields required"; errors clear after ~3s.
- Locally the send fails (no API) — that's the expected 404 fallback.
- The email address must appear NOWHERE in the page source (view-source check).

## After deploy (live site only)
- Hard-refresh garyramli.com.
- `garyramli.com/api/data` → JSON with real `steps/lat/lng` + `history` + `locations` (not a 404).
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
