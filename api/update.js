import { kv } from '@vercel/kv';

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

		return res.status(200).json({ ok: true, data });
	} catch (e) {
		return res.status(400).json({ error: 'Invalid data' });
	}
}
