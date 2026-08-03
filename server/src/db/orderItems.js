import { getDb } from './connection.js';

const COUNTED_ITEM_TYPES = new Set(['cupcakes', 'cake pops', 'cookies']);

function parseJsonArray(value, fallback = []) {
	try {
		const parsed = JSON.parse(value || '[]');
		return Array.isArray(parsed) ? parsed : fallback;
	} catch {
		return fallback;
	}
}

function rowToOrderItem(row) {
	return {
		id: row.id,
		orderId: row.order_id,
		type: row.type,
		theme: row.theme,
		dimensions: row.dimensions,
		servings: row.servings,
		flavors: row.flavors,
		count: row.count,
		price: row.price,
		notes: row.notes,
		tierCount: row.tier_count,
		tierDetails: parseJsonArray(row.tier_details),
		sortOrder: row.sort_order
	};
}

function normalizeInteger(value) {
	if (value === '' || value === undefined || value === null) {
		return null;
	}

	const parsed = Number(value);
	return Number.isFinite(parsed) ? Math.max(0, Math.trunc(parsed)) : null;
}

function normalizePrice(price) {
	return price === '' || price === undefined || price === null ? null : Number(price);
}

function normalizeTierDetails(tierDetails, tierCount) {
	const sourceTiers = Array.isArray(tierDetails) ? tierDetails : [];
	const count = tierCount ?? sourceTiers.length;
	return Array.from({ length: count }, (_, index) => {
		const tier = sourceTiers[index] || {};
		return {
			dimensions: tier.dimensions?.trim() || '',
			flavors: tier.flavors?.trim() || ''
		};
	});
}

function normalizeOrderItemInput(item, sortOrder) {
	const type = item.type?.trim() || 'cake';
	const tierCount = type === 'tiered cake' ? normalizeInteger(item.tierCount) : null;
	const tierDetails = type === 'tiered cake' ? normalizeTierDetails(item.tierDetails, tierCount) : [];
	const hasFlavor = type !== 'other' && type !== 'tiered cake';

	return {
		type,
		theme: type === 'other' ? null : item.theme?.trim() || null,
		dimensions: type === 'cake' ? item.dimensions?.trim() || null : null,
		servings: ['cake', 'tiered cake'].includes(type) ? item.servings?.trim() || null : null,
		flavors: hasFlavor ? item.flavors?.trim() || null : null,
		count: COUNTED_ITEM_TYPES.has(type) ? normalizeInteger(item.count) : null,
		price: normalizePrice(item.price),
		notes: type === 'other' ? item.notes?.trim() || null : null,
		tierCount,
		tierDetails: JSON.stringify(tierDetails),
		sortOrder
	};
}

export function listOrderItems(orderId) {
	return getDb()
		.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY sort_order ASC, id ASC')
		.all(orderId)
		.map(rowToOrderItem);
}

export function replaceOrderItemsWithDb(db, orderId, items = []) {
	const normalizedItems = items.map(normalizeOrderItemInput);
	db.prepare('DELETE FROM order_items WHERE order_id = ?').run(orderId);

	const insert = db.prepare(`
		INSERT INTO order_items (
			order_id, type, theme, dimensions, servings, flavors, count, price,
			notes, tier_count, tier_details, sort_order
		) VALUES (
			@orderId, @type, @theme, @dimensions, @servings, @flavors, @count, @price,
			@notes, @tierCount, @tierDetails, @sortOrder
		)
	`);

	for (const item of normalizedItems) {
		insert.run({ ...item, orderId });
	}
}

export function replaceOrderItems(orderId, items = []) {
	const db = getDb();
	const replace = db.transaction(() => replaceOrderItemsWithDb(db, orderId, items));

	replace();
	return listOrderItems(orderId);
}
