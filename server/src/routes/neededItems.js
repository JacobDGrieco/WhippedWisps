import express from 'express';
import { createNeededItem, deleteNeededItem, listNeededItems, updateNeededItem } from '../db/neededItems.js';
import { getOrderById } from '../db/orders.js';
import { badRequest } from '../middleware/errorHandler.js';

const router = express.Router({ mergeParams: true });

router.get('/', (req, res) => {
	res.json(listNeededItems(req.params.orderId));
});

router.post('/', (req, res, next) => {
	if (!getOrderById(req.params.orderId)) {
		res.status(404).json({ message: 'Order not found.' });
		return;
	}

	if (!req.body.label?.trim()) {
		next(badRequest('Item label is required.'));
		return;
	}

	res.status(201).json(createNeededItem(req.params.orderId, req.body));
});

router.patch('/:itemId', (req, res) => {
	const item = updateNeededItem(req.params.itemId, req.body);
	if (!item) {
		res.status(404).json({ message: 'Needed item not found.' });
		return;
	}

	res.json(item);
});

router.delete('/:itemId', (req, res) => {
	if (!deleteNeededItem(req.params.itemId)) {
		res.status(404).json({ message: 'Needed item not found.' });
		return;
	}

	res.json({ deleted: true });
});

export default router;
