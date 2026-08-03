import { getDb } from './connection.js';
import { replaceOrderItemsWithDb } from './orderItems.js';
import { generateSlug } from '../services/slug.js';

const DEFAULT_REMINDER_OFFSETS = [2880];

const ORDER_COLUMNS = [
	'customerName',
	'customerContact',
	'orderDate',
	'dueDate',
	'dueTime',
	'deliveryType',
	'deliveryAddress',
	'deliveryWindowStart',
	'deliveryWindowEnd',
	'theme',
	'description',
	'dimensions',
	'servings',
	'flavors',
	'price',
	'depositAmount',
	'depositPaid',
	'notes',
	'googleEventId',
	'reminderOffsets'
];

const COLUMN_TO_DB = {
	customerName: 'customer_name',
	customerContact: 'customer_contact',
	orderDate: 'order_date',
	dueDate: 'due_date',
	dueTime: 'due_time',
	deliveryType: 'delivery_type',
	deliveryAddress: 'delivery_address',
	deliveryWindowStart: 'delivery_window_start',
	deliveryWindowEnd: 'delivery_window_end',
	theme: 'theme',
	description: 'description',
	dimensions: 'dimensions',
	servings: 'servings',
	flavors: 'flavors',
	price: 'price',
	depositAmount: 'deposit_amount',
	depositPaid: 'deposit_paid',
	notes: 'notes',
	googleEventId: 'google_event_id',
	reminderOffsets: 'reminder_offsets'
};

function parseJsonArray(value, fallback = []) {
	try {
		const parsed = JSON.parse(value || '[]');
		return Array.isArray(parsed) ? parsed : fallback;
	} catch {
		return fallback;
	}
}

