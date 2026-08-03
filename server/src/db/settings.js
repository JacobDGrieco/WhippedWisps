import { getDb } from './connection.js';

export function getSetting(key) {
	return getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? null;
}

export function setSetting(key, value) {
	getDb()
		.prepare(`
			INSERT INTO settings (key, value)
			VALUES (?, ?)
			ON CONFLICT(key) DO UPDATE SET value = excluded.value
		`)
		.run(key, value);
}

export function deleteSetting(key) {
	return getDb().prepare('DELETE FROM settings WHERE key = ?').run(key).changes > 0;
}
