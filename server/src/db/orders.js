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

function updatedAtSql(db) {
	return db.kind === 'postgres'
		? "to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')"
		: "datetime('now')";
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

async function existingSlugs(db, exceptOrderId) {
	const rows = exceptOrderId
		? await db.query('SELECT slug FROM orders WHERE id <> $1', [exceptOrderId])
		: await db.query('SELECT slug FROM orders');

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
		depositPaid: Boolean(data.depositPaid),
		notes: data.notes ?? null,
		googleEventId: data.googleEventId ?? null,
		reminderOffsets: JSON.stringify(data.reminderOffsets ?? DEFAULT_REMINDER_OFFSETS)
	};
}

function normalizeThemeName(theme) {
	return String(theme || '').trim().replace(/\s+/g, ' ');
}

export async function listThemes() {
	const db = await getDb();
	const rows = await db.query(`
		SELECT theme FROM orders WHERE theme IS NOT NULL AND trim(theme) != ''
		UNION ALL
		SELECT theme FROM order_items WHERE theme IS NOT NULL AND trim(theme) != ''
	`);
	const seen = new Set();

	return rows
		.map((row) => normalizeThemeName(row.theme))
		.filter(Boolean)
		.filter((theme) => {
			const key = theme.toLowerCase();
			if (seen.has(key)) {
				return false;
			}

			seen.add(key);
			return true;
		})
		.sort((firstTheme, secondTheme) => firstTheme.localeCompare(secondTheme, undefined, { sensitivity: 'base' }));
}

export async function createOrder(data) {
	const db = await getDb();
	const slug = generateSlug(data, await existingSlugs(db));
	const input = normalizeOrderInput(data);

	const orderId = await db.transaction(async (transactionDb) => {
		const row = await transactionDb.one(`
			INSERT INTO orders (
				slug, status, customer_name, customer_contact, order_date, due_date, due_time,
				delivery_type, delivery_address, delivery_window_start, delivery_window_end,
				theme, description, dimensions, servings, flavors, price, deposit_amount,
				deposit_paid, notes, google_event_id, reminder_offsets
			) VALUES (
				$1, 'scheduled', $2, $3, $4, $5, $6,
				$7, $8, $9, $10,
				$11, $12, $13, $14, $15, $16, $17,
				$18, $19, $20, $21
			)
			RETURNING id
		`, [
			slug,
			input.customerName,
			input.customerContact,
			input.orderDate,
			input.dueDate,
			input.dueTime,
			input.deliveryType,
			input.deliveryAddress,
			input.deliveryWindowStart,
			input.deliveryWindowEnd,
			input.theme,
			input.description,
			input.dimensions,
			input.servings,
			input.flavors,
			input.price,
			input.depositAmount,
			input.depositPaid,
			input.notes,
			input.googleEventId,
			input.reminderOffsets
		]);

		if (Array.isArray(data.orderItems)) {
			await replaceOrderItemsWithDb(transactionDb, row.id, data.orderItems);
		}

		return row.id;
	});

	return getOrderById(orderId);
}

export async function getOrderById(id) {
	const db = await getDb();
	return rowToOrder(await db.one('SELECT * FROM orders WHERE id = $1', [id]));
}

export async function getOrderBySlug(slug) {
	const db = await getDb();
	return rowToOrder(await db.one('SELECT * FROM orders WHERE slug = $1', [slug]));
}

export async function listOrders({ status } = {}) {
	const db = await getDb();
	const rows = status
		? await db.query('SELECT * FROM orders WHERE status = $1 ORDER BY due_date ASC, due_time ASC, id ASC', [status])
		: await db.query('SELECT * FROM orders ORDER BY due_date ASC, due_time ASC, id ASC');

	return rows.map(rowToOrder);
}

