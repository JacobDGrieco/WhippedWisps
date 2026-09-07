import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, expect, test, vi } from 'vitest';
import { closeDb } from '../../src/db/connection.js';
import { createOrder, getOrderById } from '../../src/db/orders.js';
import { getSetting, setSetting } from '../../src/db/settings.js';
import { syncOrderToCalendar } from '../../src/services/calendar.js';

const googleMocks = vi.hoisted(() => {
	const oauthClient = {
		setCredentials: vi.fn()
	};
	const calendarApi = {
		calendarList: {
			list: vi.fn()
		},
		calendars: {
			insert: vi.fn()
		},
		events: {
			insert: vi.fn(),
			update: vi.fn(),
			delete: vi.fn()
		}
	};

	return {
		oauthClient,
		calendarApi
	};
});

vi.mock('googleapis', () => ({
	google: {
		auth: {
			OAuth2: vi.fn(() => googleMocks.oauthClient)
		},
		calendar: vi.fn(() => googleMocks.calendarApi)
	}
}));

const TEST_DB = path.resolve('./server/tests/tmp/test-calendar-sync.db');

beforeEach(async () => {
	vi.clearAllMocks();
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
	process.env.CALENDAR_NAME = 'Whipped Wisps Orders';

	googleMocks.calendarApi.calendarList.list.mockResolvedValue({
		data: {
			items: [{ summary: 'Whipped Wisps Orders', id: 'fresh-calendar-id' }]
		}
	});
	googleMocks.calendarApi.calendars.insert.mockResolvedValue({ data: { id: 'created-calendar-id' } });
	googleMocks.calendarApi.events.insert.mockResolvedValue({ data: { id: 'new-event-id' } });
	googleMocks.calendarApi.events.update.mockResolvedValue({ data: { id: 'existing-event-id' } });

	await setSetting('google.refreshToken', 'refresh-token');
});

test('syncOrderToCalendar recreates an event when the saved event id is missing in Google', async () => {
	await setSetting('google.calendarId', 'valid-calendar-id');
	googleMocks.calendarApi.events.update.mockRejectedValueOnce({ status: 404, message: 'Not Found' });
	const order = await createOrder({
		customerName: 'Jane Doe',
		dueDate: '2026-09-04',
		theme: 'Wedding',
		googleEventId: 'missing-event-id'
	});

	const result = await syncOrderToCalendar(order);

	expect(googleMocks.calendarApi.events.update).toHaveBeenCalledWith(expect.objectContaining({
		calendarId: 'valid-calendar-id',
		eventId: 'missing-event-id'
	}));
	expect(googleMocks.calendarApi.events.insert).toHaveBeenCalledWith(expect.objectContaining({
		calendarId: 'valid-calendar-id'
	}));
	expect(result).toEqual({ synced: true, eventId: 'new-event-id' });
	expect((await getOrderById(order.id)).googleEventId).toBe('new-event-id');
});

test('syncOrderToCalendar refreshes a stale cached calendar id before reinserting', async () => {
	await setSetting('google.calendarId', 'stale-calendar-id');
	googleMocks.calendarApi.events.insert
		.mockRejectedValueOnce({ status: 404, message: 'Not Found' })
		.mockResolvedValueOnce({ data: { id: 'new-event-id' } });
	const order = await createOrder({
		customerName: 'Jane Doe',
		dueDate: '2026-09-04',
		theme: 'Wedding'
	});

	const result = await syncOrderToCalendar(order);

	expect(googleMocks.calendarApi.events.insert).toHaveBeenNthCalledWith(1, expect.objectContaining({
		calendarId: 'stale-calendar-id'
	}));
	expect(googleMocks.calendarApi.events.insert).toHaveBeenNthCalledWith(2, expect.objectContaining({
		calendarId: 'fresh-calendar-id'
	}));
	expect(result).toEqual({ synced: true, eventId: 'new-event-id' });
	expect(await getSetting('google.calendarId')).toBe('fresh-calendar-id');
	expect((await getOrderById(order.id)).googleEventId).toBe('new-event-id');
});
