import { getDb } from './connection.js';

function rowToNeededItem(row) {
	return {
		id: row.id,
		orderId: row.order_id,
		label: row.label,
		done: Boolean(row.done)
	};
}

export function listNeededItems(orderId) {
	return getDb()
		.prepare('SELECT * FROM needed_items WHERE order_id = ? ORDER BY id ASC')
		.all(orderId)
		.map(rowToNeededItem);
}

export function createNeededItem(orderId, data) {
	const result = getDb()
		.prepare('INSERT INTO needed_items (order_id, label, done) VALUES (?, ?, ?)')
		.run(orderId, data.label, data.done ? 1 : 0);

	return getNeededItemById(result.lastInsertRowid);
}

export function getNeededItemById(id) {
	const row = getDb().prepare('SELECT * FROM needed_items WHERE id = ?').get(id);
	return row ? rowToNeededItem(row) : undefined;
}

export function updateNeededItem(id, data) {
	const current = getNeededItemById(id);
	if (!current) {
		return undefined;
	}

	getDb()
		.prepare('UPDATE needed_items SET label = ?, done = ? WHERE id = ?')
		.run(data.label ?? current.label, data.done === undefined ? Number(current.done) : Number(Boolean(data.done)), id);

	return getNeededItemById(id);
}

export function deleteNeededItem(id) {
	return getDb().prepare('DELETE FROM needed_items WHERE id = ?').run(id).changes > 0;
}
