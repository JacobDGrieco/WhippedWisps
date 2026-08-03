import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, expect, test } from 'vitest';
import { closeDb, getDb } from '../../src/db/connection.js';
import { createOrder } from '../../src/db/orders.js';
import { attachRecipeToOrder, updateOrderRecipe } from '../../src/db/orderRecipes.js';
import { createRecipe, getRecipeById, updateRecipe } from '../../src/db/recipes.js';

const TEST_DB = path.resolve('./server/tests/tmp/test-order-recipes.db');

beforeEach(() => {
	closeDb();
	fs.rmSync(TEST_DB, { force: true });
	process.env.DB_PATH = TEST_DB;
	getDb();
});

test('attaching a recipe copies a snapshot that is independent of the template', () => {
	const order = createOrder({ customerName: 'Jane', theme: 'Vanilla', dueDate: '2026-09-01' });
	const template = createRecipe({
		name: 'Vanilla Sponge',
		ingredients: [{ item: 'Flour', quantity: '2', unit: 'cups' }],
		instructions: 'Mix.'
	});

	const attached = attachRecipeToOrder(order.id, template.id);
	updateRecipe(template.id, { name: 'Updated Template', instructions: 'Template changed.' });
	const editedSnapshot = updateOrderRecipe(attached.id, { instructions: 'Order changed.' });

	expect(editedSnapshot.recipeName).toBe('Vanilla Sponge');
	expect(editedSnapshot.instructions).toBe('Order changed.');
	expect(getRecipeById(template.id).instructions).toBe('Template changed.');
});
