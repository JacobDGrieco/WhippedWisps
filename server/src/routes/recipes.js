import express from 'express';
import { createRecipe, deleteRecipe, getRecipeById, listRecipes, updateRecipe } from '../db/recipes.js';
import { badRequest } from '../middleware/errorHandler.js';

const router = express.Router();

function asyncHandler(handler) {
	return (req, res, next) => {
		Promise.resolve(handler(req, res, next)).catch(next);
	};
}

router.get('/', asyncHandler(async (req, res) => {
	res.json(await listRecipes());
}));

router.post('/', asyncHandler(async (req, res, next) => {
	if (!req.body.name?.trim()) {
		next(badRequest('Recipe name is required.'));
		return;
	}

	res.status(201).json(await createRecipe(req.body));
}));

router.get('/:recipeId', asyncHandler(async (req, res) => {
	const recipe = await getRecipeById(req.params.recipeId);
	if (!recipe) {
		res.status(404).json({ message: 'Recipe not found.' });
		return;
	}

	res.json(recipe);
}));

router.patch('/:recipeId', asyncHandler(async (req, res) => {
	const recipe = await updateRecipe(req.params.recipeId, req.body);
	if (!recipe) {
		res.status(404).json({ message: 'Recipe not found.' });
		return;
	}

	res.json(recipe);
}));

router.delete('/:recipeId', asyncHandler(async (req, res) => {
	if (!(await deleteRecipe(req.params.recipeId))) {
		res.status(404).json({ message: 'Recipe not found.' });
		return;
	}

	res.json({ deleted: true });
}));

export default router;
