import { getDb } from './connection.js';

function normalizeTagName(name) {
	return String(name || '').trim().replace(/\s+/g, ' ');
}

function canonicalTagName(db, name) {
	const normalizedName = normalizeTagName(name);
	const existingTag = db.prepare('SELECT name FROM tags WHERE name = ? COLLATE NOCASE').get(normalizedName);

	return existingTag?.name || normalizedName;
}

export function listTags() {
	return getDb()
		.prepare('SELECT name FROM tags ORDER BY lower(name) ASC')
		.all()
		.map((row) => row.name);
}

export function getTagsForOrder(orderId) {
	return getDb()
		.prepare(`
			SELECT tags.name
			FROM tags
			INNER JOIN order_tags ON order_tags.tag_id = tags.id
			WHERE order_tags.order_id = ?
			ORDER BY lower(tags.name) ASC
		`)
		.all(orderId)
		.map((row) => row.name);
}

export function setTagsForOrder(orderId, names) {
	const db = getDb();
	const seenNames = new Set();
	const normalizedNames = (names || [])
		.map((name) => canonicalTagName(db, name))
		.filter(Boolean)
		.filter((name) => {
			const key = name.toLowerCase();
			if (seenNames.has(key)) {
				return false;
			}

			seenNames.add(key);
			return true;
		});

	const applyTags = db.transaction(() => {
		db.prepare('DELETE FROM order_tags WHERE order_id = ?').run(orderId);

		for (const name of normalizedNames) {
			const insert = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(name);
			const tagId = insert.changes
				? insert.lastInsertRowid
				: db.prepare('SELECT id FROM tags WHERE name = ? COLLATE NOCASE').get(name).id;
			db.prepare('INSERT OR IGNORE INTO order_tags (order_id, tag_id) VALUES (?, ?)').run(orderId, tagId);
		}
	});

	applyTags();
	return getTagsForOrder(orderId);
}
