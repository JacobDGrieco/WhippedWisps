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

export function listRecipes() {
	return getDb()
		.prepare('SELECT * FROM recipes ORDER BY lower(name) ASC, id ASC')
		.all()
		.map(rowToRecipe);
}

export function getRecipeById(id) {
	return rowToRecipe(getDb().prepare('SELECT * FROM recipes WHERE id = ?').get(id));
}

export function createRecipe(data) {
	const result = getDb()
		.prepare('INSERT INTO recipes (name, ingredients, instructions) VALUES (?, ?, ?)')
		.run(data.name, serializeIngredients(data.ingredients), data.instructions ?? null);

	return getRecipeById(result.lastInsertRowid);
}

export function updateRecipe(id, data) {
	const current = getRecipeById(id);
	if (!current) {
		return undefined;
	}

	getDb()
		.prepare('UPDATE recipes SET name = ?, ingredients = ?, instructions = ? WHERE id = ?')
		.run(
			data.name ?? current.name,
			serializeIngredients(data.ingredients ?? current.ingredients),
			data.instructions ?? current.instructions,
			id
		);

	return getRecipeById(id);
}

export function deleteRecipe(id) {
	return getDb().prepare('DELETE FROM recipes WHERE id = ?').run(id).changes > 0;
}
