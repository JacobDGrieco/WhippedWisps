import express from 'express';
import {
	disconnectCalendarAccount,
	getCalendarAuthUrl,
	isCalendarConnected,
	storeCalendarCode
} from '../services/calendar.js';

const router = express.Router();
const CONNECTED_SETTINGS_PATH = '/settings?calendar=connected';

function asyncHandler(handler) {
	return (req, res, next) => {
		Promise.resolve(handler(req, res, next)).catch(next);
	};
}

async function getCalendarStatusPayload() {
	return {
		configured: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI),
		connected: await isCalendarConnected()
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

router.get('/status', asyncHandler(async (req, res) => {
	res.json(await getCalendarStatusPayload());
}));

router.get('/auth-url', asyncHandler(async (req, res) => {
	res.json({ url: await getCalendarAuthUrl() });
}));

router.get('/callback', asyncHandler(async (req, res) => {
	if (!req.query.code) {
		res.status(400).send('Missing Google authorization code.');
		return;
	}

	await storeCalendarCode(req.query.code);
	res.redirect(getCalendarConnectedRedirectUrl());
}));

router.delete('/connection', asyncHandler(async (req, res) => {
	const disconnectResult = await disconnectCalendarAccount();

	res.json({
		...(await getCalendarStatusPayload()),
		...disconnectResult
	});
}));

export default router;
