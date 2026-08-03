import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

let db;
let openPath;

const ORDER_ITEM_COLUMNS = [
	['theme', 'TEXT'],
	['count', 'INTEGER'],
	['notes', 'TEXT'],
	['tier_count', 'INTEGER'],
	['tier_details', "TEXT NOT NULL DEFAULT '[]'"]
];

function ensureOrderItemColumns(database) {
	const columns = new Set(
		database
			.prepare('PRAGMA table_info(order_items)')
			.all()
			.map((column) => column.name)
	);

	for (const [column, definition] of ORDER_ITEM_COLUMNS) {
		if (!columns.has(column)) {
			database.exec(`ALTER TABLE order_items ADD COLUMN ${column} ${definition}`);
		}
	}
}

export function getDb() {
	const dbPath = path.resolve(process.env.DB_PATH || './data/whippedwisps.db');
	if (db && openPath === dbPath) {
		return db;
	}

	if (db) {
		db.close();
	}

	fs.mkdirSync(path.dirname(dbPath), { recursive: true });
	db = new Database(dbPath);
	openPath = dbPath;
	db.pragma('foreign_keys = ON');
	db.exec(fs.readFileSync(path.join(moduleDir, 'schema.sql'), 'utf8'));
	ensureOrderItemColumns(db);

	return db;
}

export function closeDb() {
	if (!db) {
		return;
	}

	db.close();
	db = undefined;
	openPath = undefined;
}
