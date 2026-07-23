# musical-spoon

#### Personal portfolio for Gary Ramli — [garyramli.com](https://garyramli.com)

- 3D travel globe with auto-tracking
- Live location/weather/time from Apple Health via iOS Shortcut
- Activity trends
- GitHub/LinkedIn/Parklane reveal panels

 Built with Vanilla HTML/CSS/JS + Vercel

## Local preview

###### You can serve the repo root and open the printed URL via:

```
python -m http.server xxxx --directory .
```

## iOS Shortcut → pushes to `/api/update`

The live vitals + daily history are fed by an iOS Shortcut on the owner's
phone that reads Apple Health and POSTs to the Vercel API.

### Schedule

Runs on a time automation **6× a day**: `04:00, 08:00, 12:00, 16:00, 20:00,
23:50` (device-local). The 23:50 run captures nearly the full day; the
overnight/morning runs keep the live numbers fresh and deliver the previous
days' back-fill. Set the automation to **Run Immediately** (Ask Before Running
**off**) so a run near midnight isn't silently delayed into the next day.

### Shortcut Configuration

###### Contents:
```
POST https://<URL>/api/update
Authorization: Bearer <AUTH_KEY>
Content-Type: application/json
```

###### Example Payload:
```json
{
  "steps": 6264,
  "distance": 3.82,
  "calories": 97.96,
  "flights": 0,
  "lat": -6.2088,
  "lng": 106.8456,
  "date": "2026-07-23",
  "days": [
    { "date": "2026-07-22", "steps": 7716, "distance": 2.99, "calories": 148 },
    { "date": "2026-07-21", "steps": 11457, "distance": 7.27, "calories": 220 }
  ]
}
```

| Field | Description |
|-------|---------|
| `steps` / `distance` / `calories` / `flights` | Today's live Health totals (the `vitals` snapshot shown at the top of the page) |
| `lat` / `lng` | Current GPS — repositions the globe pin, drives weather/timezone, and feeds `location_history` |
| `date` | Today's **device-local** day as `YYYY-MM-DD`. Keys the history row to the phone's day so totals bucket correctly while travelling. Omit → server falls back to `Asia/Jakarta`. (`tz` with an IANA name also works instead of `date`) |
| `days` | Recent entries - best practice is to push yesterday's data *(more below)* |

### Why `days` (self-healing history)

A day whose last live push landed early (e.g. steps walked after 20:00 never
sent) would otherwise stay undercounted forever. Sending the **last 7 days'**
final Health totals on every push re-heals the whole visible window each run —
late Apple Watch syncs, missed pushes, and travel all get folded in
automatically. Re-sending is safe: the server takes `Math.max`, so an already-
correct day just no-ops.

### Building `days` without repeating actions

Wrap the single-day query block in a **Repeat (7 times)** loop:

1. `Adjust Date` → Current Date **− [Repeat Index] Days**
2. `Format Date` → `yyyy-MM-dd`
3. For Steps / Walking + Running Distance / Active Energy:
   `Find Health Samples` (filtered to that day) → `Calculate Statistics` → **Sum**
4. `Dictionary` → `{ date, steps, distance, calories }`
5. `Add to Variable` → `DaysList`  *(last action inside the loop)*

After the loop, set the request body's `days` = `DaysList`.

> **Avoid double-counting:** `Find Health Samples` + `Sum` adds *raw* samples,
> and Health stores overlapping iPhone + Watch samples for the same minutes —
> summing both inflates the count. Add a **`Source is <one device>`** filter
> inside the loop so the total matches what the Health app itself shows.

### Server behavior (`api/update.js`)

We use Bearer-auth + 1-per-30s rate limit. We also use `resolveDay()` to pick the 
history row (`date` → `tz` → Jakarta). This pushes every `days` entry (today and however
many days) merge by per-metric is done via `Math.max`. History is sorted and capped to the last **14** days. 

GPS pings > 80 km from the last recorded stop append to `location_history` (capped to 10). 

## Misc

A local, gitignored `.claude/launch.json` wires this up for the Claude Code
preview tool. 

`/api` routes 404 locally (no Vercel runtime), so vitals/trend/locations fall back to demo values. 

Browsers cache JS/CSS hard on a fixed port; bump the port to force a fresh load.

For LLMs - see [`CHECKLIST.md`](CHECKLIST.md) for what to verify after a change, and
[`CLAUDE.md`](CLAUDE.md) for the full architecture, data flow, and conventions.