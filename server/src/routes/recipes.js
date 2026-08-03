import express from 'express';
import { createRecipe, deleteRecipe, getRecipeById, listRecipes, updateRecipe } from '../db/recipes.js';
import { badRequest } from '../middleware/errorHandler.js';

const router = express.Router();

router.get('/', (req, res) => {
	res.json(listRecipes());
});

router.post('/', (req, res, next) => {
	if (!req.body.name?.trim()) {
		next(badRequest('Recipe name is required.'));
		return;
	}

	res.status(201).json(createRecipe(req.body));
});

router.get('/:recipeId', (req, res) => {
	const recipe = getRecipeById(req.params.recipeId);
	if (!recipe) {
		res.status(404).json({ message: 'Recipe not found.' });
		return;
	}

	res.json(recipe);
});

router.patch('/:recipeId', (req, res) => {
	const recipe = updateRecipe(req.params.recipeId, req.body);
	if (!recipe) {
		res.status(404).json({ message: 'Recipe not found.' });
		return;
	}

	res.json(recipe);
});

router.delete('/:recipeId', (req, res) => {
	if (!deleteRecipe(req.params.recipeId)) {
		res.status(404).json({ message: 'Recipe not found.' });
		return;
	}

	res.json({ deleted: true });
});

export default router;
