import express from 'express';
import {
	disconnectCalendarAccount,
	getCalendarAuthUrl,
	isCalendarConnected,
	storeCalendarCode
} from '../services/calendar.js';

const router = express.Router();
const CONNECTED_SETTINGS_PATH = '/settings?calendar=connected';

function getCalendarStatusPayload() {
	return {
		configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI),
		connected: isCalendarConnected()
	};
}

export function getCalendarConnectedRedirectUrl() {
	if (process.env.CALENDAR_RETURN_URL) {
		return new URL(CONNECTED_SETTINGS_PATH, process.env.CALENDAR_RETURN_URL).toString();
	}

	if (process.env.NODE_ENV === 'production') {
		return CONNECTED_SETTINGS_PATH;
	}

	return new URL(CONNECTED_SETTINGS_PATH, process.env.CLIENT_ORIGIN || 'http://localhost:5173').toString();
}

router.get('/status', (req, res) => {
	res.json(getCalendarStatusPayload());
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
		res.redirect(getCalendarConnectedRedirectUrl());
	} catch (error) {
		next(error);
	}
});

router.delete('/connection', (req, res, next) => {
	try {
		const disconnectResult = disconnectCalendarAccount();

		res.json({
			...getCalendarStatusPayload(),
			...disconnectResult
		});
	} catch (error) {
		next(error);
	}
});

export default router;
