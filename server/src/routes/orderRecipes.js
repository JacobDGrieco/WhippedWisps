import express from 'express';
import {
	attachRecipeToOrder,
	deleteOrderRecipe,
	listOrderRecipes,
	updateOrderRecipe
} from '../db/orderRecipes.js';
import { getOrderById } from '../db/orders.js';

const router = express.Router({ mergeParams: true });

function asyncHandler(handler) {
	return (req, res, next) => {
		Promise.resolve(handler(req, res, next)).catch(next);
	};
}

router.get('/', asyncHandler(async (req, res) => {
	res.json(await listOrderRecipes(req.params.orderId));
}));

router.post('/', asyncHandler(async (req, res) => {
	if (!(await getOrderById(req.params.orderId))) {
		res.status(404).json({ message: 'Order not found.' });
		return;
	}

	const orderRecipe = await attachRecipeToOrder(req.params.orderId, req.body.recipeId);
	if (!orderRecipe) {
		res.status(404).json({ message: 'Recipe not found.' });
		return;
	}

	res.status(201).json(orderRecipe);
}));

router.patch('/:orderRecipeId', asyncHandler(async (req, res) => {
	const orderRecipe = await updateOrderRecipe(req.params.orderRecipeId, req.body);
	if (!orderRecipe) {
		res.status(404).json({ message: 'Order recipe not found.' });
		return;
	}

	res.json(orderRecipe);
}));

router.delete('/:orderRecipeId', asyncHandler(async (req, res) => {
	if (!(await deleteOrderRecipe(req.params.orderRecipeId))) {
		res.status(404).json({ message: 'Order recipe not found.' });
		return;
	}

	res.json({ deleted: true });
}));

export default router;
