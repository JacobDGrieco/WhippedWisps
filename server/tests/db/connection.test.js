import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, expect, test } from 'vitest';
import { closeDb, getDb } from '../../src/db/connection.js';

const TEST_DB = path.resolve('./server/tests/tmp/test-connection.db');

beforeEach(async () => {
	await closeDb();
	fs.rmSync(TEST_DB, { force: true });
	process.env.DB_PATH = TEST_DB;
	delete process.env.DATABASE_URL;
	delete process.env.POSTGRES_URL;
	delete process.env.POSTGRES_PRISMA_URL;
	delete process.env.POSTGRES_URL_NON_POOLING;
});

test('getDb creates the database file and applies schema', async () => {
	const db = await getDb();
	const tables = (await db.query("SELECT name FROM sqlite_master WHERE type = 'table'"))
		.map((row) => row.name);

	expect(fs.existsSync(TEST_DB)).toBe(true);
	expect(tables).toContain('orders');
	expect(tables).toContain('recipes');
	expect(tables).toContain('order_recipes');

	const itemColumns = (await db.query('PRAGMA table_info(order_items)'))
		.map((column) => column.name);
	expect(itemColumns).toEqual(expect.arrayContaining(['theme', 'count', 'notes', 'tier_count', 'tier_details']));

	const photoColumns = (await db.query('PRAGMA table_info(photos)'))
		.map((column) => column.name);
	expect(photoColumns).toContain('image_type');
});
