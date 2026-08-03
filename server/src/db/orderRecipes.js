import { getDb } from './connection.js';
import { getRecipeById } from './recipes.js';

function parseIngredients(value) {
	try {
		const parsed = JSON.parse(value || '[]');
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

function serializeIngredients(ingredients) {
	return JSON.stringify(Array.isArray(ingredients) ? ingredients : []);
}

function rowToOrderRecipe(row) {
	return row
		? {
			id: row.id,
			orderId: row.order_id,
			recipeName: row.recipe_name,
			ingredients: parseIngredients(row.ingredients),
			instructions: row.instructions
		}
		: undefined;
}

export function listOrderRecipes(orderId) {
	return getDb()
		.prepare('SELECT * FROM order_recipes WHERE order_id = ? ORDER BY id ASC')
		.all(orderId)
		.map(rowToOrderRecipe);
}

export function getOrderRecipeById(id) {
	return rowToOrderRecipe(getDb().prepare('SELECT * FROM order_recipes WHERE id = ?').get(id));
}

export function attachRecipeToOrder(orderId, recipeId) {
	const recipe = getRecipeById(recipeId);
	if (!recipe) {
		return undefined;
	}

	const result = getDb()
		.prepare(`
			INSERT INTO order_recipes (order_id, recipe_name, ingredients, instructions)
			VALUES (?, ?, ?, ?)
		`)
		.run(orderId, recipe.name, serializeIngredients(recipe.ingredients), recipe.instructions ?? null);

	return getOrderRecipeById(result.lastInsertRowid);
}

export function updateOrderRecipe(id, data) {
	const current = getOrderRecipeById(id);
	if (!current) {
		return undefined;
	}

	getDb()
		.prepare('UPDATE order_recipes SET recipe_name = ?, ingredients = ?, instructions = ? WHERE id = ?')
		.run(
			data.recipeName ?? current.recipeName,
			serializeIngredients(data.ingredients ?? current.ingredients),
			data.instructions ?? current.instructions,
			id
		);

	return getOrderRecipeById(id);
}

export function deleteOrderRecipe(id) {
	return getDb().prepare('DELETE FROM order_recipes WHERE id = ?').run(id).changes > 0;
}
