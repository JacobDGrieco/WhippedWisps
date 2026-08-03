import { google } from 'googleapis';
import { getSetting, setSetting } from '../db/settings.js';
import { setOrderGoogleEventId } from '../db/orders.js';

const TOKEN_KEY = 'google.refreshToken';
const CALENDAR_ID_KEY = 'google.calendarId';
const DEFAULT_REMINDER_OFFSETS = [2880];

function hasGoogleConfig() {
	return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
}

export function getOAuthClient() {
	if (!hasGoogleConfig()) {
		return null;
	}

	const client = new google.auth.OAuth2(
		process.env.GOOGLE_CLIENT_ID,
		process.env.GOOGLE_CLIENT_SECRET,
		process.env.GOOGLE_REDIRECT_URI
	);
	const refreshToken = getSetting(TOKEN_KEY);
	if (refreshToken) {
		client.setCredentials({ refresh_token: refreshToken });
	}

	return client;
}

export function getCalendarAuthUrl() {
	const client = getOAuthClient();
	if (!client) {
		const error = new Error('Google Calendar is not configured on the server.');
		error.status = 400;
		throw error;
	}

	return client.generateAuthUrl({
		access_type: 'offline',
		prompt: 'consent',
		scope: ['https://www.googleapis.com/auth/calendar']
	});
}

export async function storeCalendarCode(code) {
	const client = getOAuthClient();
	if (!client) {
		const error = new Error('Google Calendar is not configured on the server.');
		error.status = 400;
		throw error;
	}

	const { tokens } = await client.getToken(code);
	if (tokens.refresh_token) {
		setSetting(TOKEN_KEY, tokens.refresh_token);
	}

	return tokens;
}

export function isCalendarConnected() {
	return Boolean(hasGoogleConfig() && getSetting(TOKEN_KEY));
}

function formatTime(date, time) {
	if (!time) {
		return { date };
	}

	const normalizedTime = time.length === 5 ? `${time}:00` : time;
	return {
		dateTime: `${date}T${normalizedTime}`,
		timeZone: process.env.TIME_ZONE || 'America/New_York'
	};
}

function formatOrderItem(item) {
	const tierDetails = Array.isArray(item.tierDetails) ? item.tierDetails : [];
	const details = [
		item.theme ? `theme ${item.theme}` : null,
		item.dimensions ? `dimensions ${item.dimensions}` : null,
		item.servings ? `${item.servings} servings` : null,
		item.count || item.count === 0 ? `count ${item.count}` : null,
		item.flavors ? `flavors ${item.flavors}` : null,
		item.notes ? `notes ${item.notes}` : null,
		item.price || item.price === 0 ? `$${Number(item.price).toFixed(2)}` : null
	].filter(Boolean);
	const label = item.type || 'Item';
	const tiers = tierDetails
		.map((tier, index) => {
			const tierParts = [
				tier.dimensions ? `dimensions ${tier.dimensions}` : null,
				tier.flavors ? `flavors ${tier.flavors}` : null
			].filter(Boolean);

			return tierParts.length ? `tier ${index + 1} ${tierParts.join(', ')}` : null;
		})
		.filter(Boolean);
	const allDetails = [...details, ...tiers];

	return allDetails.length ? `${label}: ${allDetails.join(', ')}` : label;
}

function formatOrderItems(order) {
	if (Array.isArray(order.orderItems) && order.orderItems.length) {
		return ['Items:', ...order.orderItems.map((item) => `- ${formatOrderItem(item)}`)].join('\n');
	}

	const legacyDetails = [
		order.dimensions ? `Dimensions: ${order.dimensions}` : null,
		order.servings ? `Servings: ${order.servings}` : null,
		order.flavors ? `Flavors: ${order.flavors}` : null
	].filter(Boolean);

	return legacyDetails.length ? legacyDetails.join('\n') : null;
}

function buildDescription(order) {
	const lines = [
		order.description,
		order.customerContact ? `Contact: ${order.customerContact}` : null,
		order.deliveryType === 'delivery' ? `Delivery: ${order.deliveryAddress || 'address needed'}` : 'Pickup',
		order.deliveryWindowStart || order.deliveryWindowEnd
			? `Window: ${order.deliveryWindowStart || '?'} - ${order.deliveryWindowEnd || '?'}`
			: null,
		formatOrderItems(order),
		order.notes ? `Notes: ${order.notes}` : null
	].filter(Boolean);

	return lines.join('\n');
}

export function buildCalendarEventPayload(order) {
	const title = `${order.theme || 'Cake order'} - ${order.customerName}`;
	const due = formatTime(order.dueDate, order.dueTime);

	return {
		summary: title,
		description: buildDescription(order),
		start: due,
		end: due,
		reminders: {
			useDefault: false,
			overrides: (order.reminderOffsets || DEFAULT_REMINDER_OFFSETS).map((minutes) => ({
				method: 'popup',
				minutes: Number(minutes)
			}))
		}
	};
}

async function getOrdersCalendarId(calendar) {
	const existingCalendarId = getSetting(CALENDAR_ID_KEY);
	if (existingCalendarId) {
		return existingCalendarId;
	}

	const calendarName = process.env.CALENDAR_NAME || 'Whipped Wisps Orders';
	const list = await calendar.calendarList.list();
	const match = list.data.items?.find((item) => item.summary === calendarName);
	if (match?.id) {
		setSetting(CALENDAR_ID_KEY, match.id);
		return match.id;
	}

	const created = await calendar.calendars.insert({
		requestBody: {
			summary: calendarName,
			timeZone: process.env.TIME_ZONE || 'America/New_York'
		}
	});
	setSetting(CALENDAR_ID_KEY, created.data.id);
	return created.data.id;
}

export async function syncOrderToCalendar(order) {
	if (!isCalendarConnected()) {
		return { skipped: true };
	}

	const auth = getOAuthClient();
	const calendar = google.calendar({ version: 'v3', auth });
	const calendarId = await getOrdersCalendarId(calendar);
	const requestBody = buildCalendarEventPayload(order);

	if (order.googleEventId) {
		await calendar.events.update({
			calendarId,
			eventId: order.googleEventId,
			requestBody
		});
		return { synced: true, eventId: order.googleEventId };
	}

	const created = await calendar.events.insert({
		calendarId,
		requestBody
	});
	const eventId = created.data.id;
	if (eventId) {
		setOrderGoogleEventId(order.id, eventId);
	}

	return { synced: true, eventId };
}

export async function deleteOrderFromCalendar(order) {
	if (!order?.googleEventId || !isCalendarConnected()) {
		return { skipped: true };
	}

	const auth = getOAuthClient();
	const calendar = google.calendar({ version: 'v3', auth });
	const calendarId = await getOrdersCalendarId(calendar);
	await calendar.events.delete({ calendarId, eventId: order.googleEventId });

	return { deleted: true };
}
