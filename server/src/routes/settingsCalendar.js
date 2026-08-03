import express from 'express';
import {
	getCalendarAuthUrl,
	isCalendarConnected,
	storeCalendarCode
} from '../services/calendar.js';

const router = express.Router();

router.get('/status', (req, res) => {
	res.json({
		configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI),
		connected: isCalendarConnected()
	});
});

router.get('/auth-url', (req, res, next) => {
	try {
		res.json({ url: getCalendarAuthUrl() });
	} catch (error) {
		next(error);
	}
});

router.get('/callback', async (req, res, next) => {
	try {
		if (!req.query.code) {
			res.status(400).send('Missing Google authorization code.');
			return;
		}

		await storeCalendarCode(req.query.code);
		res.redirect('/settings?calendar=connected');
	} catch (error) {
		next(error);
	}
});

export default router;
