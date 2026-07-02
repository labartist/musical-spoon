# musical-spoon

Personal portfolio for Gary Ramli — [garyramli.com](https://garyramli.com).
A "living dashboard": 3D travel globe with auto-tracking, live location/weather/time
from Apple Health via iOS Shortcut, activity trends, and GitHub/LinkedIn/Parklane
reveal panels. Vanilla HTML/CSS/JS + Vercel serverless functions + Vercel KV.

## Local preview

No build step — it's a static site, so any local HTTP server works. Serve the
repo root and open the printed URL:

```
python -m http.server xxxx --directory .
```

(A local, gitignored `.claude/launch.json` wires this up for the Claude Code
preview tool.) The `/api` routes 404 locally (no Vercel runtime), so
vitals/trend/locations fall back to demo values — this is expected. Browsers
cache JS/CSS hard on a fixed port; bump the port to force a fresh load.

See [`CHECKLIST.md`](CHECKLIST.md) for what to verify after a change, and
[`CLAUDE.md`](CLAUDE.md) for the full architecture, data flow, and conventions.