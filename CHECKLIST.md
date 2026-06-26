# Verification checklist

The things to verify after a change — the same checks I run during preview, so
they're covered whoever's testing. Preview locally first. Note: the `/api`
routes 404 locally (no Vercel runtime), so vitals/trend/locations fall back to
demo values — that's expected, not a bug.

## Every change — quick smoke test
- **Hard-refresh** (Ctrl/Cmd+Shift+R), or use the fresh preview port to dodge cache.
- **Console** (F12 → Console): no red errors.
- Page renders fully; nothing overlaps, clips, or overflows.
- **Resize narrow** (DevTools device toolbar) → mobile layout holds.

## Globe
- Loads, auto-spins slowly, pin glows on Jakarta.
- Travel arcs + periwinkle city dots render.
- Hover a city dot → "City — date" tooltip; hover the white pin → current city.
- Drag it → spin pauses; release → eases back up after ~3s.

## Dropdowns (Daily Vitals, Parklane)
- Toggle open/close smoothly; arrow rotates; content doesn't clip mid-slide.

## Trend chart (inside Daily Vitals)
- Renders (demo data locally; hidden live until ≥2 days are banked).
- Hover → date + per-metric tooltip that tracks the cursor.

## Parklane carousel
- Click-drag scrolls; release snaps to a card.
- A real drag does **not** open the product link; a plain click does.
- No URL-ghost overlay or text-selection while dragging.

## GitHub panel
- Click "Github" → panel expands; heatmap cells render with the right colors.
- Hover a cell → `date · count` tooltip.
- Octocat icon links out to the profile (new tab); panel collapses on a second click.

## After deploy (live site only)
- Hard-refresh garyramli.com.
- `garyramli.com/api/data` → JSON with real `steps/lat/lng` + `history` + `locations` (not a 404).
- Vitals / time / weather reflect the latest push.
- Sparklines appear once ≥2 days are banked; new travel (>80 km from the last stop) shows on the globe.

## How I verify during preview (for reference)
- Read the browser console for errors.
- Inspect element state — counts (dots, arcs, trail), and computed styles for exact colors/sizes.
- Simulate the interaction (click/hover), then re-check the resulting state.
- Screenshot for layout/visual; but use computed styles, not the screenshot, to confirm precise colors/fonts.
