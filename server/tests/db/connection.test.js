import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, expect, test } from 'vitest';
import { closeDb, getDb } from '../../src/db/connection.js';

const TEST_DB = path.resolve('./server/tests/tmp/test-connection.db');

beforeEach(() => {
	closeDb();
	fs.rmSync(TEST_DB, { force: true });
	process.env.DB_PATH = TEST_DB;
});

test('getDb creates the database file and applies schema', () => {
	const db = getDb();
	const tables = db
		.prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
		.all()
		.map((row) => row.name);

	expect(fs.existsSync(TEST_DB)).toBe(true);
	expect(tables).toContain('orders');
	expect(tables).toContain('recipes');
	expect(tables).toContain('order_recipes');

	const itemColumns = db
		.prepare('PRAGMA table_info(order_items)')
		.all()
		.map((column) => column.name);
	expect(itemColumns).toEqual(expect.arrayContaining(['theme', 'count', 'notes', 'tier_count', 'tier_details']));
});
