import { getDb } from './connection.js';

const PHOTO_IMAGE_TYPES = new Set(['reference', 'final']);

function normalizeImageType(imageType) {
	return PHOTO_IMAGE_TYPES.has(imageType) ? imageType : 'final';
}

function rowToPhoto(row) {
	return {
		id: row.id,
		orderId: row.order_id,
		filePath: row.file_path,
		imageType: normalizeImageType(row.image_type),
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

export async function createPhoto(orderId, filePath, imageType = 'final') {
	const db = await getDb();
	const normalizedImageType = normalizeImageType(imageType);
	const existingCountRow = await db.one('SELECT COUNT(*) AS count FROM photos WHERE order_id = $1 AND image_type = $2', [
		orderId,
		normalizedImageType
	]);
	const existingCount = Number(existingCountRow.count);
	const row = await db.one('INSERT INTO photos (order_id, file_path, image_type, sort_order, is_cover) VALUES ($1, $2, $3, $4, $5) RETURNING id', [
		orderId,
		filePath,
		normalizedImageType,
		existingCount,
		normalizedImageType === 'final' && existingCount === 0
	]);

	return getPhotoById(row.id);
}

export async function deletePhoto(id) {
	const db = await getDb();
	const result = await db.run('DELETE FROM photos WHERE id = $1', [id]);
	return result.changes > 0;
}
