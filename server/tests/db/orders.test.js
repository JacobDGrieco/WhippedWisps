import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, expect, test } from 'vitest';
import { closeDb, getDb } from '../../src/db/connection.js';
import {
	archiveOrder,
	createOrder,
	deleteOrder,
	getOrderById,
	listThemes,
	listOrders,
	searchArchivedOrders,
	updateOrder
} from '../../src/db/orders.js';
import { listOrderItems } from '../../src/db/orderItems.js';
import { listTags, setTagsForOrder } from '../../src/db/tags.js';

const TEST_DB = path.resolve('./server/tests/tmp/test-orders.db');

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

test('createOrder generates a slug and defaults status to scheduled', async () => {
	const order = await createOrder({
		customerName: 'Jane Doe',
		theme: 'Dinosaur Jungle',
		dueDate: '2026-09-01'
	});

	expect(order.slug).toBe('dinosaur-jungle-jane-doe');
	expect(order.status).toBe('scheduled');
	expect(order.reminderOffsets).toEqual([2880]);
});

test('createOrder deduplicates slugs across orders', async () => {
	await createOrder({ customerName: 'Jane Doe', theme: 'Dinosaur Jungle', dueDate: '2026-09-01' });
	const second = await createOrder({ customerName: 'Jane Doe', theme: 'Dinosaur Jungle', dueDate: '2026-09-02' });

	expect(second.slug).toBe('dinosaur-jungle-jane-doe-2');
});

test('listOrders filters by status', async () => {
	const archived = await createOrder({ customerName: 'A', theme: 'X', dueDate: '2026-09-01' });
	await archiveOrder(archived.id);
	await createOrder({ customerName: 'B', theme: 'Y', dueDate: '2026-09-02' });

	expect(await listOrders({ status: 'archived' })).toHaveLength(1);
	expect(await listOrders({ status: 'scheduled' })).toHaveLength(1);
});

test('updateOrder updates fields and returns the updated order', async () => {
	const created = await createOrder({ customerName: 'Jane', theme: 'X', dueDate: '2026-09-01' });
	const updated = await updateOrder(created.id, { price: 120.5, notes: 'extra sprinkles' });

	expect(updated.price).toBe(120.5);
	expect(updated.notes).toBe('extra sprinkles');
});

test('createOrder stores multiple order items', async () => {
	const created = await createOrder({
		customerName: 'Jane',
		theme: 'Party Box',
		dueDate: '2026-09-01',
		orderItems: [
			{ type: 'cake', theme: 'floral', dimensions: '8 inch', servings: '12', flavors: 'vanilla', price: 80 },
			{ type: 'cupcakes', theme: 'sprinkles', count: 24, flavors: 'chocolate', price: 60 }
		]
	});

	expect(await listOrderItems(created.id)).toMatchObject([
		{ type: 'cake', theme: 'floral', dimensions: '8 inch', servings: '12', flavors: 'vanilla', price: 80 },
		{ type: 'cupcakes', theme: 'sprinkles', dimensions: null, servings: null, count: 24, flavors: 'chocolate', price: 60 }
	]);
});

test('listThemes returns a distinct pool from order and item themes', async () => {
	await createOrder({
		customerName: 'Jane',
		theme: 'Dinosaur Jungle',
		dueDate: '2026-09-01',
		orderItems: [
			{ type: 'cake', theme: 'dinosaur jungle', flavors: 'vanilla' },
			{ type: 'cupcakes', theme: 'Leaf Toppers', flavors: 'chocolate' }
		]
	});
	await createOrder({ customerName: 'Sam', theme: 'Space Race', dueDate: '2026-09-02' });

	expect(await listThemes()).toEqual(['Dinosaur Jungle', 'Leaf Toppers', 'Space Race']);
});

test('createOrder stores tiered cake details and custom other notes', async () => {
	const created = await createOrder({
		customerName: 'Jane',
		theme: 'Mixed Order',
		dueDate: '2026-09-01',
		orderItems: [
			{
				type: 'tiered cake',
				theme: 'garden',
				dimensions: '6 inch and 8 inch',
				servings: '32',
				flavors: 'vanilla and lemon',
				tierCount: 2,
				tierDetails: [
					{ dimensions: '6 inch', flavors: 'lemon' },
					{ dimensions: '8 inch', flavors: 'vanilla' }
				],
				price: 180
			},
			{ type: 'other', notes: 'custom topper', flavors: 'ignored', price: 20 }
		]
	});

	expect(await listOrderItems(created.id)).toMatchObject([
		{
			type: 'tiered cake',
			theme: 'garden',
			dimensions: null,
			flavors: null,
			tierCount: 2,
			tierDetails: [
				{ dimensions: '6 inch', flavors: 'lemon' },
				{ dimensions: '8 inch', flavors: 'vanilla' }
			]
		},
		{ type: 'other', theme: null, notes: 'custom topper', flavors: null, price: 20 }
	]);
});

test('updateOrder replaces order items', async () => {
	const created = await createOrder({
		customerName: 'Jane',
		theme: 'Party Box',
		dueDate: '2026-09-01',
		orderItems: [{ type: 'cake', flavors: 'vanilla' }]
	});

	await updateOrder(created.id, {
		orderItems: [
			{ type: 'cake pops', count: 30, flavors: 'strawberry', price: 45 },
			{ type: 'cookies', count: 18, flavors: 'sugar cookie', price: 36 }
		]
	});

	expect((await listOrderItems(created.id)).map((item) => item.type)).toEqual(['cake pops', 'cookies']);
});

test('deleteOrder removes the row and returns true once', async () => {
	const created = await createOrder({ customerName: 'Jane', theme: 'X', dueDate: '2026-09-01' });

	expect(await deleteOrder(created.id)).toBe(true);
	expect(await getOrderById(created.id)).toBeUndefined();
	expect(await deleteOrder(created.id)).toBe(false);
});

test('searchArchivedOrders matches text fields and tags', async () => {
	const first = await createOrder({
		customerName: 'Jane Doe',
		theme: 'Dinosaur Jungle',
		dueDate: '2026-09-01',
		flavors: 'chocolate'
	});
	await archiveOrder(first.id);
	await setTagsForOrder(first.id, ['fondant']);

	const second = await createOrder({
		customerName: 'Sam Lee',
		theme: 'Space Race',
		dueDate: '2026-09-02',
		orderItems: [{ type: 'cupcakes', flavors: 'vanilla' }]
	});
	await archiveOrder(second.id);

	expect((await searchArchivedOrders('dinosaur')).map((order) => order.id)).toEqual([first.id]);
	expect((await searchArchivedOrders('chocolate')).map((order) => order.id)).toEqual([first.id]);
	expect((await searchArchivedOrders('fondant')).map((order) => order.id)).toEqual([first.id]);
	expect((await searchArchivedOrders('cupcakes')).map((order) => order.id)).toEqual([second.id]);
	expect((await searchArchivedOrders('sam')).map((order) => order.id)).toEqual([second.id]);
});

test('setTagsForOrder reuses existing tag casing', async () => {
	const first = await createOrder({ customerName: 'Jane', theme: 'X', dueDate: '2026-09-01' });
	const second = await createOrder({ customerName: 'Sam', theme: 'Y', dueDate: '2026-09-02' });

	expect(await setTagsForOrder(first.id, ['birthday'])).toEqual(['birthday']);
	expect(await setTagsForOrder(second.id, [' Birthday '])).toEqual(['birthday']);
	expect(await listTags()).toEqual(expect.arrayContaining(['birthday']));
	expect((await listTags()).filter((tag) => tag.toLowerCase() === 'birthday')).toHaveLength(1);
});
