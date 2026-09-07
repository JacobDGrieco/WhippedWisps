import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { afterEach, expect, test } from 'vitest';
import { closeDb } from '../../src/db/connection.js';
import { createOrder, getOrderById } from '../../src/db/orders.js';
import { getSetting, setSetting } from '../../src/db/settings.js';
import { createApp } from '../../src/app.js';
import { getCalendarConnectedRedirectUrl } from '../../src/routes/settingsCalendar.js';

const TEST_DB = path.resolve('./server/tests/tmp/test-settings-calendar-routes.db');
const originalNodeEnv = process.env.NODE_ENV;
const originalClientOrigin = process.env.CLIENT_ORIGIN;
const originalCalendarReturnUrl = process.env.CALENDAR_RETURN_URL;
const originalDbPath = process.env.DB_PATH;
const originalGoogleClientId = process.env.GOOGLE_CLIENT_ID;
const originalGoogleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const originalGoogleRedirectUri = process.env.GOOGLE_REDIRECT_URI;

function restoreEnvValue(name, value) {
	if (value === undefined) {
		delete process.env[name];
	} else {
		process.env[name] = value;
	}
}

function resetRedirectEnv() {
	restoreEnvValue('NODE_ENV', originalNodeEnv);
	restoreEnvValue('CLIENT_ORIGIN', originalClientOrigin);
	restoreEnvValue('CALENDAR_RETURN_URL', originalCalendarReturnUrl);
	restoreEnvValue('DB_PATH', originalDbPath);
	restoreEnvValue('GOOGLE_CLIENT_ID', originalGoogleClientId);
	restoreEnvValue('GOOGLE_CLIENT_SECRET', originalGoogleClientSecret);
	restoreEnvValue('GOOGLE_REDIRECT_URI', originalGoogleRedirectUri);
}

afterEach(async () => {
	resetRedirectEnv();
	await closeDb();
	fs.rmSync(TEST_DB, { force: true });
});

test('calendar callback redirects to the Vite client during local development', () => {
	delete process.env.NODE_ENV;
	delete process.env.CLIENT_ORIGIN;
	delete process.env.CALENDAR_RETURN_URL;

	expect(getCalendarConnectedRedirectUrl()).toBe('http://localhost:5173/settings?calendar=connected');
});

test('calendar callback uses configured client origin outside the default Vite port', () => {
	delete process.env.NODE_ENV;
	delete process.env.CALENDAR_RETURN_URL;
	process.env.CLIENT_ORIGIN = 'http://localhost:5174';

	expect(getCalendarConnectedRedirectUrl()).toBe('http://localhost:5174/settings?calendar=connected');
});

test('calendar callback keeps relative redirects in production', () => {
	process.env.NODE_ENV = 'production';
	delete process.env.CLIENT_ORIGIN;
	delete process.env.CALENDAR_RETURN_URL;

	expect(getCalendarConnectedRedirectUrl()).toBe('/settings?calendar=connected');
});

test('DELETE /api/settings/calendar/connection removes the connected account metadata', async () => {
	await closeDb();
	fs.rmSync(TEST_DB, { force: true });
	process.env.DB_PATH = TEST_DB;
	delete process.env.DATABASE_URL;
	delete process.env.POSTGRES_URL;
	delete process.env.POSTGRES_PRISMA_URL;
	delete process.env.POSTGRES_URL_NON_POOLING;
	process.env.GOOGLE_CLIENT_ID = 'client-id';
	process.env.GOOGLE_CLIENT_SECRET = 'client-secret';
	process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3001/api/settings/calendar/callback';

	const app = createApp();
	await setSetting('google.refreshToken', 'refresh-token');
	await setSetting('google.calendarId', 'calendar-id');
	const order = await createOrder({
		customerName: 'Jane Doe',
		dueDate: '2026-09-01',
		googleEventId: 'google-event-id'
	});

	const response = await request(app)
		.delete('/api/settings/calendar/connection')
		.expect(200);

	expect(response.body).toMatchObject({
		configured: true,
		connected: false,
		disconnected: true,
		clearedEventCount: 1
	});
	expect(await getSetting('google.refreshToken')).toBeNull();
	expect(await getSetting('google.calendarId')).toBeNull();
	expect((await getOrderById(order.id)).googleEventId).toBeNull();
});
