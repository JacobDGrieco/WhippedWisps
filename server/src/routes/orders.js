import express from 'express';
import {
	archiveOrder,
	createOrder,
	deleteOrder,
	getOrderById,
	getOrderBySlug,
	listOrders,
	searchArchivedOrders,
	updateOrder
} from '../db/orders.js';
import { listNeededItems } from '../db/neededItems.js';
import { listOrderItems } from '../db/orderItems.js';
import { listPhotos } from '../db/photos.js';
import { getTagsForOrder, setTagsForOrder } from '../db/tags.js';
import { listOrderRecipes } from '../db/orderRecipes.js';
import { badRequest } from '../middleware/errorHandler.js';
import { deleteOrderFromCalendar, syncOrderToCalendar } from '../services/calendar.js';

const router = express.Router();

function titleCaseTag(value) {
	return String(value || '')
		.trim()
		.replace(/\s+/g, ' ')
		.split(' ')
		.map((word) => (word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word))
		.join(' ');
}

function mergeTagNames(...tagGroups) {
	const seen = new Set();
	return tagGroups
		.flat()
		.map(titleCaseTag)
		.filter(Boolean)
		.filter((tag) => {
			const key = tag.toLowerCase();
			if (seen.has(key)) {
				return false;
			}

			seen.add(key);
			return true;
		});
}

function getAutomaticOrderTags(order) {
	return mergeTagNames((order.orderItems || []).flatMap((item) => [
		item.type,
		item.theme,
		item.flavors,
		item.dimensions,
		...(item.tierDetails || []).flatMap((tier) => [
			tier.flavors,
			tier.dimensions
		])
	]));
}

async function applyTagsForOrder(orderId, submittedTags) {
	const hydratedOrder = await hydrateOrder(await getOrderById(orderId));
	const baseTags = Array.isArray(submittedTags) ? submittedTags : hydratedOrder.tags;
	return setTagsForOrder(orderId, mergeTagNames(baseTags, getAutomaticOrderTags(hydratedOrder)));
}

function validateOrderPayload(req, res, next) {
	if (req.method === 'POST' && !req.body.customerName?.trim()) {
		next(badRequest('Customer name is required.'));
		return;
	}

	if (req.method === 'POST' && !req.body.dueDate) {
		next(badRequest('Due date is required.'));
		return;
	}

	next();
}

function addCalendarWarning(payload, calendarResult) {
	if (calendarResult?.error) {
		return { ...payload, calendarSyncError: calendarResult.error };
	}

	return payload;
}

function getCalendarErrorSummary(error) {
	const status = error?.status || error?.code || error?.response?.status;
	const message = error?.errors?.[0]?.message || error?.response?.data?.error?.message || error?.message;
	return [status ? `status ${status}` : null, message].filter(Boolean).join(': ') || 'Unknown Calendar API error';
}

function asyncHandler(handler) {
	return (req, res, next) => {
		Promise.resolve(handler(req, res, next)).catch(next);
	};
}

async function trySync(order) {
	try {
		await syncOrderToCalendar(order);
		return {};
	} catch (error) {
		console.error(`Calendar sync failed: ${getCalendarErrorSummary(error)}`);
		return { error: 'Calendar sync failed. The order was saved locally.' };
	}
}

async function tryDeleteCalendar(order) {
	try {
		await deleteOrderFromCalendar(order);
		return {};
	} catch (error) {
		console.error(`Calendar delete failed: ${getCalendarErrorSummary(error)}`);
		return { error: 'Calendar delete failed. The order was deleted locally.' };
	}
}

export async function hydrateOrder(order) {
	if (!order) {
		return undefined;
	}

	const [orderItems, neededItems, photos, tags, orderRecipes] = await Promise.all([
		listOrderItems(order.id),
		listNeededItems(order.id),
		listPhotos(order.id),
		getTagsForOrder(order.id),
		listOrderRecipes(order.id)
	]);

	return {
		...order,
		orderItems,
		neededItems,
		photos,
		tags,
		orderRecipes
	};
}

router.get('/search', asyncHandler(async (req, res) => {
	const query = String(req.query.q || '');
	const orders = await searchArchivedOrders(query);
	res.json(await Promise.all(orders.map(hydrateOrder)));
}));

router.get('/slug/:slug', asyncHandler(async (req, res) => {
	const order = await hydrateOrder(await getOrderBySlug(req.params.slug));
	if (!order) {
		res.status(404).json({ message: 'Order not found.' });
		return;
	}

	res.json(order);
}));

router.get('/', asyncHandler(async (req, res) => {
	const orders = await listOrders({ status: req.query.status });
	res.json(await Promise.all(orders.map(hydrateOrder)));
}));

router.post('/', validateOrderPayload, asyncHandler(async (req, res) => {
	const order = await createOrder(req.body);
	await applyTagsForOrder(order.id, req.body.tags);

	const syncedOrder = await hydrateOrder(await getOrderById(order.id));
	const calendarResult = await trySync(syncedOrder);
	res.status(201).json(addCalendarWarning(await hydrateOrder(await getOrderById(order.id)), calendarResult));
}));

router.get('/:id', asyncHandler(async (req, res) => {
	const order = await hydrateOrder(await getOrderById(req.params.id));
	if (!order) {
		res.status(404).json({ message: 'Order not found.' });
		return;
	}

	res.json(order);
}));

router.patch('/:id', validateOrderPayload, asyncHandler(async (req, res) => {
	const order = await updateOrder(req.params.id, req.body);
	if (!order) {
		res.status(404).json({ message: 'Order not found.' });
		return;
	}

	if (Array.isArray(req.body.tags) || Array.isArray(req.body.orderItems)) {
		await applyTagsForOrder(order.id, req.body.tags);
	}

	const calendarResult = await trySync(await hydrateOrder(await getOrderById(order.id)));
	res.json(addCalendarWarning(await hydrateOrder(await getOrderById(order.id)), calendarResult));
}));

router.post('/:id/archive', asyncHandler(async (req, res) => {
	const order = await archiveOrder(req.params.id);
	if (!order) {
		res.status(404).json({ message: 'Order not found.' });
		return;
	}

	const hydratedOrder = await hydrateOrder(order);
	const calendarResult = await trySync(hydratedOrder);
	res.json(addCalendarWarning(hydratedOrder, calendarResult));
}));

router.post('/:id/resync-calendar', asyncHandler(async (req, res) => {
	const order = await getOrderById(req.params.id);
	if (!order) {
		res.status(404).json({ message: 'Order not found.' });
		return;
	}

	const calendarResult = await trySync(await hydrateOrder(order));
	res.json(addCalendarWarning(await hydrateOrder(await getOrderById(order.id)), calendarResult));
}));

router.delete('/:id', asyncHandler(async (req, res) => {
	const order = await getOrderById(req.params.id);
	if (!order) {
		res.status(404).json({ message: 'Order not found.' });
		return;
	}

	const calendarResult = await tryDeleteCalendar(order);
	await deleteOrder(req.params.id);
	res.json(addCalendarWarning({ deleted: true }, calendarResult));
}));

export default router;
