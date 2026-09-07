import express from 'express';
import { createNeededItem, deleteNeededItem, listNeededItems, updateNeededItem } from '../db/neededItems.js';
import { getOrderById } from '../db/orders.js';
import { badRequest } from '../middleware/errorHandler.js';

const router = express.Router({ mergeParams: true });

function asyncHandler(handler) {
	return (req, res, next) => {
		Promise.resolve(handler(req, res, next)).catch(next);
	};
}

router.get('/', asyncHandler(async (req, res) => {
	res.json(await listNeededItems(req.params.orderId));
}));

router.post('/', asyncHandler(async (req, res, next) => {
	if (!(await getOrderById(req.params.orderId))) {
		res.status(404).json({ message: 'Order not found.' });
		return;
	}

	if (!req.body.label?.trim()) {
		next(badRequest('Item label is required.'));
		return;
	}

	res.status(201).json(await createNeededItem(req.params.orderId, req.body));
}));

router.patch('/:itemId', asyncHandler(async (req, res) => {
	const item = await updateNeededItem(req.params.itemId, req.body);
	if (!item) {
		res.status(404).json({ message: 'Needed item not found.' });
		return;
	}

	res.json(item);
}));

router.delete('/:itemId', asyncHandler(async (req, res) => {
	if (!(await deleteNeededItem(req.params.itemId))) {
		res.status(404).json({ message: 'Needed item not found.' });
		return;
	}

	res.json({ deleted: true });
}));

export default router;
