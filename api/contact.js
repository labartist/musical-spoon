import { kv } from '@vercel/kv';

// POST /api/contact — public enquiry box (subject + message + reply address).
// No auth (anyone may write), so defended instead by: per-IP rate limit,
// strict length caps, and a honeypot field. Enquiries land in the KV list
// `enquiries` (newest first, capped) — read them in the Upstash dashboard.
const MAX_ENQUIRIES = 50;

export default async function handler(req, res) {
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
	res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

	if (req.method === 'OPTIONS') return res.status(200).end();
	if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

	try {
		const { subject, message, reply, website } = req.body || {};

		// Honeypot filled → bot. Pretend success so it doesn't adapt.
		if (website) return res.status(200).json({ ok: true });

		const s = String(subject || '').trim().slice(0, 120);
		const m = String(message || '').trim().slice(0, 2000);
		const r = String(reply || '').trim().slice(0, 120);
		if (!s || !m) return res.status(400).json({ error: 'Subject and message are required' });
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r)) return res.status(400).json({ error: 'A valid reply email is required' });

		// Rate limit: 1 enquiry per IP per minute (NX set with 60s expiry)
		const ip = (req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
		const fresh = await kv.set(`contact_rl:${ip}`, 1, { nx: true, ex: 60 });
		if (fresh === null) return res.status(429).json({ error: 'Too many requests — try again in a minute' });

		await kv.lpush('enquiries', JSON.stringify({ subject: s, message: m, reply: r, at: new Date().toISOString() }));
		await kv.ltrim('enquiries', 0, MAX_ENQUIRIES - 1);

		// Forward to the inbox via Resend when configured (RESEND_API_KEY +
		// CONTACT_EMAIL env vars). Best-effort: the enquiry is already safe in
		// KV, so a send failure must not fail the request.
		if (process.env.RESEND_API_KEY && process.env.CONTACT_EMAIL) {
			try {
				await fetch('https://api.resend.com/emails', {
					method: 'POST',
					headers: {
						'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify({
						from: 'garyramli.com <onboarding@resend.dev>',
						to: [process.env.CONTACT_EMAIL],
						reply_to: r,
						subject: `[garyramli.com] ${s}`,
						text: `${m}\n\n— reply to: ${r}`,
					}),
				});
			} catch (e) { /* stored in KV regardless */ }
		}

		return res.status(200).json({ ok: true });
	} catch (e) {
		return res.status(500).json({ error: 'Something went wrong' });
	}
}
