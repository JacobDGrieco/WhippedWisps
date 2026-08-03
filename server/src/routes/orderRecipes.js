import express from 'express';
import {
	attachRecipeToOrder,
	deleteOrderRecipe,
	listOrderRecipes,
	updateOrderRecipe
} from '../db/orderRecipes.js';
import { getOrderById } from '../db/orders.js';

const router = express.Router({ mergeParams: true });

router.get('/', (req, res) => {
	res.json(listOrderRecipes(req.params.orderId));
});

router.post('/', (req, res) => {
	if (!getOrderById(req.params.orderId)) {
		res.status(404).json({ message: 'Order not found.' });
		return;
	}

	const orderRecipe = attachRecipeToOrder(req.params.orderId, req.body.recipeId);
	if (!orderRecipe) {
		res.status(404).json({ message: 'Recipe not found.' });
		return;
	}

	res.status(201).json(orderRecipe);
});

router.patch('/:orderRecipeId', (req, res) => {
	const orderRecipe = updateOrderRecipe(req.params.orderRecipeId, req.body);
	if (!orderRecipe) {
		res.status(404).json({ message: 'Order recipe not found.' });
		return;
	}

	res.json(orderRecipe);
});

router.delete('/:orderRecipeId', (req, res) => {
	if (!deleteOrderRecipe(req.params.orderRecipeId)) {
		res.status(404).json({ message: 'Order recipe not found.' });
		return;
	}

	res.json({ deleted: true });
});

export default router;
