import { kv } from '@vercel/kv';

// The Health "day" a push belongs to. Apple Health buckets daily totals by the
// *device's* midnight, so prefer an explicit date or IANA timezone sent by the
// iOS Shortcut; fall back to Jakarta (home) when neither is present.
function resolveDay(body) {
	const date = body && body.date;
	if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) return date;
	const tz = body && body.tz;
	if (typeof tz === 'string' && tz) {
		try {
			return new Date().toLocaleDateString('en-CA', { timeZone: tz });
		} catch (e) { /* unknown timezone name — fall through to home */ }
	}
	return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

// Great-circle distance in km — used to de-dupe location pings into real "stops"
function haversineKm(la1, lo1, la2, lo2) {
	const R = 6371, r = d => d * Math.PI / 180;
	const dLa = r(la2 - la1), dLo = r(lo2 - lo1);
	const h = Math.sin(dLa / 2) ** 2 + Math.cos(r(la1)) * Math.cos(r(la2)) * Math.sin(dLo / 2) ** 2;
	return 2 * R * Math.asin(Math.sqrt(h));
}

export default async function handler(req, res) {
	// CORS headers
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

	if (req.method === 'OPTIONS') return res.status(200).end();
	if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

	// Verify auth key
	const auth = req.headers.authorization;
	if (!auth || auth !== `Bearer ${process.env.AUTH_KEY}`) {
		return res.status(401).json({ error: 'Unauthorized' });
	}

	// Rate limit: max 1 update per 30 seconds
	const lastUpdate = await kv.get('last_update_time');
	const now = Date.now();
	if (lastUpdate && now - lastUpdate < 30000) {
		return res.status(429).json({ error: 'Too many requests' });
	}

	try {
		const { steps, distance, calories, flights, lat, lng } = req.body;

		const data = {
			steps: Number(steps) || 0,
			distance: Number(distance) || 0,
			calories: Number(calories) || 0,
			flights: Number(flights) || 0,
			lat: Number(lat) || 0,
			lng: Number(lng) || 0,
			updatedAt: new Date().toISOString(),
		};

		await kv.set('vitals', data);
		await kv.set('last_update_time', now);

		// Daily history for sparklines — best-effort, never break the main update.
		// One entry per device-local day (see resolveDay). Daily totals only ever
		// grow, so same-day merges take the per-metric max — a stale push (phone
		// not yet synced with the Watch) or a post-midnight ~0 reset landing on
		// the previous day's row (device ahead of Jakarta) can't wipe real data.
		try {
			const today = resolveDay(req.body);
			let history = (await kv.get('vitals_history')) || [];
			// Two merge modes:
			//  · today's row grows all day and a push can be stale (Watch not yet
			//    synced), so live values only ever raise it — `max`.
			//  · a *closed* day sent in `days` is a fresh read of Health's final
			//    total, i.e. authoritative: it replaces, so an over-count can come
			//    back down instead of being locked in forever by the max ratchet.
			//    Guard: a metric of 0 keeps the stored value — the three metrics
			//    come from three separate Health queries, so one failing must not
			//    blank a real day (a closed day never legitimately drops to 0).
			const mergeDay = (entry, authoritative) => {
				const idx = history.findIndex(h => h.date === entry.date);
				if (idx < 0) {
					// never create a row out of an all-zero reading (failed queries)
					if (authoritative && !entry.steps && !entry.distance && !entry.calories) return;
					history.push(entry);
					return;
				}
				const prev = history[idx];
				const pick = (was, now) => authoritative
					? (now > 0 ? now : (Number(was) || 0))   // replace, keeping non-zero
					: Math.max(Number(was) || 0, now);       // live: only ever raise
				history[idx] = {
					date: entry.date,
					steps: pick(prev.steps, entry.steps),
					distance: pick(prev.distance, entry.distance),
					calories: pick(prev.calories, entry.calories),
				};
			};
			mergeDay({
				date: today,
				steps: data.steps,
				distance: data.distance,
				calories: data.calories,
			}, false);
			// Optional back-fill: `days` carries closed-out totals for recent
			// dates, queried fresh from Health by the Shortcut. Past days are
			// authoritative (replace); an entry dated today is just another live
			// reading of a day still in progress, so it merges with `max`.
			if (Array.isArray(req.body.days)) {
				for (const d of req.body.days.slice(0, 7)) {
					if (!d || typeof d.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d.date)) continue;
					if (d.date > today) continue; // a typo'd future date must not evict real rows
					mergeDay({
						date: d.date,
						steps: Number(d.steps) || 0,
						distance: Number(d.distance) || 0,
						calories: Number(d.calories) || 0,
					}, d.date < today);
				}
			}
			history.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
			history = history.slice(-14); // keep ~2 weeks
			await kv.set('vitals_history', history);
		} catch (e) {
			// history is non-critical; ignore failures
		}

		// Location history — append only meaningfully-new stops (distance-deduped,
			// so daily movement around home never spams the trail). Best-effort.
			try {
				if (data.lat && data.lng) {
					const STOP_KM = 80; // a ping must be >80km from the last stop to count as new
					let locs = (await kv.get('location_history')) || [];
					const last = locs[locs.length - 1];
					if (!last || haversineKm(last.lat, last.lng, data.lat, data.lng) > STOP_KM) {
						locs.push({ lat: data.lat, lng: data.lng, t: now });
						locs = locs.slice(-10); // keep the last 10 stops
						await kv.set('location_history', locs);
					}
				}
			} catch (e) {
				// non-critical; ignore
			}

			return res.status(200).json({ ok: true, data });
	} catch (e) {
		return res.status(400).json({ error: 'Invalid data' });
	}
}
