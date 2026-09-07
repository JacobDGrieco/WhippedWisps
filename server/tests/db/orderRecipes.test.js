import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, expect, test } from 'vitest';
import { closeDb, getDb } from '../../src/db/connection.js';
import { createOrder } from '../../src/db/orders.js';
import { attachRecipeToOrder, updateOrderRecipe } from '../../src/db/orderRecipes.js';
import { createRecipe, getRecipeById, updateRecipe } from '../../src/db/recipes.js';

const TEST_DB = path.resolve('./server/tests/tmp/test-order-recipes.db');

beforeEach(async () => {
	await closeDb();
	fs.rmSync(TEST_DB, { force: true });
	process.env.DB_PATH = TEST_DB;
	delete process.env.DATABASE_URL;
	delete process.env.POSTGRES_URL;
	delete process.env.POSTGRES_PRISMA_URL;
	delete process.env.POSTGRES_URL_NON_POOLING;
	await getDb();
});

test('attaching a recipe copies a snapshot that is independent of the template', async () => {
	const order = await createOrder({ customerName: 'Jane', theme: 'Vanilla', dueDate: '2026-09-01' });
	const template = await createRecipe({
		name: 'Vanilla Sponge',
		ingredients: [{ item: 'Flour', quantity: '2', unit: 'cups' }],
		instructions: 'Mix.'
	});

	const attached = await attachRecipeToOrder(order.id, template.id);
	await updateRecipe(template.id, { name: 'Updated Template', instructions: 'Template changed.' });
	const editedSnapshot = await updateOrderRecipe(attached.id, { instructions: 'Order changed.' });

	expect(editedSnapshot.recipeName).toBe('Vanilla Sponge');
	expect(editedSnapshot.instructions).toBe('Order changed.');
	expect((await getRecipeById(template.id)).instructions).toBe('Template changed.');
});
