import { google } from 'googleapis';
import { deleteSetting, getSetting, setSetting } from '../db/settings.js';
import { clearOrderGoogleEventIds, setOrderGoogleEventId } from '../db/orders.js';

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

export function disconnectCalendarAccount() {
	const hadRefreshToken = deleteSetting(TOKEN_KEY);
	deleteSetting(CALENDAR_ID_KEY);
	const clearedEventCount = clearOrderGoogleEventIds();

	return {
		disconnected: hadRefreshToken,
		clearedEventCount
	};
}

function isGoogleNotFoundError(error) {
	return error?.code === 404 || error?.status === 404 || error?.response?.status === 404;
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

function titleCase(value) {
	return String(value || '')
		.trim()
		.replace(/\s+/g, ' ')
		.split(' ')
		.map((word) => (word ? `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}` : word))
		.join(' ');
}

function formatServings(servings) {
	if (!servings) {
		return null;
	}

	return /servings?/i.test(servings) ? servings : `${servings} servings`;
}

function formatTheme(theme) {
	return theme ? `Theme: ${titleCase(theme)}` : null;
}

function formatBasicOrderItem(item) {
	return [
		titleCase(item.type || 'Item'),
		item.flavors ? titleCase(item.flavors) : null,
		item.dimensions,
		formatServings(item.servings),
		item.count || item.count === 0 ? `${item.count} count` : null,
		formatTheme(item.theme),
		item.notes ? `Notes: ${item.notes}` : null
	].filter(Boolean).join(', ');
}

function formatTierDetails(tier) {
	return [
		tier.flavors ? titleCase(tier.flavors) : null,
		tier.dimensions
	].filter(Boolean).join(', ');
}

function formatTieredOrderItem(item) {
	const tierDetails = Array.isArray(item.tierDetails) ? item.tierDetails : [];
	const tierCount = item.tierCount || tierDetails.length;
	const summary = [
		titleCase(item.type || 'Tiered Cake'),
		tierCount ? `${tierCount} ${tierCount === 1 ? 'tier' : 'tiers'}` : null,
		formatServings(item.servings),
		formatTheme(item.theme),
		item.notes ? `Notes: ${item.notes}` : null
	].filter(Boolean).join(', ');
	const tiers = tierDetails
		.map(formatTierDetails)
		.filter(Boolean);

	return [summary, ...tiers.map((tier) => `  - ${tier}`)].join('\n');
}

function formatOrderItem(item) {
	if (item.type === 'tiered cake') {
		return formatTieredOrderItem(item);
	}

	return formatBasicOrderItem(item);
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
	const title = `${titleCase(order.theme || 'Cake order')} - ${titleCase(order.customerName)}`;
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

async function getOrdersCalendarId(calendar, { refreshCachedCalendar = false } = {}) {
	if (refreshCachedCalendar) {
		deleteSetting(CALENDAR_ID_KEY);
	}

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

async function insertOrderEvent(calendar, requestBody) {
	const calendarId = await getOrdersCalendarId(calendar);

	try {
		return await calendar.events.insert({
			calendarId,
			requestBody
		});
	} catch (error) {
		if (!isGoogleNotFoundError(error)) {
			throw error;
		}

		const refreshedCalendarId = await getOrdersCalendarId(calendar, { refreshCachedCalendar: true });
		return calendar.events.insert({
			calendarId: refreshedCalendarId,
			requestBody
		});
	}
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
		try {
			await calendar.events.update({
				calendarId,
				eventId: order.googleEventId,
				requestBody
			});
			return { synced: true, eventId: order.googleEventId };
		} catch (error) {
			if (!isGoogleNotFoundError(error)) {
				throw error;
			}
		}
	}

	const created = await insertOrderEvent(calendar, requestBody);
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
