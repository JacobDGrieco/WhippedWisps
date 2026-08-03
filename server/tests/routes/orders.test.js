import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { beforeEach, expect, test } from 'vitest';
import { closeDb } from '../../src/db/connection.js';
import { createApp } from '../../src/app.js';

const TEST_DB = path.resolve('./server/tests/tmp/test-order-routes.db');
let app;

beforeEach(() => {
	closeDb();
	fs.rmSync(TEST_DB, { force: true });
	process.env.DB_PATH = TEST_DB;
	delete process.env.GOOGLE_CLIENT_ID;
	delete process.env.GOOGLE_CLIENT_SECRET;
	delete process.env.GOOGLE_REDIRECT_URI;
	app = createApp();
});

test('order API creates, reads, updates, archives, and searches an order', async () => {
	const created = await request(app)
		.post('/api/orders')
		.send({
			customerName: 'Jane Doe',
			theme: 'Dinosaur Jungle',
			dueDate: '2026-09-01',
			orderItems: [
				{ type: 'cake', theme: 'jungle', dimensions: '8 inch', servings: '12', flavors: 'Vanilla', price: 90 },
				{ type: 'cupcakes', theme: 'leaf toppers', count: 24, flavors: 'Chocolate', price: 60 }
			],
			tags: ['birthday']
	})
	.expect(201);

	expect(created.body.slug).toBe('dinosaur-jungle-jane-doe');
	expect(created.body.tags).toEqual(expect.arrayContaining(['Birthday', 'Cake', 'Vanilla', '8 Inch', 'Cupcakes', 'Chocolate']));
	expect(created.body.orderItems).toHaveLength(2);

	const tags = await request(app).get('/api/tags').expect(200);
	expect(tags.body).toEqual(expect.arrayContaining(['Birthday', 'Cake', 'Vanilla', '8 Inch', 'Cupcakes', 'Chocolate']));

	const updated = await request(app)
		.patch(`/api/orders/${created.body.id}`)
		.send({
			orderItems: [
				{ type: 'cake pops', theme: 'dinosaur eggs', count: 36, flavors: 'Red velvet', price: 72 }
			]
		})
		.expect(200);
	expect(updated.body.orderItems).toMatchObject([{ type: 'cake pops', theme: 'dinosaur eggs', count: 36, flavors: 'Red velvet', price: 72 }]);
	expect(updated.body.tags).toEqual(expect.arrayContaining(['Cake Pops', 'Red Velvet']));

	await request(app).post(`/api/orders/${created.body.id}/archive`).expect(200);
	const search = await request(app).get('/api/orders/search?q=birthday').expect(200);
	expect(search.body.map((order) => order.id)).toEqual([created.body.id]);
});
