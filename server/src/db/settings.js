import { getDb } from './connection.js';

export async function getSetting(key) {
	const db = await getDb();
	return (await db.one('SELECT value FROM settings WHERE key = $1', [key]))?.value ?? null;
}

export async function setSetting(key, value) {
	const db = await getDb();
	await db.run(`
		INSERT INTO settings (key, value)
		VALUES ($1, $2)
		ON CONFLICT(key) DO UPDATE SET value = excluded.value
	`, [key, value]);
}

export async function deleteSetting(key) {
	const db = await getDb();
	const result = await db.run('DELETE FROM settings WHERE key = $1', [key]);
	return result.changes > 0;
}
