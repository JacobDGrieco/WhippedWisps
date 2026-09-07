import express from 'express';
import { getTagsForOrder, listTags, setTagsForOrder } from '../db/tags.js';
import { getOrderById } from '../db/orders.js';

const router = express.Router({ mergeParams: true });

function asyncHandler(handler) {
	return (req, res, next) => {
		Promise.resolve(handler(req, res, next)).catch(next);
	};
}

router.get('/all', asyncHandler(async (req, res) => {
	res.json(await listTags());
}));

router.get('/', asyncHandler(async (req, res) => {
	res.json(await getTagsForOrder(req.params.orderId));
}));

router.put('/', asyncHandler(async (req, res) => {
	if (!(await getOrderById(req.params.orderId))) {
		res.status(404).json({ message: 'Order not found.' });
		return;
	}

	res.json(await setTagsForOrder(req.params.orderId, req.body.tags || []));
}));

export default router;
