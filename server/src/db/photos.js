import { getDb } from './connection.js';

function rowToPhoto(row) {
	return {
		id: row.id,
		orderId: row.order_id,
		filePath: row.file_path,
		sortOrder: row.sort_order,
		isCover: Boolean(row.is_cover)
	};
}

export function listPhotos(orderId) {
	return getDb()
		.prepare('SELECT * FROM photos WHERE order_id = ? ORDER BY sort_order ASC, id ASC')
		.all(orderId)
		.map(rowToPhoto);
}

export function getPhotoById(id) {
	const row = getDb().prepare('SELECT * FROM photos WHERE id = ?').get(id);
	return row ? rowToPhoto(row) : undefined;
}

export function createPhoto(orderId, filePath) {
	const db = getDb();
	const existingCount = db.prepare('SELECT COUNT(*) AS count FROM photos WHERE order_id = ?').get(orderId).count;
	const result = db
		.prepare('INSERT INTO photos (order_id, file_path, sort_order, is_cover) VALUES (?, ?, ?, ?)')
		.run(orderId, filePath, existingCount, existingCount === 0 ? 1 : 0);

	return getPhotoById(result.lastInsertRowid);
}

export function deletePhoto(id) {
	return getDb().prepare('DELETE FROM photos WHERE id = ?').run(id).changes > 0;
}
