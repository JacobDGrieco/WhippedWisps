import express from 'express';
import { getTagsForOrder, listTags, setTagsForOrder } from '../db/tags.js';
import { getOrderById } from '../db/orders.js';

const router = express.Router({ mergeParams: true });

router.get('/all', (req, res) => {
	res.json(listTags());
});

router.get('/', (req, res) => {
	res.json(getTagsForOrder(req.params.orderId));
});

router.put('/', (req, res) => {
	if (!getOrderById(req.params.orderId)) {
		res.status(404).json({ message: 'Order not found.' });
		return;
	}

	res.json(setTagsForOrder(req.params.orderId, req.body.tags || []));
});

export default router;
