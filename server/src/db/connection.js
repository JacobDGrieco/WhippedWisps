import Database from 'better-sqlite3';
import { Pool } from '@neondatabase/serverless';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
const POSTGRES_URL_ENV_KEYS = ['DATABASE_URL', 'POSTGRES_URL', 'POSTGRES_PRISMA_URL', 'POSTGRES_URL_NON_POOLING'];

let db;
let connectionKey;

const ORDER_ITEM_COLUMNS = [
	['theme', 'TEXT'],
	['count', 'INTEGER'],
	['notes', 'TEXT'],
	['tier_count', 'INTEGER'],
	['tier_details', "TEXT NOT NULL DEFAULT '[]'"]
];

const PHOTO_COLUMNS = [
	['image_type', "TEXT NOT NULL DEFAULT 'final' CHECK (image_type IN ('reference', 'final'))"]
];

function getPostgresConnectionString() {
	for (const envKey of POSTGRES_URL_ENV_KEYS) {
		if (process.env[envKey]) {
			return process.env[envKey];
		}
	}

	return undefined;
}

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

function ensurePhotoColumns(database) {
	const columns = new Set(
		database
			.prepare('PRAGMA table_info(photos)')
			.all()
			.map((column) => column.name)
	);

	for (const [column, definition] of PHOTO_COLUMNS) {
		if (!columns.has(column)) {
			database.exec(`ALTER TABLE photos ADD COLUMN ${column} ${definition}`);
		}
	}
}

function sqliteStatement(sql, params = []) {
	const statementParams = [];
	const sqliteValue = (value) => typeof value === 'boolean' ? Number(value) : value;
	const text = sql.replace(/\$(\d+)/g, (placeholder, index) => {
		statementParams.push(sqliteValue(params[Number(index) - 1]));
		return '?';
	});

	return {
		text,
		params: statementParams.length ? statementParams : params.map(sqliteValue)
	};
}

function getDefaultDbPath() {
	return process.env.VERCEL ? '/tmp/whippedwisps.db' : './data/whippedwisps.db';
}

function createSqliteAdapter(database) {
	let adapter;
	adapter = {
		kind: 'sqlite',
		async query(sql, params = []) {
			const statement = sqliteStatement(sql, params);
			return database.prepare(statement.text).all(...statement.params);
		},
		async one(sql, params = []) {
			const statement = sqliteStatement(sql, params);
			return database.prepare(statement.text).get(...statement.params);
		},
		async run(sql, params = []) {
			const statement = sqliteStatement(sql, params);
			const result = database.prepare(statement.text).run(...statement.params);
			return {
				changes: result.changes,
				lastInsertRowid: result.lastInsertRowid
			};
		},
		async transaction(callback) {
			database.exec('BEGIN');
			try {
				const result = await callback(adapter);
				database.exec('COMMIT');
				return result;
			} catch (error) {
				database.exec('ROLLBACK');
				throw error;
			}
		},
		async close() {
			database.close();
		}
	};

	return adapter;
}

async function createSqliteDatabase() {
	const dbPath = path.resolve(process.env.DB_PATH || getDefaultDbPath());
	fs.mkdirSync(path.dirname(dbPath), { recursive: true });
	const database = new Database(dbPath);
	database.pragma('foreign_keys = ON');
	database.exec(fs.readFileSync(path.join(moduleDir, 'schema.sql'), 'utf8'));
	ensureOrderItemColumns(database);
	ensurePhotoColumns(database);

	return createSqliteAdapter(database);
}

async function createPostgresDatabase(connectionString) {
	const pool = new Pool({ connectionString });
	await pool.query(fs.readFileSync(path.join(moduleDir, 'schema.postgres.sql'), 'utf8'));

	const createClientAdapter = (client) => ({
		kind: 'postgres',
		async query(sql, params = []) {
			const result = await client.query(sql, params);
			return result.rows;
		},
		async one(sql, params = []) {
			const result = await client.query(sql, params);
			return result.rows[0];
		},
		async run(sql, params = []) {
			const result = await client.query(sql, params);
			return {
				changes: result.rowCount,
				lastInsertRowid: result.rows[0]?.id
			};
		}
	});

	return {
		...createClientAdapter(pool),
		async transaction(callback) {
			const client = await pool.connect();
			const transactionalDb = createClientAdapter(client);
			try {
				await client.query('BEGIN');
				const result = await callback(transactionalDb);
				await client.query('COMMIT');
				return result;
			} catch (error) {
				await client.query('ROLLBACK');
				throw error;
			} finally {
				client.release();
			}
		},
		async close() {
			await pool.end();
		}
	};
}

export async function getDb() {
	const postgresConnectionString = getPostgresConnectionString();
	const nextConnectionKey = postgresConnectionString ? `postgres:${postgresConnectionString}` : `sqlite:${path.resolve(process.env.DB_PATH || getDefaultDbPath())}`;

	if (db && connectionKey === nextConnectionKey) {
		return db;
	}

	if (!db) {
		db = postgresConnectionString
			? await createPostgresDatabase(postgresConnectionString)
			: await createSqliteDatabase();
		connectionKey = nextConnectionKey;
		return db;
	}

	await closeDb();
	db = postgresConnectionString
		? await createPostgresDatabase(postgresConnectionString)
		: await createSqliteDatabase();
	connectionKey = nextConnectionKey;

	return db;
}

export async function closeDb() {
	if (!db) {
		return;
	}

	await db.close();
	db = undefined;
	connectionKey = undefined;
}
