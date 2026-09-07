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

export async function listOrderRecipes(orderId) {
	const db = await getDb();
	const rows = await db.query('SELECT * FROM order_recipes WHERE order_id = $1 ORDER BY id ASC', [orderId]);
	return rows.map(rowToOrderRecipe);
}

export async function getOrderRecipeById(id) {
	const db = await getDb();
	return rowToOrderRecipe(await db.one('SELECT * FROM order_recipes WHERE id = $1', [id]));
}

export async function attachRecipeToOrder(orderId, recipeId) {
	const recipe = await getRecipeById(recipeId);
	if (!recipe) {
		return undefined;
	}

	const db = await getDb();
	const row = await db.one(`
		INSERT INTO order_recipes (order_id, recipe_name, ingredients, instructions)
		VALUES ($1, $2, $3, $4)
		RETURNING id
	`, [orderId, recipe.name, serializeIngredients(recipe.ingredients), recipe.instructions ?? null]);

	return getOrderRecipeById(row.id);
}

export async function updateOrderRecipe(id, data) {
	const current = await getOrderRecipeById(id);
	if (!current) {
		return undefined;
	}

	const db = await getDb();
	await db.run('UPDATE order_recipes SET recipe_name = $1, ingredients = $2, instructions = $3 WHERE id = $4', [
		data.recipeName ?? current.recipeName,
		serializeIngredients(data.ingredients ?? current.ingredients),
		data.instructions ?? current.instructions,
		id
	]);

	return getOrderRecipeById(id);
}

export async function deleteOrderRecipe(id) {
	const db = await getDb();
	const result = await db.run('DELETE FROM order_recipes WHERE id = $1', [id]);
	return result.changes > 0;
}
