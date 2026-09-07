import { getDb } from './connection.js';

function normalizeTagName(name) {
	return String(name || '').trim().replace(/\s+/g, ' ');
}

async function canonicalTagName(db, name) {
	const normalizedName = normalizeTagName(name);
	const existingTag = await db.one('SELECT name FROM tags WHERE lower(name) = lower($1)', [normalizedName]);

	return existingTag?.name || normalizedName;
}

export async function listTags() {
	const db = await getDb();
	const rows = await db.query('SELECT name FROM tags ORDER BY lower(name) ASC');
	return rows.map((row) => row.name);
}

export async function getTagsForOrder(orderId) {
	const db = await getDb();
	const rows = await db.query(`
		SELECT tags.name
		FROM tags
		INNER JOIN order_tags ON order_tags.tag_id = tags.id
		WHERE order_tags.order_id = $1
		ORDER BY lower(tags.name) ASC
	`, [orderId]);
	return rows.map((row) => row.name);
}

export async function setTagsForOrder(orderId, names) {
	const db = await getDb();
	const seenNames = new Set();
	const canonicalNames = await Promise.all((names || []).map((name) => canonicalTagName(db, name)));
	const normalizedNames = canonicalNames
		.filter(Boolean)
		.filter((name) => {
			const key = name.toLowerCase();
			if (seenNames.has(key)) {
				return false;
			}

			seenNames.add(key);
			return true;
		});

	await db.transaction(async (transactionDb) => {
		await transactionDb.run('DELETE FROM order_tags WHERE order_id = $1', [orderId]);

		for (const name of normalizedNames) {
			const insertedTag = await transactionDb.one('INSERT INTO tags (name) VALUES ($1) ON CONFLICT DO NOTHING RETURNING id', [name]);
			const tag = insertedTag || await transactionDb.one('SELECT id FROM tags WHERE lower(name) = lower($1)', [name]);
			await transactionDb.run('INSERT INTO order_tags (order_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [
				orderId,
				tag.id
			]);
		}
	});

	return getTagsForOrder(orderId);
}