export async function updateOrder(id, data) {
	const db = await getDb();
	const current = await getOrderById(id);
	if (!current) {
		return undefined;
	}

	const hasOrderItems = Array.isArray(data.orderItems);
	const normalized = normalizeOrderInput({ ...current, ...data });
	const updates = [];
	const updateValues = [];
	for (const key of ORDER_COLUMNS) {
		if (Object.prototype.hasOwnProperty.call(data, key)) {
			updateValues.push(normalized[key]);
			updates.push(`${COLUMN_TO_DB[key]} = $${updateValues.length}`);
		}
	}

	const shouldRegenerateSlug = Object.prototype.hasOwnProperty.call(data, 'theme')
		|| Object.prototype.hasOwnProperty.call(data, 'customerName');
	if (shouldRegenerateSlug) {
		const slug = generateSlug(
			{ theme: normalized.theme, customerName: normalized.customerName },
			await existingSlugs(db, id)
		);
		updateValues.push(slug);
		updates.push(`slug = $${updateValues.length}`);
	}

	if (updates.length === 0 && !hasOrderItems) {
		return current;
	}

	await db.transaction(async (transactionDb) => {
		if (updates.length) {
			updates.push(`updated_at = ${updatedAtSql(transactionDb)}`);
			await transactionDb.run(`UPDATE orders SET ${updates.join(', ')} WHERE id = $${updateValues.length + 1}`, [
				...updateValues,
				id
			]);
		} else {
			await transactionDb.run(`UPDATE orders SET updated_at = ${updatedAtSql(transactionDb)} WHERE id = $1`, [id]);
		}

		if (hasOrderItems) {
			await replaceOrderItemsWithDb(transactionDb, id, data.orderItems);
		}
	});

	return getOrderById(id);
}

export async function setOrderGoogleEventId(id, googleEventId) {
	return updateOrder(id, { googleEventId });
}

export async function clearOrderGoogleEventIds() {
	const db = await getDb();
	const result = await db.run(`UPDATE orders SET google_event_id = NULL, updated_at = ${updatedAtSql(db)} WHERE google_event_id IS NOT NULL`);
	return result.changes;
}

export async function archiveOrder(id) {
	const db = await getDb();
	const result = await db.run(`UPDATE orders SET status = 'archived', updated_at = ${updatedAtSql(db)} WHERE id = $1`, [id]);
	return result.changes ? getOrderById(id) : undefined;
}

export async function deleteOrder(id) {
	const db = await getDb();
	const result = await db.run('DELETE FROM orders WHERE id = $1', [id]);
	return result.changes > 0;
}

export async function searchArchivedOrders(query) {
	const trimmedQuery = query.trim();
	if (!trimmedQuery) {
		return listOrders({ status: 'archived' });
	}

	const like = `%${trimmedQuery.toLowerCase()}%`;
	const db = await getDb();
	const rows = await db.query(`
		SELECT DISTINCT orders.*
		FROM orders
		LEFT JOIN order_items ON order_items.order_id = orders.id
		LEFT JOIN order_tags ON order_tags.order_id = orders.id
		LEFT JOIN tags ON tags.id = order_tags.tag_id
		WHERE orders.status = 'archived'
			AND (
				lower(coalesce(orders.customer_name, '')) LIKE $1
				OR lower(coalesce(orders.theme, '')) LIKE $1
				OR lower(coalesce(orders.description, '')) LIKE $1
				OR lower(coalesce(orders.flavors, '')) LIKE $1
				OR lower(coalesce(order_items.type, '')) LIKE $1
				OR lower(coalesce(order_items.theme, '')) LIKE $1
				OR lower(coalesce(order_items.flavors, '')) LIKE $1
				OR lower(coalesce(order_items.notes, '')) LIKE $1
				OR lower(coalesce(order_items.tier_details, '')) LIKE $1
				OR lower(coalesce(tags.name, '')) LIKE $1
			)
		ORDER BY orders.due_date DESC, orders.id DESC
	`, [like]);

	return rows.map(rowToOrder);
}
