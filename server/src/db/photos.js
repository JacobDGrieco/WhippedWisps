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

export async function listPhotos(orderId) {
	const db = await getDb();
	const rows = await db.query('SELECT * FROM photos WHERE order_id = $1 ORDER BY sort_order ASC, id ASC', [orderId]);
	return rows.map(rowToPhoto);
}

export async function getPhotoById(id) {
	const db = await getDb();
	const row = await db.one('SELECT * FROM photos WHERE id = $1', [id]);
	return row ? rowToPhoto(row) : undefined;
}

export async function createPhoto(orderId, filePath) {
	const db = await getDb();
	const existingCountRow = await db.one('SELECT COUNT(*) AS count FROM photos WHERE order_id = $1', [orderId]);
	const existingCount = Number(existingCountRow.count);
	const row = await db.one('INSERT INTO photos (order_id, file_path, sort_order, is_cover) VALUES ($1, $2, $3, $4) RETURNING id', [
		orderId,
		filePath,
		existingCount,
		existingCount === 0
	]);

	return getPhotoById(row.id);
}

export async function deletePhoto(id) {
	const db = await getDb();
	const result = await db.run('DELETE FROM photos WHERE id = $1', [id]);
	return result.changes > 0;
}
