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
		item.flavors,
		item.dimensions,
		...(item.tierDetails || []).flatMap((tier) => [
			tier.flavors,
			tier.dimensions
		])
	]));
}

function applyTagsForOrder(orderId, submittedTags) {
	const hydratedOrder = hydrateOrder(getOrderById(orderId));
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

async function trySync(order) {
	try {
		await syncOrderToCalendar(order);
		return {};
	} catch (error) {
		console.error('Calendar sync failed:', error);
		return { error: 'Calendar sync failed. The order was saved locally.' };
	}
}

async function tryDeleteCalendar(order) {
	try {
		await deleteOrderFromCalendar(order);
		return {};
	} catch (error) {
		console.error('Calendar delete failed:', error);
		return { error: 'Calendar delete failed. The order was deleted locally.' };
	}
}

export function hydrateOrder(order) {
	if (!order) {
		return undefined;
	}

	return {
		...order,
		orderItems: listOrderItems(order.id),
		neededItems: listNeededItems(order.id),
		photos: listPhotos(order.id),
		tags: getTagsForOrder(order.id),
		orderRecipes: listOrderRecipes(order.id)
	};
}

router.get('/search', (req, res) => {
	const query = String(req.query.q || '');
	res.json(searchArchivedOrders(query).map(hydrateOrder));
});

router.get('/slug/:slug', (req, res) => {
	const order = hydrateOrder(getOrderBySlug(req.params.slug));
	if (!order) {
		res.status(404).json({ message: 'Order not found.' });
		return;
	}

	res.json(order);
});

router.get('/', (req, res) => {
	res.json(listOrders({ status: req.query.status }).map(hydrateOrder));
});

router.post('/', validateOrderPayload, async (req, res) => {
	const order = createOrder(req.body);
	applyTagsForOrder(order.id, req.body.tags);

	const syncedOrder = hydrateOrder(getOrderById(order.id));
	const calendarResult = await trySync(syncedOrder);
	res.status(201).json(addCalendarWarning(hydrateOrder(getOrderById(order.id)), calendarResult));
});

router.get('/:id', (req, res) => {
	const order = hydrateOrder(getOrderById(req.params.id));
	if (!order) {
		res.status(404).json({ message: 'Order not found.' });
		return;
	}

	res.json(order);
});

router.patch('/:id', validateOrderPayload, async (req, res) => {
	const order = updateOrder(req.params.id, req.body);
	if (!order) {
		res.status(404).json({ message: 'Order not found.' });
		return;
	}

	if (Array.isArray(req.body.tags) || Array.isArray(req.body.orderItems)) {
		applyTagsForOrder(order.id, req.body.tags);
	}

	const calendarResult = await trySync(hydrateOrder(getOrderById(order.id)));
	res.json(addCalendarWarning(hydrateOrder(getOrderById(order.id)), calendarResult));
});

router.post('/:id/archive', async (req, res) => {
	const order = archiveOrder(req.params.id);
	if (!order) {
		res.status(404).json({ message: 'Order not found.' });
		return;
	}

	const hydratedOrder = hydrateOrder(order);
	const calendarResult = await trySync(hydratedOrder);
	res.json(addCalendarWarning(hydratedOrder, calendarResult));
});

router.post('/:id/resync-calendar', async (req, res) => {
	const order = getOrderById(req.params.id);
	if (!order) {
		res.status(404).json({ message: 'Order not found.' });
		return;
	}

	const calendarResult = await trySync(hydrateOrder(order));
	res.json(addCalendarWarning(hydrateOrder(getOrderById(order.id)), calendarResult));
});

router.delete('/:id', async (req, res) => {
	const order = getOrderById(req.params.id);
	if (!order) {
		res.status(404).json({ message: 'Order not found.' });
		return;
	}

	const calendarResult = await tryDeleteCalendar(order);
	deleteOrder(req.params.id);
	res.json(addCalendarWarning({ deleted: true }, calendarResult));
});

export default router;
