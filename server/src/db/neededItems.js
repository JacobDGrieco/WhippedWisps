import { getDb } from './connection.js';

function rowToNeededItem(row) {
	return {
		id: row.id,
		orderId: row.order_id,
		label: row.label,
		done: Boolean(row.done)
	};
}

export async function listNeededItems(orderId) {
	const db = await getDb();
	const rows = await db.query('SELECT * FROM needed_items WHERE order_id = $1 ORDER BY id ASC', [orderId]);
	return rows.map(rowToNeededItem);
}

export async function createNeededItem(orderId, data) {
	const db = await getDb();
	const row = await db.one('INSERT INTO needed_items (order_id, label, done) VALUES ($1, $2, $3) RETURNING id', [
		orderId,
		data.label,
		Boolean(data.done)
	]);

	return getNeededItemById(row.id);
}

export async function getNeededItemById(id) {
	const db = await getDb();
	const row = await db.one('SELECT * FROM needed_items WHERE id = $1', [id]);
	return row ? rowToNeededItem(row) : undefined;
}

export async function updateNeededItem(id, data) {
	const current = await getNeededItemById(id);
	if (!current) {
		return undefined;
	}

	const db = await getDb();
	await db.run('UPDATE needed_items SET label = $1, done = $2 WHERE id = $3', [
		data.label ?? current.label,
		data.done === undefined ? current.done : Boolean(data.done),
		id
	]);

	return getNeededItemById(id);
}

export async function deleteNeededItem(id) {
	const db = await getDb();
	const result = await db.run('DELETE FROM needed_items WHERE id = $1', [id]);
	return result.changes > 0;
}
