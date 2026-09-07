import { getDb } from './connection.js';

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

function rowToRecipe(row) {
	return row
		? {
			id: row.id,
			name: row.name,
			ingredients: parseIngredients(row.ingredients),
			instructions: row.instructions
		}
		: undefined;
}

export async function listRecipes() {
	const db = await getDb();
	const rows = await db.query('SELECT * FROM recipes ORDER BY lower(name) ASC, id ASC');
	return rows.map(rowToRecipe);
}

export async function getRecipeById(id) {
	const db = await getDb();
	return rowToRecipe(await db.one('SELECT * FROM recipes WHERE id = $1', [id]));
}

export async function createRecipe(data) {
	const db = await getDb();
	const row = await db.one('INSERT INTO recipes (name, ingredients, instructions) VALUES ($1, $2, $3) RETURNING id', [
		data.name,
		serializeIngredients(data.ingredients),
		data.instructions ?? null
	]);

	return getRecipeById(row.id);
}

export async function updateRecipe(id, data) {
	const current = await getRecipeById(id);
	if (!current) {
		return undefined;
	}

	const db = await getDb();
	await db.run('UPDATE recipes SET name = $1, ingredients = $2, instructions = $3 WHERE id = $4', [
		data.name ?? current.name,
		serializeIngredients(data.ingredients ?? current.ingredients),
		data.instructions ?? current.instructions,
		id
	]);

	return getRecipeById(id);
}

export async function deleteRecipe(id) {
	const db = await getDb();
	const result = await db.run('DELETE FROM recipes WHERE id = $1', [id]);
	return result.changes > 0;
}
