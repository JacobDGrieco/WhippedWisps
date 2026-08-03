import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, expect, test } from 'vitest';
import { closeDb, getDb } from '../../src/db/connection.js';
import {
	archiveOrder,
	createOrder,
	deleteOrder,
	getOrderById,
	listOrders,
	searchArchivedOrders,
	updateOrder
} from '../../src/db/orders.js';
import { listOrderItems } from '../../src/db/orderItems.js';
import { listTags, setTagsForOrder } from '../../src/db/tags.js';

const TEST_DB = path.resolve('./server/tests/tmp/test-orders.db');

beforeEach(() => {
	closeDb();
	fs.rmSync(TEST_DB, { force: true });
	process.env.DB_PATH = TEST_DB;
	getDb();
});

test('createOrder generates a slug and defaults status to scheduled', () => {
	const order = createOrder({
		customerName: 'Jane Doe',
		theme: 'Dinosaur Jungle',
		dueDate: '2026-09-01'
	});

	expect(order.slug).toBe('dinosaur-jungle-jane-doe');
	expect(order.status).toBe('scheduled');
	expect(order.reminderOffsets).toEqual([2880]);
});

test('createOrder deduplicates slugs across orders', () => {
	createOrder({ customerName: 'Jane Doe', theme: 'Dinosaur Jungle', dueDate: '2026-09-01' });
	const second = createOrder({ customerName: 'Jane Doe', theme: 'Dinosaur Jungle', dueDate: '2026-09-02' });

	expect(second.slug).toBe('dinosaur-jungle-jane-doe-2');
});

test('listOrders filters by status', () => {
	const archived = createOrder({ customerName: 'A', theme: 'X', dueDate: '2026-09-01' });
	archiveOrder(archived.id);
	createOrder({ customerName: 'B', theme: 'Y', dueDate: '2026-09-02' });

	expect(listOrders({ status: 'archived' })).toHaveLength(1);
	expect(listOrders({ status: 'scheduled' })).toHaveLength(1);
});

test('updateOrder updates fields and returns the updated order', () => {
	const created = createOrder({ customerName: 'Jane', theme: 'X', dueDate: '2026-09-01' });
	const updated = updateOrder(created.id, { price: 120.5, notes: 'extra sprinkles' });

	expect(updated.price).toBe(120.5);
	expect(updated.notes).toBe('extra sprinkles');
});

test('createOrder stores multiple order items', () => {
	const created = createOrder({
		customerName: 'Jane',
		theme: 'Party Box',
		dueDate: '2026-09-01',
		orderItems: [
			{ type: 'cake', theme: 'floral', dimensions: '8 inch', servings: '12', flavors: 'vanilla', price: 80 },
			{ type: 'cupcakes', theme: 'sprinkles', count: 24, flavors: 'chocolate', price: 60 }
		]
	});

	expect(listOrderItems(created.id)).toMatchObject([
		{ type: 'cake', theme: 'floral', dimensions: '8 inch', servings: '12', flavors: 'vanilla', price: 80 },
		{ type: 'cupcakes', theme: 'sprinkles', dimensions: null, servings: null, count: 24, flavors: 'chocolate', price: 60 }
	]);
});

test('createOrder stores tiered cake details and custom other notes', () => {
	const created = createOrder({
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

	expect(listOrderItems(created.id)).toMatchObject([
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

test('updateOrder replaces order items', () => {
	const created = createOrder({
		customerName: 'Jane',
		theme: 'Party Box',
		dueDate: '2026-09-01',
		orderItems: [{ type: 'cake', flavors: 'vanilla' }]
	});

	updateOrder(created.id, {
		orderItems: [
			{ type: 'cake pops', count: 30, flavors: 'strawberry', price: 45 },
			{ type: 'cookies', count: 18, flavors: 'sugar cookie', price: 36 }
		]
	});

	expect(listOrderItems(created.id).map((item) => item.type)).toEqual(['cake pops', 'cookies']);
});

test('deleteOrder removes the row and returns true once', () => {
	const created = createOrder({ customerName: 'Jane', theme: 'X', dueDate: '2026-09-01' });

	expect(deleteOrder(created.id)).toBe(true);
	expect(getOrderById(created.id)).toBeUndefined();
	expect(deleteOrder(created.id)).toBe(false);
});

test('searchArchivedOrders matches text fields and tags', () => {
	const first = createOrder({
		customerName: 'Jane Doe',
		theme: 'Dinosaur Jungle',
		dueDate: '2026-09-01',
		flavors: 'chocolate'
	});
	archiveOrder(first.id);
	setTagsForOrder(first.id, ['fondant']);

	const second = createOrder({
		customerName: 'Sam Lee',
		theme: 'Space Race',
		dueDate: '2026-09-02',
		orderItems: [{ type: 'cupcakes', flavors: 'vanilla' }]
	});
	archiveOrder(second.id);

	expect(searchArchivedOrders('dinosaur').map((order) => order.id)).toEqual([first.id]);
	expect(searchArchivedOrders('chocolate').map((order) => order.id)).toEqual([first.id]);
	expect(searchArchivedOrders('fondant').map((order) => order.id)).toEqual([first.id]);
	expect(searchArchivedOrders('cupcakes').map((order) => order.id)).toEqual([second.id]);
	expect(searchArchivedOrders('sam').map((order) => order.id)).toEqual([second.id]);
});

test('setTagsForOrder reuses existing tag casing', () => {
	const first = createOrder({ customerName: 'Jane', theme: 'X', dueDate: '2026-09-01' });
	const second = createOrder({ customerName: 'Sam', theme: 'Y', dueDate: '2026-09-02' });

	expect(setTagsForOrder(first.id, ['birthday'])).toEqual(['birthday']);
	expect(setTagsForOrder(second.id, [' Birthday '])).toEqual(['birthday']);
	expect(listTags()).toEqual(expect.arrayContaining(['birthday']));
	expect(listTags().filter((tag) => tag.toLowerCase() === 'birthday')).toHaveLength(1);
});
