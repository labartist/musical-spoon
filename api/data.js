import { kv } from '@vercel/kv';

export default async function handler(req, res) {
	// CORS headers
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
	res.setHeader('Cache-Control', 'public, max-age=60');

	if (req.method === 'OPTIONS') return res.status(200).end();
	if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

	try {
		const data = await kv.get('vitals');

		if (!data) {
			return res.status(404).json({ error: 'No data yet' });
		}

		return res.status(200).json(data);
	} catch (e) {
		return res.status(500).json({ error: 'Internal error' });
	}
}