export function rowToOrder(row) {
	if (!row) {
		return undefined;
	}

	return {
		id: row.id,
		slug: row.slug,
		status: row.status,
		customerName: row.customer_name,
		customerContact: row.customer_contact,
		orderDate: row.order_date,
		dueDate: row.due_date,
		dueTime: row.due_time,
		deliveryType: row.delivery_type,
		deliveryAddress: row.delivery_address,
		deliveryWindowStart: row.delivery_window_start,
		deliveryWindowEnd: row.delivery_window_end,
		theme: row.theme,
		description: row.description,
		dimensions: row.dimensions,
		servings: row.servings,
		flavors: row.flavors,
		price: row.price,
		depositAmount: row.deposit_amount,
		depositPaid: Boolean(row.deposit_paid),
		notes: row.notes,
		googleEventId: row.google_event_id,
		reminderOffsets: parseJsonArray(row.reminder_offsets, DEFAULT_REMINDER_OFFSETS),
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

function existingSlugs(db, exceptOrderId) {
	const rows = exceptOrderId
		? db.prepare('SELECT slug FROM orders WHERE id != ?').all(exceptOrderId)
		: db.prepare('SELECT slug FROM orders').all();

	return new Set(rows.map((row) => row.slug));
}

function normalizeOrderInput(data) {
	return {
		customerName: data.customerName,
		customerContact: data.customerContact ?? null,
		orderDate: data.orderDate ?? null,
		dueDate: data.dueDate,
		dueTime: data.dueTime ?? null,
		deliveryType: data.deliveryType ?? 'pickup',
		deliveryAddress: data.deliveryAddress ?? null,
		deliveryWindowStart: data.deliveryWindowStart ?? null,
		deliveryWindowEnd: data.deliveryWindowEnd ?? null,
		theme: data.theme ?? null,
		description: data.description ?? null,
		dimensions: data.dimensions ?? null,
		servings: data.servings ?? null,
		flavors: data.flavors ?? null,
		price: data.price === '' || data.price === undefined ? null : Number(data.price),
		depositAmount: data.depositAmount === '' || data.depositAmount === undefined ? null : Number(data.depositAmount),
		depositPaid: data.depositPaid ? 1 : 0,
		notes: data.notes ?? null,
		googleEventId: data.googleEventId ?? null,
		reminderOffsets: JSON.stringify(data.reminderOffsets ?? DEFAULT_REMINDER_OFFSETS)
	};
}

export function createOrder(data) {
	const db = getDb();
	const slug = generateSlug(data, existingSlugs(db));
	const input = normalizeOrderInput(data);

	const create = db.transaction(() => {
		const result = db.prepare(`
			INSERT INTO orders (
				slug, status, customer_name, customer_contact, order_date, due_date, due_time,
				delivery_type, delivery_address, delivery_window_start, delivery_window_end,
				theme, description, dimensions, servings, flavors, price, deposit_amount,
				deposit_paid, notes, google_event_id, reminder_offsets
			) VALUES (
				@slug, 'scheduled', @customerName, @customerContact, @orderDate, @dueDate, @dueTime,
				@deliveryType, @deliveryAddress, @deliveryWindowStart, @deliveryWindowEnd,
				@theme, @description, @dimensions, @servings, @flavors, @price, @depositAmount,
				@depositPaid, @notes, @googleEventId, @reminderOffsets
			)
		`).run({ ...input, slug });

		if (Array.isArray(data.orderItems)) {
			replaceOrderItemsWithDb(db, result.lastInsertRowid, data.orderItems);
		}

		return result.lastInsertRowid;
	});

	return getOrderById(create());
}

export function getOrderById(id) {
	return rowToOrder(getDb().prepare('SELECT * FROM orders WHERE id = ?').get(id));
}

export function getOrderBySlug(slug) {
	return rowToOrder(getDb().prepare('SELECT * FROM orders WHERE slug = ?').get(slug));
}

export function listOrders({ status } = {}) {
	const db = getDb();
	const rows = status
		? db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY due_date ASC, due_time ASC, id ASC').all(status)
		: db.prepare('SELECT * FROM orders ORDER BY due_date ASC, due_time ASC, id ASC').all();

	return rows.map(rowToOrder);
}

export function updateOrder(id, data) {
	const db = getDb();
	const current = getOrderById(id);
	if (!current) {
		return undefined;
	}

	const hasOrderItems = Array.isArray(data.orderItems);
	const normalized = normalizeOrderInput({ ...current, ...data });
	const updates = ORDER_COLUMNS
		.filter((key) => Object.prototype.hasOwnProperty.call(data, key))
		.map((key) => `${COLUMN_TO_DB[key]} = @${key}`);

	const shouldRegenerateSlug = Object.prototype.hasOwnProperty.call(data, 'theme')
		|| Object.prototype.hasOwnProperty.call(data, 'customerName');
	if (shouldRegenerateSlug) {
		updates.push('slug = @slug');
		normalized.slug = generateSlug(
			{ theme: normalized.theme, customerName: normalized.customerName },
			existingSlugs(db, id)
		);
	}

	if (updates.length === 0 && !hasOrderItems) {
		return current;
	}

	const update = db.transaction(() => {
		if (updates.length) {
			updates.push("updated_at = datetime('now')");
			db.prepare(`UPDATE orders SET ${updates.join(', ')} WHERE id = @id`).run({ ...normalized, id });
		} else {
			db.prepare("UPDATE orders SET updated_at = datetime('now') WHERE id = ?").run(id);
		}

		if (hasOrderItems) {
			replaceOrderItemsWithDb(db, id, data.orderItems);
		}
	});

	update();
	return getOrderById(id);
}

export function setOrderGoogleEventId(id, googleEventId) {
	return updateOrder(id, { googleEventId });
}

export function archiveOrder(id) {
	const db = getDb();
	const result = db.prepare("UPDATE orders SET status = 'archived', updated_at = datetime('now') WHERE id = ?").run(id);
	return result.changes ? getOrderById(id) : undefined;
}

export function deleteOrder(id) {
	return getDb().prepare('DELETE FROM orders WHERE id = ?').run(id).changes > 0;
}

export function searchArchivedOrders(query) {
	const trimmedQuery = query.trim();
	if (!trimmedQuery) {
		return listOrders({ status: 'archived' });
	}

	const like = `%${trimmedQuery.toLowerCase()}%`;
	const rows = getDb().prepare(`
		SELECT DISTINCT orders.*
		FROM orders
		LEFT JOIN order_items ON order_items.order_id = orders.id
		LEFT JOIN order_tags ON order_tags.order_id = orders.id
		LEFT JOIN tags ON tags.id = order_tags.tag_id
		WHERE orders.status = 'archived'
			AND (
				lower(coalesce(orders.customer_name, '')) LIKE @like
				OR lower(coalesce(orders.theme, '')) LIKE @like
				OR lower(coalesce(orders.description, '')) LIKE @like
				OR lower(coalesce(orders.flavors, '')) LIKE @like
				OR lower(coalesce(order_items.type, '')) LIKE @like
				OR lower(coalesce(order_items.theme, '')) LIKE @like
				OR lower(coalesce(order_items.flavors, '')) LIKE @like
				OR lower(coalesce(order_items.notes, '')) LIKE @like
				OR lower(coalesce(order_items.tier_details, '')) LIKE @like
				OR lower(coalesce(tags.name, '')) LIKE @like
			)
		ORDER BY orders.due_date DESC, orders.id DESC
	`).all({ like });

	return rows.map(rowToOrder);
}
