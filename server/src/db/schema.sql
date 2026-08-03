CREATE TABLE IF NOT EXISTS orders (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	slug TEXT UNIQUE NOT NULL,
	status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'archived')),
	customer_name TEXT NOT NULL,
	customer_contact TEXT,
	order_date TEXT,
	due_date TEXT NOT NULL,
	due_time TEXT,
	delivery_type TEXT NOT NULL DEFAULT 'pickup' CHECK (delivery_type IN ('pickup', 'delivery')),
	delivery_address TEXT,
	delivery_window_start TEXT,
	delivery_window_end TEXT,
	theme TEXT,
	description TEXT,
	dimensions TEXT,
	servings TEXT,
	flavors TEXT,
	price REAL,
	deposit_amount REAL,
	deposit_paid INTEGER NOT NULL DEFAULT 0,
	notes TEXT,
	google_event_id TEXT,
	reminder_offsets TEXT NOT NULL DEFAULT '[2880]',
	created_at TEXT NOT NULL DEFAULT (datetime('now')),
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS order_items (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
	type TEXT NOT NULL DEFAULT 'cake',
	theme TEXT,
	dimensions TEXT,
	servings TEXT,
	flavors TEXT,
	count INTEGER,
	price REAL,
	notes TEXT,
	tier_count INTEGER,
	tier_details TEXT NOT NULL DEFAULT '[]',
	sort_order INTEGER NOT NULL DEFAULT 0
);

INSERT INTO order_items (order_id, type, dimensions, servings, flavors, price, sort_order)
SELECT id, 'cake', dimensions, servings, flavors, price, 0
FROM orders
WHERE NOT EXISTS (
	SELECT 1
	FROM order_items
	WHERE order_items.order_id = orders.id
)
AND (
	dimensions IS NOT NULL
	OR servings IS NOT NULL
	OR flavors IS NOT NULL
	OR price IS NOT NULL
);

CREATE TABLE IF NOT EXISTS needed_items (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
	label TEXT NOT NULL,
	done INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tags (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS order_tags (
	order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
	tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
	PRIMARY KEY (order_id, tag_id)
);

CREATE TABLE IF NOT EXISTS photos (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
	file_path TEXT NOT NULL,
	sort_order INTEGER NOT NULL DEFAULT 0,
	is_cover INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS recipes (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	ingredients TEXT NOT NULL DEFAULT '[]',
	instructions TEXT
);

CREATE TABLE IF NOT EXISTS order_recipes (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
	recipe_name TEXT NOT NULL,
	ingredients TEXT NOT NULL DEFAULT '[]',
	instructions TEXT
);

CREATE TABLE IF NOT EXISTS settings (
	key TEXT PRIMARY KEY,
	value TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_status_due_date ON orders(status, due_date);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_needed_items_order_id ON needed_items(order_id);
CREATE INDEX IF NOT EXISTS idx_photos_order_id ON photos(order_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_order_recipes_order_id ON order_recipes(order_id);
