# Whipped Wisps — Cake Order & Archive App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a self-hosted (Raspberry Pi 5) personal web app to schedule cake orders, sync them to Google Calendar, and archive completed orders into a searchable, recipe-page-style CMS.

**Architecture:** Express (Node.js) REST API backed by a single SQLite file (via `better-sqlite3`), serving a Vite-built React SPA as static assets in production (one process, no separate frontend server). No auth layer — Tailscale is the sole access gate.

**Tech Stack:** Node.js, Express, better-sqlite3, multer (file uploads), googleapis (Calendar API), React, Vite, react-router-dom, Vitest + supertest (testing).

## Global Constraints

- No login/auth on the app — Tailscale is the only access gate (per spec).
- No Playwright / browser E2E tests — manual verification in-browser, automated tests are unit/integration only (per spec and global instructions).
- SQLite DB file and `uploads/` directory must live outside the app's source tree at runtime (configurable via env var), never assumed to be inside the repo.
- Archiving is a manual status flip only — never automatic/date-driven (per spec).
- Attaching a Recipe template to an order **copies** its fields into a new, independently-editable `OrderRecipe` row — template edits must never retroactively change past orders, and order-level edits must never touch the template (per spec).
- Calendar sync failures must never block an order save (per spec) — sync errors are caught and surfaced, not thrown to the client as a failed save.

---

## File Structure Overview

```
whippedwisps/
  package.json                 # npm workspaces root: ["server", "client"]
  .gitignore
  server/
    package.json
    src/
      app.js                    # express app (routes mounted, static serving in prod)
      server.js                 # entry point: creates DB, starts listening
      db/
        connection.js           # opens better-sqlite3 DB, runs schema.sql once
        schema.sql
        orders.js
        neededItems.js
        tags.js
        photos.js
        recipes.js
        orderRecipes.js
        settings.js
      routes/
        orders.js
        neededItems.js
        tags.js
        photos.js
        recipes.js
        orderRecipes.js
        settingsCalendar.js
      services/
        slug.js
        calendar.js
      middleware/
        errorHandler.js
    tests/
      db/*.test.js
      routes/*.test.js
      services/*.test.js
  client/
    package.json
    vite.config.js
    index.html
    src/
      main.jsx
      App.jsx
      api/client.js
      pages/
        Dashboard.jsx
        OrderForm.jsx
        Archive.jsx
        ArchiveDetail.jsx
        Recipes.jsx
        Settings.jsx
      components/
        CalendarGrid.jsx
        UpcomingList.jsx
        NeededItemsChecklist.jsx
        PhotoUploader.jsx
        TagInput.jsx
        RecipeAttach.jsx
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json` (root, npm workspaces)
- Create: `.gitignore`
- Create: `server/package.json`
- Create: `client/package.json` (via `npm create vite@latest`)
- Create: `server/src/server.js` (placeholder listener)

**Interfaces:**
- Consumes: nothing (first task)
- Produces: a runnable `npm run dev:server` and `npm run dev:client` from repo root; `server/src/server.js` exports nothing yet, just listens on `process.env.PORT || 3001`.

- [ ] **Step 1: Create root `package.json` with workspaces**

```json
{
  "name": "whippedwisps",
  "private": true,
  "workspaces": ["server", "client"],
  "scripts": {
    "dev:server": "npm run dev -w server",
    "dev:client": "npm run dev -w client",
    "test:server": "npm run test -w server",
    "build:client": "npm run build -w client"
  }
}
```

- [ ] **Step 2: Create `.gitignore`**

```
node_modules/
dist/
*.db
uploads/
.env
```

- [ ] **Step 3: Scaffold the client with Vite**

Run: `npm create vite@latest client -- --template react`

- [ ] **Step 4: Create `server/package.json`**

```json
{
  "name": "server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "node --watch src/server.js",
    "start": "node src/server.js",
    "test": "vitest run"
  },
  "dependencies": {
    "better-sqlite3": "^11.3.0",
    "express": "^4.19.2",
    "multer": "^1.4.5-lts.1",
    "googleapis": "^140.0.1",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "vitest": "^2.1.1",
    "supertest": "^7.0.0"
  }
}
```

- [ ] **Step 5: Install dependencies**

Run: `npm install` (from repo root — installs both workspaces)

- [ ] **Step 6: Create placeholder `server/src/server.js`**

```js
import http from 'node:http';

const port = process.env.PORT || 3001;
http.createServer((req, res) => res.end('ok')).listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
```

- [ ] **Step 7: Verify server starts**

Run: `npm run dev:server`
Expected: prints `Server listening on port 3001`. Stop with Ctrl+C.

- [ ] **Step 8: Commit**

```bash
git add package.json .gitignore server/package.json server/src/server.js client/
git commit -m "chore: scaffold npm workspaces for server and client"
```

---

## Task 2: SQLite Schema & Connection Module

**Files:**
- Create: `server/src/db/schema.sql`
- Create: `server/src/db/connection.js`
- Test: `server/tests/db/connection.test.js`

**Interfaces:**
- Consumes: nothing beyond Task 1's `better-sqlite3` dependency.
- Produces: `getDb()` — a function in `server/src/db/connection.js` returning a singleton `better-sqlite3` `Database` instance, with the schema already applied. `getDb()` reads the DB file path from `process.env.DB_PATH` (defaulting to `./data/whippedwisps.db` for local dev), creating the parent directory if missing.

- [ ] **Step 1: Write `schema.sql`**

```sql
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  customer_name TEXT NOT NULL,
  customer_contact TEXT,
  order_date TEXT,
  due_date TEXT NOT NULL,
  due_time TEXT,
  delivery_type TEXT NOT NULL DEFAULT 'pickup',
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
  reminder_offsets TEXT NOT NULL DEFAULT '[1440]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
```

- [ ] **Step 2: Write the failing test**

```js
// server/tests/db/connection.test.js
import { test, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB = path.resolve('./tests/tmp/test-connection.db');

beforeEach(() => {
  fs.rmSync(TEST_DB, { force: true });
  process.env.DB_PATH = TEST_DB;
});

test('getDb creates the database file and applies schema', async () => {
  const { getDb } = await import('../../src/db/connection.js?t=' + Date.now());
  const db = getDb();
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .map((r) => r.name);
  expect(tables).toContain('orders');
  expect(tables).toContain('recipes');
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test -w server -- connection.test.js`
Expected: FAIL — `connection.js` does not exist.

- [ ] **Step 4: Write `server/src/db/connection.js`**

```js
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db;

export function getDb() {
  if (db) return db;

  const dbPath = process.env.DB_PATH || path.resolve('./data/whippedwisps.db');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  db = new Database(dbPath);
  db.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  db.exec(schema);

  return db;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -w server -- connection.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/db/schema.sql server/src/db/connection.js server/tests/db/connection.test.js
git commit -m "feat: add SQLite schema and connection module"
```

---

## Task 3: Slug Generation Utility

**Files:**
- Create: `server/src/services/slug.js`
- Test: `server/tests/services/slug.test.js`

**Interfaces:**
- Produces: `generateSlug({ theme, customerName }, existingSlugsSet)` → string. Builds a kebab-case slug from `theme` + `customerName`; if the result is already in `existingSlugsSet`, appends `-2`, `-3`, etc. until unique. Pure function — no DB access — so the DB layer (Task 4) supplies the set of existing slugs.

- [ ] **Step 1: Write the failing test**

```js
// server/tests/services/slug.test.js
import { test, expect } from 'vitest';
import { generateSlug } from '../../src/services/slug.js';

test('builds kebab-case slug from theme and customer name', () => {
  expect(generateSlug({ theme: 'Dinosaur Jungle', customerName: 'Jane Doe' }, new Set()))
    .toBe('dinosaur-jungle-jane-doe');
});

test('appends numeric suffix on collision', () => {
  const existing = new Set(['dinosaur-jungle-jane-doe']);
  expect(generateSlug({ theme: 'Dinosaur Jungle', customerName: 'Jane Doe' }, existing))
    .toBe('dinosaur-jungle-jane-doe-2');
});

test('strips punctuation and collapses whitespace', () => {
  expect(generateSlug({ theme: "Kid's 5th B-day!", customerName: 'Sam' }, new Set()))
    .toBe('kids-5th-b-day-sam');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w server -- slug.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `server/src/services/slug.js`**

```js
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function generateSlug({ theme, customerName }, existingSlugsSet) {
  const base = slugify(`${theme || ''} ${customerName || ''}`.trim());
  if (!existingSlugsSet.has(base)) return base;

  let n = 2;
  while (existingSlugsSet.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w server -- slug.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/services/slug.js server/tests/services/slug.test.js
git commit -m "feat: add slug generation utility"
```

---

## Task 4: Order Data Layer

**Files:**
- Create: `server/src/db/orders.js`
- Test: `server/tests/db/orders.test.js`

**Interfaces:**
- Consumes: `getDb()` from Task 2, `generateSlug()` from Task 3.
- Produces (used by Task 8 routes and later tasks):
  - `createOrder(data)` → order object (camelCase, includes `id`, `slug`, `status: 'scheduled'`, `tags: []`, `reminderOffsets: number[]`)
  - `getOrderById(id)` → order object or `undefined`
  - `getOrderBySlug(slug)` → order object or `undefined`
  - `listOrders({ status })` → array of orders, `due_date` ascending
  - `updateOrder(id, data)` → updated order object or `undefined` if not found
  - `archiveOrder(id)` → updated order object with `status: 'archived'`
  - `deleteOrder(id)` → `boolean` (true if a row was deleted)
  - `searchArchivedOrders(query)` → array of orders whose `customerName`, `theme`, `description`, or `flavors` case-insensitively contain `query`, OR whose tags (joined) contain it
  - All returned order objects have shape: `{ id, slug, status, customerName, customerContact, orderDate, dueDate, dueTime, deliveryType, deliveryAddress, deliveryWindowStart, deliveryWindowEnd, theme, description, dimensions, servings, flavors, price, depositAmount, depositPaid, notes, googleEventId, reminderOffsets, createdAt, updatedAt }` (tags/photos/neededItems/recipes are attached by the route layer from their own modules, not by this file)

- [ ] **Step 1: Write the failing test**

```js
// server/tests/db/orders.test.js
import { test, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB = path.resolve('./tests/tmp/test-orders.db');
let orders;

beforeEach(async () => {
  fs.rmSync(TEST_DB, { force: true });
  process.env.DB_PATH = TEST_DB;
  const connMod = await import('../../src/db/connection.js?t=' + Math.random());
  connMod.getDb();
  orders = await import('../../src/db/orders.js?t=' + Math.random());
});

test('createOrder generates a slug and defaults status to scheduled', () => {
  const order = orders.createOrder({
    customerName: 'Jane Doe',
    theme: 'Dinosaur Jungle',
    dueDate: '2026-09-01',
  });
  expect(order.slug).toBe('dinosaur-jungle-jane-doe');
  expect(order.status).toBe('scheduled');
  expect(order.id).toBeTypeOf('number');
});

test('createOrder deduplicates slugs across orders', () => {
  orders.createOrder({ customerName: 'Jane Doe', theme: 'Dinosaur Jungle', dueDate: '2026-09-01' });
  const second = orders.createOrder({ customerName: 'Jane Doe', theme: 'Dinosaur Jungle', dueDate: '2026-10-01' });
  expect(second.slug).toBe('dinosaur-jungle-jane-doe-2');
});

test('getOrderById returns undefined for missing order', () => {
  expect(orders.getOrderById(999)).toBeUndefined();
});

test('listOrders filters by status', () => {
  const a = orders.createOrder({ customerName: 'A', theme: 'X', dueDate: '2026-09-01' });
  orders.archiveOrder(a.id);
  orders.createOrder({ customerName: 'B', theme: 'Y', dueDate: '2026-09-02' });

  expect(orders.listOrders({ status: 'archived' })).toHaveLength(1);
  expect(orders.listOrders({ status: 'scheduled' })).toHaveLength(1);
});

test('updateOrder updates fields and returns the updated order', () => {
  const created = orders.createOrder({ customerName: 'Jane', theme: 'X', dueDate: '2026-09-01' });
  const updated = orders.updateOrder(created.id, { price: 120.5, notes: 'extra sprinkles' });
  expect(updated.price).toBe(120.5);
  expect(updated.notes).toBe('extra sprinkles');
});

test('deleteOrder removes the row and returns true', () => {
  const created = orders.createOrder({ customerName: 'Jane', theme: 'X', dueDate: '2026-09-01' });
  expect(orders.deleteOrder(created.id)).toBe(true);
  expect(orders.getOrderById(created.id)).toBeUndefined();
  expect(orders.deleteOrder(created.id)).toBe(false);
});

test('searchArchivedOrders matches customer name, theme, description, and flavors', () => {
  const a = orders.createOrder({ customerName: 'Jane Doe', theme: 'Dinosaur Jungle', dueDate: '2026-09-01', flavors: 'chocolate' });
  orders.archiveOrder(a.id);
  const b = orders.createOrder({ customerName: 'Sam Lee', theme: 'Space Race', dueDate: '2026-09-02', flavors: 'vanilla' });
  orders.archiveOrder(b.id);

  expect(orders.searchArchivedOrders('dinosaur').map((o) => o.id)).toEqual([a.id]);
  expect(orders.searchArchivedOrders('chocolate').map((o) => o.id)).toEqual([a.id]);
  expect(orders.searchArchivedOrders('sam').map((o) => o.id)).toEqual([b.id]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w server -- orders.test.js`
Expected: FAIL — `orders.js` does not exist.

- [ ] **Step 3: Write `server/src/db/orders.js`**

```js
import { getDb } from './connection.js';
import { generateSlug } from '../services/slug.js';

function rowToOrder(row) {
  if (!row) return undefined;
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
    depositPaid: !!row.deposit_paid,
    notes: row.notes,
    googleEventId: row.google_event_id,
    reminderOffsets: JSON.parse(row.reminder_offsets),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function existingSlugs(db) {
  return new Set(db.prepare('SELECT slug FROM orders').all().map((r) => r.slug));
}

export function createOrder(data) {
  const db = getDb();
  const slug = generateSlug(data, existingSlugs(db));

  const stmt = db.prepare(`
    INSERT INTO orders (
      slug, status, customer_name, customer_contact, order_date, due_date, due_time,
      delivery_type, delivery_address, delivery_window_start, delivery_window_end,
      theme, description, dimensions, servings, flavors, price, deposit_amount,
      deposit_paid, notes, reminder_offsets
    ) VALUES (
      @slug, 'scheduled', @customerName, @customerContact, @orderDate, @dueDate, @dueTime,
      @deliveryType, @deliveryAddress, @deliveryWindowStart, @deliveryWindowEnd,
      @theme, @description, @dimensions, @servings, @flavors, @price, @depositAmount,
      @depositPaid, @notes, @reminderOffsets
    )
  `);

  const info = stmt.run({
    slug,
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
    price: data.price ?? null,
    depositAmount: data.depositAmount ?? null,
    depositPaid: data.depositPaid ? 1 : 0,
    notes: data.notes ?? null,
    reminderOffsets: JSON.stringify(data.reminderOffsets ?? [1440]),
  });

  return getOrderById(info.lastInsertRowid);
}

export function getOrderById(id) {
  const db = getDb();
  return rowToOrder(db.prepare('SELECT * FROM orders WHERE id = ?').get(id));
}

export function getOrderBySlug(slug) {
  const db = getDb();
  return rowToOrder(db.prepare('SELECT * FROM orders WHERE slug = ?').get(slug));
}

export function listOrders({ status } = {}) {
  const db = getDb();
  const rows = status
    ? db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY due_date ASC').all(status)
    : db.prepare('SELECT * FROM orders ORDER BY due_date ASC').all();
  return rows.map(rowToOrder);
}

const UPDATABLE_FIELDS = {
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
  reminderOffsets: 'reminder_offsets',
};

export function updateOrder(id, data) {
  const db = getDb();
  const existing = getOrderById(id);
  if (!existing) return undefined;

  const sets = [];
  const params = { id };
  for (const [jsKey, column] of Object.entries(UPDATABLE_FIELDS)) {
    if (!(jsKey in data)) continue;
    sets.push(`${column} = @${jsKey}`);
    let value = data[jsKey];
    if (jsKey === 'depositPaid') value = value ? 1 : 0;
    if (jsKey === 'reminderOffsets') value = JSON.stringify(value);
    params[jsKey] = value ?? null;
  }
  if (sets.length === 0) return existing;

  sets.push("updated_at = datetime('now')");
  db.prepare(`UPDATE orders SET ${sets.join(', ')} WHERE id = @id`).run(params);
  return getOrderById(id);
}

export function archiveOrder(id) {
  const db = getDb();
  db.prepare("UPDATE orders SET status = 'archived', updated_at = datetime('now') WHERE id = ?").run(id);
  return getOrderById(id);
}

export function deleteOrder(id) {
  const db = getDb();
  const info = db.prepare('DELETE FROM orders WHERE id = ?').run(id);
  return info.changes > 0;
}

export function searchArchivedOrders(query) {
  const db = getDb();
  const like = `%${query.toLowerCase()}%`;
  const rows = db.prepare(`
    SELECT DISTINCT o.* FROM orders o
    LEFT JOIN order_tags ot ON ot.order_id = o.id
    LEFT JOIN tags t ON t.id = ot.tag_id
    WHERE o.status = 'archived'
      AND (
        LOWER(o.customer_name) LIKE @like
        OR LOWER(o.theme) LIKE @like
        OR LOWER(o.description) LIKE @like
        OR LOWER(o.flavors) LIKE @like
        OR LOWER(t.name) LIKE @like
      )
    ORDER BY o.due_date DESC
  `).all({ like });
  return rows.map(rowToOrder);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w server -- orders.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/db/orders.js server/tests/db/orders.test.js
git commit -m "feat: add order data layer with CRUD, archiving, and search"
```

---

## Task 5: Needed Items & Tags Data Layer

**Files:**
- Create: `server/src/db/neededItems.js`
- Create: `server/src/db/tags.js`
- Test: `server/tests/db/neededItems.test.js`
- Test: `server/tests/db/tags.test.js`

**Interfaces:**
- Produces (`neededItems.js`, used by Task 9 routes):
  - `addNeededItem(orderId, label)` → `{ id, orderId, label, done: false }`
  - `listNeededItems(orderId)` → array, insertion order
  - `updateNeededItem(id, { label, done })` → updated item or `undefined`
  - `deleteNeededItem(id)` → `boolean`
- Produces (`tags.js`, used by Task 9 routes and Task 4's search):
  - `setOrderTags(orderId, tagNames)` → replaces all tags for the order with the given array of strings (creating any new `tags` rows as needed); returns `string[]` of the resulting tag names
  - `getOrderTags(orderId)` → `string[]`

- [ ] **Step 1: Write the failing tests**

```js
// server/tests/db/neededItems.test.js
import { test, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB = path.resolve('./tests/tmp/test-needed-items.db');
let neededItems, orders;

beforeEach(async () => {
  fs.rmSync(TEST_DB, { force: true });
  process.env.DB_PATH = TEST_DB;
  const connMod = await import('../../src/db/connection.js?t=' + Math.random());
  connMod.getDb();
  orders = await import('../../src/db/orders.js?t=' + Math.random());
  neededItems = await import('../../src/db/neededItems.js?t=' + Math.random());
});

test('addNeededItem creates an unchecked item', () => {
  const order = orders.createOrder({ customerName: 'A', theme: 'X', dueDate: '2026-09-01' });
  const item = neededItems.addNeededItem(order.id, 'Cake board 12in');
  expect(item.label).toBe('Cake board 12in');
  expect(item.done).toBe(false);
});

test('listNeededItems returns items for an order', () => {
  const order = orders.createOrder({ customerName: 'A', theme: 'X', dueDate: '2026-09-01' });
  neededItems.addNeededItem(order.id, 'Boxes');
  neededItems.addNeededItem(order.id, 'Toppers');
  expect(neededItems.listNeededItems(order.id)).toHaveLength(2);
});

test('updateNeededItem toggles done', () => {
  const order = orders.createOrder({ customerName: 'A', theme: 'X', dueDate: '2026-09-01' });
  const item = neededItems.addNeededItem(order.id, 'Boxes');
  const updated = neededItems.updateNeededItem(item.id, { done: true });
  expect(updated.done).toBe(true);
});

test('deleteNeededItem removes the row', () => {
  const order = orders.createOrder({ customerName: 'A', theme: 'X', dueDate: '2026-09-01' });
  const item = neededItems.addNeededItem(order.id, 'Boxes');
  expect(neededItems.deleteNeededItem(item.id)).toBe(true);
  expect(neededItems.listNeededItems(order.id)).toHaveLength(0);
});
```

```js
// server/tests/db/tags.test.js
import { test, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB = path.resolve('./tests/tmp/test-tags.db');
let tags, orders;

beforeEach(async () => {
  fs.rmSync(TEST_DB, { force: true });
  process.env.DB_PATH = TEST_DB;
  const connMod = await import('../../src/db/connection.js?t=' + Math.random());
  connMod.getDb();
  orders = await import('../../src/db/orders.js?t=' + Math.random());
  tags = await import('../../src/db/tags.js?t=' + Math.random());
});

test('setOrderTags creates new tags and links them', () => {
  const order = orders.createOrder({ customerName: 'A', theme: 'X', dueDate: '2026-09-01' });
  const result = tags.setOrderTags(order.id, ['wedding', '3-tier']);
  expect(result.sort()).toEqual(['3-tier', 'wedding']);
  expect(tags.getOrderTags(order.id).sort()).toEqual(['3-tier', 'wedding']);
});

test('setOrderTags reuses existing tag rows and replaces the previous set', () => {
  const orderA = orders.createOrder({ customerName: 'A', theme: 'X', dueDate: '2026-09-01' });
  const orderB = orders.createOrder({ customerName: 'B', theme: 'Y', dueDate: '2026-09-02' });
  tags.setOrderTags(orderA.id, ['wedding']);
  tags.setOrderTags(orderB.id, ['wedding']);
  tags.setOrderTags(orderA.id, ['birthday']);

  expect(tags.getOrderTags(orderA.id)).toEqual(['birthday']);
  expect(tags.getOrderTags(orderB.id)).toEqual(['wedding']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -w server -- neededItems.test.js tags.test.js`
Expected: FAIL — modules do not exist.

- [ ] **Step 3: Write `server/src/db/neededItems.js`**

```js
import { getDb } from './connection.js';

function rowToItem(row) {
  if (!row) return undefined;
  return { id: row.id, orderId: row.order_id, label: row.label, done: !!row.done };
}

export function addNeededItem(orderId, label) {
  const db = getDb();
  const info = db.prepare('INSERT INTO needed_items (order_id, label, done) VALUES (?, ?, 0)').run(orderId, label);
  return rowToItem(db.prepare('SELECT * FROM needed_items WHERE id = ?').get(info.lastInsertRowid));
}

export function listNeededItems(orderId) {
  const db = getDb();
  return db.prepare('SELECT * FROM needed_items WHERE order_id = ? ORDER BY id ASC').all(orderId).map(rowToItem);
}

export function updateNeededItem(id, { label, done } = {}) {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM needed_items WHERE id = ?').get(id);
  if (!existing) return undefined;

  db.prepare('UPDATE needed_items SET label = ?, done = ? WHERE id = ?').run(
    label ?? existing.label,
    done === undefined ? existing.done : (done ? 1 : 0),
    id
  );
  return rowToItem(db.prepare('SELECT * FROM needed_items WHERE id = ?').get(id));
}

export function deleteNeededItem(id) {
  const db = getDb();
  const info = db.prepare('DELETE FROM needed_items WHERE id = ?').run(id);
  return info.changes > 0;
}
```

- [ ] **Step 4: Write `server/src/db/tags.js`**

```js
import { getDb } from './connection.js';

function getOrCreateTagId(db, name) {
  const existing = db.prepare('SELECT id FROM tags WHERE name = ?').get(name);
  if (existing) return existing.id;
  return db.prepare('INSERT INTO tags (name) VALUES (?)').run(name).lastInsertRowid;
}

export function setOrderTags(orderId, tagNames) {
  const db = getDb();
  const tx = db.transaction((names) => {
    db.prepare('DELETE FROM order_tags WHERE order_id = ?').run(orderId);
    for (const name of names) {
      const tagId = getOrCreateTagId(db, name);
      db.prepare('INSERT OR IGNORE INTO order_tags (order_id, tag_id) VALUES (?, ?)').run(orderId, tagId);
    }
  });
  tx(tagNames);
  return getOrderTags(orderId);
}

export function getOrderTags(orderId) {
  const db = getDb();
  return db.prepare(`
    SELECT t.name FROM tags t
    JOIN order_tags ot ON ot.tag_id = t.id
    WHERE ot.order_id = ?
    ORDER BY t.name ASC
  `).all(orderId).map((r) => r.name);
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test -w server -- neededItems.test.js tags.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/db/neededItems.js server/src/db/tags.js server/tests/db/neededItems.test.js server/tests/db/tags.test.js
git commit -m "feat: add needed items and tags data layer"
```

---

## Task 6: Photo Data Layer

**Files:**
- Create: `server/src/db/photos.js`
- Test: `server/tests/db/photos.test.js`

**Interfaces:**
- Produces (used by Task 10 routes):
  - `addPhoto(orderId, filePath)` → `{ id, orderId, filePath, sortOrder, isCover }`. The first photo added for an order is automatically `isCover: true`.
  - `listPhotos(orderId)` → array ordered by `sortOrder` ascending
  - `deletePhoto(id)` → the deleted photo's `filePath` string (so the route layer can `fs.unlink` it), or `undefined` if not found
  - `setCoverPhoto(orderId, photoId)` → unsets `isCover` on all other photos for the order, sets it on `photoId`; returns updated photo list

- [ ] **Step 1: Write the failing test**

```js
// server/tests/db/photos.test.js
import { test, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB = path.resolve('./tests/tmp/test-photos.db');
let photos, orders;

beforeEach(async () => {
  fs.rmSync(TEST_DB, { force: true });
  process.env.DB_PATH = TEST_DB;
  const connMod = await import('../../src/db/connection.js?t=' + Math.random());
  connMod.getDb();
  orders = await import('../../src/db/orders.js?t=' + Math.random());
  photos = await import('../../src/db/photos.js?t=' + Math.random());
});

test('first photo added for an order is the cover', () => {
  const order = orders.createOrder({ customerName: 'A', theme: 'X', dueDate: '2026-09-01' });
  const p1 = photos.addPhoto(order.id, 'uploads/1/a.jpg');
  const p2 = photos.addPhoto(order.id, 'uploads/1/b.jpg');
  expect(p1.isCover).toBe(true);
  expect(p2.isCover).toBe(false);
});

test('listPhotos returns photos ordered by sortOrder', () => {
  const order = orders.createOrder({ customerName: 'A', theme: 'X', dueDate: '2026-09-01' });
  photos.addPhoto(order.id, 'a.jpg');
  photos.addPhoto(order.id, 'b.jpg');
  const list = photos.listPhotos(order.id);
  expect(list.map((p) => p.filePath)).toEqual(['a.jpg', 'b.jpg']);
});

test('setCoverPhoto moves the cover flag', () => {
  const order = orders.createOrder({ customerName: 'A', theme: 'X', dueDate: '2026-09-01' });
  const p1 = photos.addPhoto(order.id, 'a.jpg');
  const p2 = photos.addPhoto(order.id, 'b.jpg');
  photos.setCoverPhoto(order.id, p2.id);
  const list = photos.listPhotos(order.id);
  expect(list.find((p) => p.id === p1.id).isCover).toBe(false);
  expect(list.find((p) => p.id === p2.id).isCover).toBe(true);
});

test('deletePhoto returns the file path and removes the row', () => {
  const order = orders.createOrder({ customerName: 'A', theme: 'X', dueDate: '2026-09-01' });
  const p1 = photos.addPhoto(order.id, 'a.jpg');
  expect(photos.deletePhoto(p1.id)).toBe('a.jpg');
  expect(photos.listPhotos(order.id)).toHaveLength(0);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w server -- photos.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `server/src/db/photos.js`**

```js
import { getDb } from './connection.js';

function rowToPhoto(row) {
  if (!row) return undefined;
  return { id: row.id, orderId: row.order_id, filePath: row.file_path, sortOrder: row.sort_order, isCover: !!row.is_cover };
}

export function addPhoto(orderId, filePath) {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) AS n FROM photos WHERE order_id = ?').get(orderId).n;
  const info = db.prepare(
    'INSERT INTO photos (order_id, file_path, sort_order, is_cover) VALUES (?, ?, ?, ?)'
  ).run(orderId, filePath, count, count === 0 ? 1 : 0);
  return rowToPhoto(db.prepare('SELECT * FROM photos WHERE id = ?').get(info.lastInsertRowid));
}

export function listPhotos(orderId) {
  const db = getDb();
  return db.prepare('SELECT * FROM photos WHERE order_id = ? ORDER BY sort_order ASC').all(orderId).map(rowToPhoto);
}

export function deletePhoto(id) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM photos WHERE id = ?').get(id);
  if (!row) return undefined;
  db.prepare('DELETE FROM photos WHERE id = ?').run(id);
  return row.file_path;
}

export function setCoverPhoto(orderId, photoId) {
  const db = getDb();
  const tx = db.transaction(() => {
    db.prepare('UPDATE photos SET is_cover = 0 WHERE order_id = ?').run(orderId);
    db.prepare('UPDATE photos SET is_cover = 1 WHERE id = ? AND order_id = ?').run(photoId, orderId);
  });
  tx();
  return listPhotos(orderId);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w server -- photos.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/db/photos.js server/tests/db/photos.test.js
git commit -m "feat: add photo data layer with cover photo tracking"
```

---

## Task 7: Recipe & OrderRecipe Data Layer

**Files:**
- Create: `server/src/db/recipes.js`
- Create: `server/src/db/orderRecipes.js`
- Test: `server/tests/db/recipes.test.js`
- Test: `server/tests/db/orderRecipes.test.js`

**Interfaces:**
- Produces (`recipes.js`, used by Task 11 routes):
  - `createRecipe({ name, ingredients, instructions })` → `{ id, name, ingredients: [{item,quantity,unit}], instructions }`
  - `listRecipes()` → array
  - `getRecipeById(id)` → recipe or `undefined`
  - `updateRecipe(id, data)` → updated recipe or `undefined`
  - `deleteRecipe(id)` → `boolean`
- Produces (`orderRecipes.js`, used by Task 11 routes):
  - `attachRecipeToOrder(orderId, recipeId)` → reads the `Recipe` template via `getRecipeById`, copies `name`/`ingredients`/`instructions` into a new `order_recipes` row, returns `{ id, orderId, recipeName, ingredients, instructions }`. Throws `Error('Recipe not found')` if `recipeId` doesn't exist.
  - `listOrderRecipes(orderId)` → array
  - `updateOrderRecipe(id, data)` → updated order-recipe or `undefined` (edits only the copy, never the template)
  - `deleteOrderRecipe(id)` → `boolean`

- [ ] **Step 1: Write the failing tests**

```js
// server/tests/db/recipes.test.js
import { test, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB = path.resolve('./tests/tmp/test-recipes.db');
let recipes;

beforeEach(async () => {
  fs.rmSync(TEST_DB, { force: true });
  process.env.DB_PATH = TEST_DB;
  const connMod = await import('../../src/db/connection.js?t=' + Math.random());
  connMod.getDb();
  recipes = await import('../../src/db/recipes.js?t=' + Math.random());
});

test('createRecipe stores structured ingredients', () => {
  const recipe = recipes.createRecipe({
    name: 'Vanilla Sponge',
    ingredients: [{ item: 'flour', quantity: 2, unit: 'cups' }],
    instructions: 'Mix and bake at 350F.',
  });
  expect(recipe.name).toBe('Vanilla Sponge');
  expect(recipe.ingredients).toEqual([{ item: 'flour', quantity: 2, unit: 'cups' }]);
});

test('updateRecipe changes fields', () => {
  const recipe = recipes.createRecipe({ name: 'Vanilla Sponge', ingredients: [], instructions: '' });
  const updated = recipes.updateRecipe(recipe.id, { instructions: 'Bake at 325F instead.' });
  expect(updated.instructions).toBe('Bake at 325F instead.');
});

test('deleteRecipe removes the row', () => {
  const recipe = recipes.createRecipe({ name: 'Vanilla Sponge', ingredients: [], instructions: '' });
  expect(recipes.deleteRecipe(recipe.id)).toBe(true);
  expect(recipes.getRecipeById(recipe.id)).toBeUndefined();
});
```

```js
// server/tests/db/orderRecipes.test.js
import { test, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB = path.resolve('./tests/tmp/test-order-recipes.db');
let recipes, orderRecipes, orders;

beforeEach(async () => {
  fs.rmSync(TEST_DB, { force: true });
  process.env.DB_PATH = TEST_DB;
  const connMod = await import('../../src/db/connection.js?t=' + Math.random());
  connMod.getDb();
  orders = await import('../../src/db/orders.js?t=' + Math.random());
  recipes = await import('../../src/db/recipes.js?t=' + Math.random());
  orderRecipes = await import('../../src/db/orderRecipes.js?t=' + Math.random());
});

test('attachRecipeToOrder copies the template into a new order_recipe row', () => {
  const order = orders.createOrder({ customerName: 'A', theme: 'X', dueDate: '2026-09-01' });
  const template = recipes.createRecipe({
    name: 'Vanilla Sponge',
    ingredients: [{ item: 'flour', quantity: 2, unit: 'cups' }],
    instructions: 'Mix and bake.',
  });

  const attached = orderRecipes.attachRecipeToOrder(order.id, template.id);
  expect(attached.recipeName).toBe('Vanilla Sponge');
  expect(attached.ingredients).toEqual([{ item: 'flour', quantity: 2, unit: 'cups' }]);
});

test('editing the order-recipe copy does not change the template', () => {
  const order = orders.createOrder({ customerName: 'A', theme: 'X', dueDate: '2026-09-01' });
  const template = recipes.createRecipe({ name: 'Vanilla Sponge', ingredients: [], instructions: 'Original.' });
  const attached = orderRecipes.attachRecipeToOrder(order.id, template.id);

  orderRecipes.updateOrderRecipe(attached.id, { instructions: 'Added extra almond extract for this order.' });

  const templateAfter = recipes.getRecipeById(template.id);
  expect(templateAfter.instructions).toBe('Original.');
});

test('editing the template later does not change past order-recipe copies', () => {
  const order = orders.createOrder({ customerName: 'A', theme: 'X', dueDate: '2026-09-01' });
  const template = recipes.createRecipe({ name: 'Vanilla Sponge', ingredients: [], instructions: 'Original.' });
  const attached = orderRecipes.attachRecipeToOrder(order.id, template.id);

  recipes.updateRecipe(template.id, { instructions: 'New default instructions.' });

  const attachedAfter = orderRecipes.listOrderRecipes(order.id)[0];
  expect(attachedAfter.instructions).toBe('Original.');
});

test('attachRecipeToOrder throws for a missing template', () => {
  const order = orders.createOrder({ customerName: 'A', theme: 'X', dueDate: '2026-09-01' });
  expect(() => orderRecipes.attachRecipeToOrder(order.id, 999)).toThrow('Recipe not found');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -w server -- recipes.test.js orderRecipes.test.js`
Expected: FAIL — modules do not exist.

- [ ] **Step 3: Write `server/src/db/recipes.js`**

```js
import { getDb } from './connection.js';

function rowToRecipe(row) {
  if (!row) return undefined;
  return { id: row.id, name: row.name, ingredients: JSON.parse(row.ingredients), instructions: row.instructions };
}

export function createRecipe({ name, ingredients = [], instructions = '' }) {
  const db = getDb();
  const info = db.prepare('INSERT INTO recipes (name, ingredients, instructions) VALUES (?, ?, ?)')
    .run(name, JSON.stringify(ingredients), instructions);
  return getRecipeById(info.lastInsertRowid);
}

export function listRecipes() {
  const db = getDb();
  return db.prepare('SELECT * FROM recipes ORDER BY name ASC').all().map(rowToRecipe);
}

export function getRecipeById(id) {
  const db = getDb();
  return rowToRecipe(db.prepare('SELECT * FROM recipes WHERE id = ?').get(id));
}

export function updateRecipe(id, data) {
  const db = getDb();
  const existing = getRecipeById(id);
  if (!existing) return undefined;

  db.prepare('UPDATE recipes SET name = ?, ingredients = ?, instructions = ? WHERE id = ?').run(
    data.name ?? existing.name,
    JSON.stringify(data.ingredients ?? existing.ingredients),
    data.instructions ?? existing.instructions,
    id
  );
  return getRecipeById(id);
}

export function deleteRecipe(id) {
  const db = getDb();
  const info = db.prepare('DELETE FROM recipes WHERE id = ?').run(id);
  return info.changes > 0;
}
```

- [ ] **Step 4: Write `server/src/db/orderRecipes.js`**

```js
import { getDb } from './connection.js';
import { getRecipeById } from './recipes.js';

function rowToOrderRecipe(row) {
  if (!row) return undefined;
  return { id: row.id, orderId: row.order_id, recipeName: row.recipe_name, ingredients: JSON.parse(row.ingredients), instructions: row.instructions };
}

export function attachRecipeToOrder(orderId, recipeId) {
  const template = getRecipeById(recipeId);
  if (!template) throw new Error('Recipe not found');

  const db = getDb();
  const info = db.prepare(
    'INSERT INTO order_recipes (order_id, recipe_name, ingredients, instructions) VALUES (?, ?, ?, ?)'
  ).run(orderId, template.name, JSON.stringify(template.ingredients), template.instructions);

  return rowToOrderRecipe(db.prepare('SELECT * FROM order_recipes WHERE id = ?').get(info.lastInsertRowid));
}

export function listOrderRecipes(orderId) {
  const db = getDb();
  return db.prepare('SELECT * FROM order_recipes WHERE order_id = ? ORDER BY id ASC').all(orderId).map(rowToOrderRecipe);
}

export function updateOrderRecipe(id, data) {
  const db = getDb();
  const existing = rowToOrderRecipe(db.prepare('SELECT * FROM order_recipes WHERE id = ?').get(id));
  if (!existing) return undefined;

  db.prepare('UPDATE order_recipes SET recipe_name = ?, ingredients = ?, instructions = ? WHERE id = ?').run(
    data.recipeName ?? existing.recipeName,
    JSON.stringify(data.ingredients ?? existing.ingredients),
    data.instructions ?? existing.instructions,
    id
  );
  return rowToOrderRecipe(db.prepare('SELECT * FROM order_recipes WHERE id = ?').get(id));
}

export function deleteOrderRecipe(id) {
  const db = getDb();
  const info = db.prepare('DELETE FROM order_recipes WHERE id = ?').run(id);
  return info.changes > 0;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test -w server -- recipes.test.js orderRecipes.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/db/recipes.js server/src/db/orderRecipes.js server/tests/db/recipes.test.js server/tests/db/orderRecipes.test.js
git commit -m "feat: add recipe library and order-recipe copy-on-attach data layer"
```

---

## Task 8: Express App Setup & Order API Routes

**Files:**
- Create: `server/src/app.js`
- Create: `server/src/routes/orders.js`
- Create: `server/src/middleware/errorHandler.js`
- Modify: `server/src/server.js`
- Test: `server/tests/routes/orders.test.js`

**Interfaces:**
- Consumes: `orders.js`, `neededItems.js`, `tags.js` data layers (Tasks 4–5).
- Produces: an Express `app` (default export from `server/src/app.js`) mountable by `supertest` in tests and by `server.js` in production. Routes:
  - `POST /api/orders` — body: order fields (camelCase) → 201, full order object (with empty `tags: []`, `neededItems: []`)
  - `GET /api/orders?status=scheduled|archived` → 200, array of orders (each with `tags` and `neededItems` attached)
  - `GET /api/orders/:id` → 200, single order (with `tags`/`neededItems`) or 404
  - `GET /api/orders/slug/:slug` → same shape, looked up by slug (used by the archive detail page)
  - `PUT /api/orders/:id` → 200, updated order, or 404
  - `DELETE /api/orders/:id` → 204, or 404
  - `POST /api/orders/:id/archive` → 200, updated order with `status: 'archived'`, or 404
  - `GET /api/orders/search?q=...` → 200, array of matching archived orders
  - Response field shape for "order with attachments": the plain order object (per Task 4) plus `tags: string[]` and `neededItems: Array<{id, label, done}>`.

- [ ] **Step 1: Write the failing test**

```js
// server/tests/routes/orders.test.js
import { test, expect, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB = path.resolve('./tests/tmp/test-orders-routes.db');
let app;

beforeEach(async () => {
  fs.rmSync(TEST_DB, { force: true });
  process.env.DB_PATH = TEST_DB;
  const mod = await import('../../src/app.js?t=' + Math.random());
  app = mod.default;
});

test('POST /api/orders creates an order with empty tags and needed items', async () => {
  const res = await request(app).post('/api/orders').send({
    customerName: 'Jane Doe',
    theme: 'Dinosaur Jungle',
    dueDate: '2026-09-01',
  });
  expect(res.status).toBe(201);
  expect(res.body.slug).toBe('dinosaur-jungle-jane-doe');
  expect(res.body.tags).toEqual([]);
  expect(res.body.neededItems).toEqual([]);
});

test('GET /api/orders?status=scheduled lists only scheduled orders', async () => {
  await request(app).post('/api/orders').send({ customerName: 'A', theme: 'X', dueDate: '2026-09-01' });
  const res = await request(app).get('/api/orders?status=scheduled');
  expect(res.status).toBe(200);
  expect(res.body).toHaveLength(1);
});

test('GET /api/orders/:id 404s for a missing order', async () => {
  const res = await request(app).get('/api/orders/999');
  expect(res.status).toBe(404);
});

test('PUT /api/orders/:id updates fields', async () => {
  const created = await request(app).post('/api/orders').send({ customerName: 'A', theme: 'X', dueDate: '2026-09-01' });
  const res = await request(app).put(`/api/orders/${created.body.id}`).send({ price: 99.99 });
  expect(res.status).toBe(200);
  expect(res.body.price).toBe(99.99);
});

test('POST /api/orders/:id/archive flips status', async () => {
  const created = await request(app).post('/api/orders').send({ customerName: 'A', theme: 'X', dueDate: '2026-09-01' });
  const res = await request(app).post(`/api/orders/${created.body.id}/archive`);
  expect(res.body.status).toBe('archived');
});

test('DELETE /api/orders/:id removes the order', async () => {
  const created = await request(app).post('/api/orders').send({ customerName: 'A', theme: 'X', dueDate: '2026-09-01' });
  const del = await request(app).delete(`/api/orders/${created.body.id}`);
  expect(del.status).toBe(204);
  const get = await request(app).get(`/api/orders/${created.body.id}`);
  expect(get.status).toBe(404);
});

test('GET /api/orders/search searches archived orders', async () => {
  const created = await request(app).post('/api/orders').send({ customerName: 'Jane Doe', theme: 'Dinosaur Jungle', dueDate: '2026-09-01' });
  await request(app).post(`/api/orders/${created.body.id}/archive`);
  const res = await request(app).get('/api/orders/search?q=dinosaur');
  expect(res.body).toHaveLength(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w server -- routes/orders.test.js`
Expected: FAIL — `app.js` does not exist.

- [ ] **Step 3: Write `server/src/middleware/errorHandler.js`**

```js
export function errorHandler(err, req, res, next) {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
}
```

- [ ] **Step 4: Write `server/src/routes/orders.js`**

```js
import { Router } from 'express';
import * as orders from '../db/orders.js';
import * as neededItems from '../db/neededItems.js';
import * as tags from '../db/tags.js';

const router = Router();

function withAttachments(order) {
  if (!order) return undefined;
  return {
    ...order,
    tags: tags.getOrderTags(order.id),
    neededItems: neededItems.listNeededItems(order.id),
  };
}

router.post('/', (req, res) => {
  const order = orders.createOrder(req.body);
  res.status(201).json(withAttachments(order));
});

router.get('/search', (req, res) => {
  const results = orders.searchArchivedOrders(req.query.q || '');
  res.json(results.map(withAttachments));
});

router.get('/slug/:slug', (req, res) => {
  const order = orders.getOrderBySlug(req.params.slug);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(withAttachments(order));
});

router.get('/', (req, res) => {
  const results = orders.listOrders({ status: req.query.status });
  res.json(results.map(withAttachments));
});

router.get('/:id', (req, res) => {
  const order = orders.getOrderById(Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(withAttachments(order));
});

router.put('/:id', (req, res) => {
  const order = orders.updateOrder(Number(req.params.id), req.body);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(withAttachments(order));
});

router.post('/:id/archive', (req, res) => {
  const order = orders.archiveOrder(Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(withAttachments(order));
});

router.delete('/:id', (req, res) => {
  const deleted = orders.deleteOrder(Number(req.params.id));
  if (!deleted) return res.status(404).json({ error: 'Order not found' });
  res.status(204).end();
});

export default router;
```

- [ ] **Step 5: Write `server/src/app.js`**

```js
import express from 'express';
import cors from 'cors';
import ordersRouter from './routes/orders.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/orders', ordersRouter);

app.use(errorHandler);

export default app;
```

- [ ] **Step 6: Update `server/src/server.js`**

```js
import app from './app.js';

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
```

- [ ] **Step 7: Run test to verify it passes**

Run: `npm run test -w server -- routes/orders.test.js`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add server/src/app.js server/src/routes/orders.js server/src/middleware/errorHandler.js server/src/server.js server/tests/routes/orders.test.js
git commit -m "feat: add Express app and order CRUD routes"
```

---

## Task 9: Needed Items & Tags Routes

**Files:**
- Create: `server/src/routes/neededItems.js`
- Create: `server/src/routes/tags.js`
- Modify: `server/src/app.js`
- Test: `server/tests/routes/neededItems.test.js`
- Test: `server/tests/routes/tags.test.js`

**Interfaces:**
- Consumes: `neededItems.js`, `tags.js` data layers (Task 5).
- Produces:
  - `POST /api/orders/:orderId/needed-items` — body `{ label }` → 201, `{id, orderId, label, done}`
  - `PUT /api/needed-items/:id` — body `{ label?, done? }` → 200, updated item, or 404
  - `DELETE /api/needed-items/:id` → 204, or 404
  - `PUT /api/orders/:orderId/tags` — body `{ tags: string[] }` → 200, `{ tags: string[] }`

- [ ] **Step 1: Write the failing tests**

```js
// server/tests/routes/neededItems.test.js
import { test, expect, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB = path.resolve('./tests/tmp/test-needed-items-routes.db');
let app, orderId;

beforeEach(async () => {
  fs.rmSync(TEST_DB, { force: true });
  process.env.DB_PATH = TEST_DB;
  const mod = await import('../../src/app.js?t=' + Math.random());
  app = mod.default;
  const created = await request(app).post('/api/orders').send({ customerName: 'A', theme: 'X', dueDate: '2026-09-01' });
  orderId = created.body.id;
});

test('POST /api/orders/:orderId/needed-items creates an item', async () => {
  const res = await request(app).post(`/api/orders/${orderId}/needed-items`).send({ label: 'Boxes' });
  expect(res.status).toBe(201);
  expect(res.body.label).toBe('Boxes');
  expect(res.body.done).toBe(false);
});

test('PUT /api/needed-items/:id toggles done', async () => {
  const created = await request(app).post(`/api/orders/${orderId}/needed-items`).send({ label: 'Boxes' });
  const res = await request(app).put(`/api/needed-items/${created.body.id}`).send({ done: true });
  expect(res.body.done).toBe(true);
});

test('DELETE /api/needed-items/:id removes it', async () => {
  const created = await request(app).post(`/api/orders/${orderId}/needed-items`).send({ label: 'Boxes' });
  const del = await request(app).delete(`/api/needed-items/${created.body.id}`);
  expect(del.status).toBe(204);
});
```

```js
// server/tests/routes/tags.test.js
import { test, expect, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB = path.resolve('./tests/tmp/test-tags-routes.db');
let app, orderId;

beforeEach(async () => {
  fs.rmSync(TEST_DB, { force: true });
  process.env.DB_PATH = TEST_DB;
  const mod = await import('../../src/app.js?t=' + Math.random());
  app = mod.default;
  const created = await request(app).post('/api/orders').send({ customerName: 'A', theme: 'X', dueDate: '2026-09-01' });
  orderId = created.body.id;
});

test('PUT /api/orders/:orderId/tags sets tags', async () => {
  const res = await request(app).put(`/api/orders/${orderId}/tags`).send({ tags: ['wedding', '3-tier'] });
  expect(res.status).toBe(200);
  expect(res.body.tags.sort()).toEqual(['3-tier', 'wedding']);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -w server -- routes/neededItems.test.js routes/tags.test.js`
Expected: FAIL — routes not mounted.

- [ ] **Step 3: Write `server/src/routes/neededItems.js`**

```js
import { Router } from 'express';
import * as neededItems from '../db/neededItems.js';

export const orderScopedRouter = Router({ mergeParams: true });
orderScopedRouter.post('/', (req, res) => {
  const item = neededItems.addNeededItem(Number(req.params.orderId), req.body.label);
  res.status(201).json(item);
});

export const standaloneRouter = Router();
standaloneRouter.put('/:id', (req, res) => {
  const item = neededItems.updateNeededItem(Number(req.params.id), req.body);
  if (!item) return res.status(404).json({ error: 'Needed item not found' });
  res.json(item);
});
standaloneRouter.delete('/:id', (req, res) => {
  const deleted = neededItems.deleteNeededItem(Number(req.params.id));
  if (!deleted) return res.status(404).json({ error: 'Needed item not found' });
  res.status(204).end();
});
```

- [ ] **Step 4: Write `server/src/routes/tags.js`**

```js
import { Router } from 'express';
import * as tags from '../db/tags.js';

export const orderScopedRouter = Router({ mergeParams: true });
orderScopedRouter.put('/', (req, res) => {
  const result = tags.setOrderTags(Number(req.params.orderId), req.body.tags || []);
  res.json({ tags: result });
});
```

- [ ] **Step 5: Mount the new routes in `server/src/app.js`**

```js
import express from 'express';
import cors from 'cors';
import ordersRouter from './routes/orders.js';
import { orderScopedRouter as neededItemsForOrder, standaloneRouter as neededItemsRouter } from './routes/neededItems.js';
import { orderScopedRouter as tagsForOrder } from './routes/tags.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/orders/:orderId/needed-items', neededItemsForOrder);
app.use('/api/orders/:orderId/tags', tagsForOrder);
app.use('/api/needed-items', neededItemsRouter);
app.use('/api/orders', ordersRouter);

app.use(errorHandler);

export default app;
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test -w server -- routes/neededItems.test.js routes/tags.test.js`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/neededItems.js server/src/routes/tags.js server/src/app.js server/tests/routes/neededItems.test.js server/tests/routes/tags.test.js
git commit -m "feat: add needed-items and tags routes"
```

---

## Task 10: Photo Upload API

**Files:**
- Create: `server/src/routes/photos.js`
- Modify: `server/src/app.js`
- Test: `server/tests/routes/photos.test.js`

**Interfaces:**
- Consumes: `photos.js` data layer (Task 6).
- Produces:
  - `POST /api/orders/:orderId/photos` — multipart form field `photo` → 201, `{id, orderId, filePath, sortOrder, isCover}`. Files are saved under `process.env.UPLOADS_DIR` (default `./data/uploads`) in a per-order subfolder, and served statically at `/uploads/*`.
  - `DELETE /api/photos/:id` → 204 (also deletes the file from disk), or 404
  - `PUT /api/photos/:id/cover` — body `{ orderId }` → 200, `{ photos: [...] }` (full updated list)

- [ ] **Step 1: Write the failing test**

```js
// server/tests/routes/photos.test.js
import { test, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB = path.resolve('./tests/tmp/test-photos-routes.db');
const TEST_UPLOADS = path.resolve('./tests/tmp/test-uploads');
let app, orderId;

beforeEach(async () => {
  fs.rmSync(TEST_DB, { force: true });
  fs.rmSync(TEST_UPLOADS, { recursive: true, force: true });
  process.env.DB_PATH = TEST_DB;
  process.env.UPLOADS_DIR = TEST_UPLOADS;
  const mod = await import('../../src/app.js?t=' + Math.random());
  app = mod.default;
  const created = await request(app).post('/api/orders').send({ customerName: 'A', theme: 'X', dueDate: '2026-09-01' });
  orderId = created.body.id;
});

afterAll(() => fs.rmSync(TEST_UPLOADS, { recursive: true, force: true }));

test('POST /api/orders/:orderId/photos uploads and records a photo', async () => {
  const res = await request(app)
    .post(`/api/orders/${orderId}/photos`)
    .attach('photo', Buffer.from('fake-image-bytes'), 'cake.jpg');

  expect(res.status).toBe(201);
  expect(res.body.isCover).toBe(true);
  expect(fs.existsSync(path.join(TEST_UPLOADS, String(orderId), path.basename(res.body.filePath)))).toBe(true);
});

test('DELETE /api/photos/:id removes the row and the file', async () => {
  const uploaded = await request(app)
    .post(`/api/orders/${orderId}/photos`)
    .attach('photo', Buffer.from('fake-image-bytes'), 'cake.jpg');

  const del = await request(app).delete(`/api/photos/${uploaded.body.id}`);
  expect(del.status).toBe(204);
  expect(fs.existsSync(path.join(TEST_UPLOADS, String(orderId), path.basename(uploaded.body.filePath)))).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w server -- routes/photos.test.js`
Expected: FAIL — route not mounted.

- [ ] **Step 3: Write `server/src/routes/photos.js`**

```js
import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import * as photos from '../db/photos.js';

function uploadsDir() {
  return process.env.UPLOADS_DIR || path.resolve('./data/uploads');
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(uploadsDir(), String(req.params.orderId));
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });

export const orderScopedRouter = Router({ mergeParams: true });
orderScopedRouter.post('/', upload.single('photo'), (req, res) => {
  const relativePath = path.join(String(req.params.orderId), req.file.filename);
  const photo = photos.addPhoto(Number(req.params.orderId), relativePath);
  res.status(201).json(photo);
});

export const standaloneRouter = Router();
standaloneRouter.delete('/:id', (req, res) => {
  const filePath = photos.deletePhoto(Number(req.params.id));
  if (filePath === undefined) return res.status(404).json({ error: 'Photo not found' });
  fs.rmSync(path.join(uploadsDir(), filePath), { force: true });
  res.status(204).end();
});
standaloneRouter.put('/:id/cover', (req, res) => {
  const list = photos.setCoverPhoto(Number(req.body.orderId), Number(req.params.id));
  res.json({ photos: list });
});
```

- [ ] **Step 4: Mount routes and static serving in `server/src/app.js`**

Add these lines (import at top, static + mounts alongside the others):

```js
import path from 'node:path';
import { orderScopedRouter as photosForOrder, standaloneRouter as photosRouter } from './routes/photos.js';
// ...
app.use('/uploads', express.static(process.env.UPLOADS_DIR || path.resolve('./data/uploads')));
app.use('/api/orders/:orderId/photos', photosForOrder);
app.use('/api/photos', photosRouter);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -w server -- routes/photos.test.js`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/photos.js server/src/app.js server/tests/routes/photos.test.js
git commit -m "feat: add photo upload API with disk storage"
```

---

## Task 11: Recipe Library & OrderRecipe Routes

**Files:**
- Create: `server/src/routes/recipes.js`
- Create: `server/src/routes/orderRecipes.js`
- Modify: `server/src/app.js`
- Test: `server/tests/routes/recipes.test.js`
- Test: `server/tests/routes/orderRecipes.test.js`

**Interfaces:**
- Consumes: `recipes.js`, `orderRecipes.js` data layers (Task 7).
- Produces:
  - `POST /api/recipes`, `GET /api/recipes`, `GET /api/recipes/:id`, `PUT /api/recipes/:id`, `DELETE /api/recipes/:id` — standard CRUD on the template library
  - `POST /api/orders/:orderId/recipes` — body `{ recipeId }` → 201, the attached `OrderRecipe`, or 404 if `recipeId` doesn't exist
  - `GET /api/orders/:orderId/recipes` → 200, array of attached `OrderRecipe`s
  - `PUT /api/order-recipes/:id`, `DELETE /api/order-recipes/:id` — edit/remove an order's attached copy

- [ ] **Step 1: Write the failing tests**

```js
// server/tests/routes/recipes.test.js
import { test, expect, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB = path.resolve('./tests/tmp/test-recipes-routes.db');
let app;

beforeEach(async () => {
  fs.rmSync(TEST_DB, { force: true });
  process.env.DB_PATH = TEST_DB;
  const mod = await import('../../src/app.js?t=' + Math.random());
  app = mod.default;
});

test('POST /api/recipes then GET /api/recipes lists it', async () => {
  await request(app).post('/api/recipes').send({ name: 'Vanilla Sponge', ingredients: [], instructions: 'Bake.' });
  const res = await request(app).get('/api/recipes');
  expect(res.body).toHaveLength(1);
  expect(res.body[0].name).toBe('Vanilla Sponge');
});

test('PUT /api/recipes/:id updates it', async () => {
  const created = await request(app).post('/api/recipes').send({ name: 'Vanilla Sponge', ingredients: [], instructions: 'Bake.' });
  const res = await request(app).put(`/api/recipes/${created.body.id}`).send({ instructions: 'Bake at 325F.' });
  expect(res.body.instructions).toBe('Bake at 325F.');
});

test('DELETE /api/recipes/:id removes it', async () => {
  const created = await request(app).post('/api/recipes').send({ name: 'Vanilla Sponge', ingredients: [], instructions: 'Bake.' });
  const del = await request(app).delete(`/api/recipes/${created.body.id}`);
  expect(del.status).toBe(204);
});
```

```js
// server/tests/routes/orderRecipes.test.js
import { test, expect, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB = path.resolve('./tests/tmp/test-order-recipes-routes.db');
let app, orderId, recipeId;

beforeEach(async () => {
  fs.rmSync(TEST_DB, { force: true });
  process.env.DB_PATH = TEST_DB;
  const mod = await import('../../src/app.js?t=' + Math.random());
  app = mod.default;
  const order = await request(app).post('/api/orders').send({ customerName: 'A', theme: 'X', dueDate: '2026-09-01' });
  orderId = order.body.id;
  const recipe = await request(app).post('/api/recipes').send({ name: 'Vanilla Sponge', ingredients: [], instructions: 'Bake.' });
  recipeId = recipe.body.id;
});

test('POST /api/orders/:orderId/recipes attaches a copy', async () => {
  const res = await request(app).post(`/api/orders/${orderId}/recipes`).send({ recipeId });
  expect(res.status).toBe(201);
  expect(res.body.recipeName).toBe('Vanilla Sponge');
});

test('POST /api/orders/:orderId/recipes 404s for a missing template', async () => {
  const res = await request(app).post(`/api/orders/${orderId}/recipes`).send({ recipeId: 999 });
  expect(res.status).toBe(404);
});

test('PUT /api/order-recipes/:id edits the copy without touching the template', async () => {
  const attached = await request(app).post(`/api/orders/${orderId}/recipes`).send({ recipeId });
  const res = await request(app).put(`/api/order-recipes/${attached.body.id}`).send({ instructions: 'Extra vanilla.' });
  expect(res.body.instructions).toBe('Extra vanilla.');

  const template = await request(app).get(`/api/recipes/${recipeId}`);
  expect(template.body.instructions).toBe('Bake.');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -w server -- routes/recipes.test.js routes/orderRecipes.test.js`
Expected: FAIL — routes not mounted.

- [ ] **Step 3: Write `server/src/routes/recipes.js`**

```js
import { Router } from 'express';
import * as recipes from '../db/recipes.js';

const router = Router();

router.post('/', (req, res) => {
  res.status(201).json(recipes.createRecipe(req.body));
});
router.get('/', (req, res) => {
  res.json(recipes.listRecipes());
});
router.get('/:id', (req, res) => {
  const recipe = recipes.getRecipeById(Number(req.params.id));
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
  res.json(recipe);
});
router.put('/:id', (req, res) => {
  const recipe = recipes.updateRecipe(Number(req.params.id), req.body);
  if (!recipe) return res.status(404).json({ error: 'Recipe not found' });
  res.json(recipe);
});
router.delete('/:id', (req, res) => {
  const deleted = recipes.deleteRecipe(Number(req.params.id));
  if (!deleted) return res.status(404).json({ error: 'Recipe not found' });
  res.status(204).end();
});

export default router;
```

- [ ] **Step 4: Write `server/src/routes/orderRecipes.js`**

```js
import { Router } from 'express';
import * as orderRecipes from '../db/orderRecipes.js';

export const orderScopedRouter = Router({ mergeParams: true });
orderScopedRouter.post('/', (req, res) => {
  try {
    const attached = orderRecipes.attachRecipeToOrder(Number(req.params.orderId), req.body.recipeId);
    res.status(201).json(attached);
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});
orderScopedRouter.get('/', (req, res) => {
  res.json(orderRecipes.listOrderRecipes(Number(req.params.orderId)));
});

export const standaloneRouter = Router();
standaloneRouter.put('/:id', (req, res) => {
  const updated = orderRecipes.updateOrderRecipe(Number(req.params.id), req.body);
  if (!updated) return res.status(404).json({ error: 'Order recipe not found' });
  res.json(updated);
});
standaloneRouter.delete('/:id', (req, res) => {
  const deleted = orderRecipes.deleteOrderRecipe(Number(req.params.id));
  if (!deleted) return res.status(404).json({ error: 'Order recipe not found' });
  res.status(204).end();
});
```

- [ ] **Step 5: Mount routes in `server/src/app.js`**

```js
import recipesRouter from './routes/recipes.js';
import { orderScopedRouter as orderRecipesForOrder, standaloneRouter as orderRecipesRouter } from './routes/orderRecipes.js';
// ...
app.use('/api/orders/:orderId/recipes', orderRecipesForOrder);
app.use('/api/order-recipes', orderRecipesRouter);
app.use('/api/recipes', recipesRouter);
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npm run test -w server -- routes/recipes.test.js routes/orderRecipes.test.js`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add server/src/routes/recipes.js server/src/routes/orderRecipes.js server/src/app.js server/tests/routes/recipes.test.js server/tests/routes/orderRecipes.test.js
git commit -m "feat: add recipe library and order-recipe attach routes"
```

---

## Task 12: Settings Store & Google OAuth Flow

**Files:**
- Create: `server/src/db/settings.js`
- Create: `server/src/routes/settingsCalendar.js`
- Modify: `server/src/app.js`
- Test: `server/tests/db/settings.test.js`
- Test: `server/tests/routes/settingsCalendar.test.js`

**Interfaces:**
- Produces (`settings.js`, used by Task 13's calendar service):
  - `getSetting(key)` → string or `undefined`
  - `setSetting(key, value)` → void
- Produces (routes, env-driven, used by the frontend Settings page in Task 22):
  - `GET /api/settings/calendar/status` → `{ connected: boolean }` (true if a refresh token is stored)
  - `GET /api/settings/calendar/auth-url` → `{ url: string }` — the Google consent screen URL, built from `process.env.GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI`
  - `GET /api/settings/calendar/callback?code=...` → exchanges the code, stores the refresh token via `setSetting('google_refresh_token', ...)`, redirects to `/settings?connected=1`

- [ ] **Step 1: Write the failing test for `settings.js`**

```js
// server/tests/db/settings.test.js
import { test, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB = path.resolve('./tests/tmp/test-settings.db');
let settings;

beforeEach(async () => {
  fs.rmSync(TEST_DB, { force: true });
  process.env.DB_PATH = TEST_DB;
  const connMod = await import('../../src/db/connection.js?t=' + Math.random());
  connMod.getDb();
  settings = await import('../../src/db/settings.js?t=' + Math.random());
});

test('getSetting returns undefined for a missing key', () => {
  expect(settings.getSetting('google_refresh_token')).toBeUndefined();
});

test('setSetting then getSetting round-trips a value', () => {
  settings.setSetting('google_refresh_token', 'abc123');
  expect(settings.getSetting('google_refresh_token')).toBe('abc123');
});

test('setSetting overwrites an existing value', () => {
  settings.setSetting('google_refresh_token', 'abc123');
  settings.setSetting('google_refresh_token', 'def456');
  expect(settings.getSetting('google_refresh_token')).toBe('def456');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w server -- db/settings.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `server/src/db/settings.js`**

```js
import { getDb } from './connection.js';

export function getSetting(key) {
  const db = getDb();
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row?.value;
}

export function setSetting(key, value) {
  const db = getDb();
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w server -- db/settings.test.js`
Expected: PASS

- [ ] **Step 5: Write the failing test for the calendar settings routes**

```js
// server/tests/routes/settingsCalendar.test.js
import { test, expect, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';

const TEST_DB = path.resolve('./tests/tmp/test-settings-calendar-routes.db');
let app;

beforeEach(async () => {
  fs.rmSync(TEST_DB, { force: true });
  process.env.DB_PATH = TEST_DB;
  process.env.GOOGLE_CLIENT_ID = 'test-client-id';
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret';
  process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3001/api/settings/calendar/callback';
  const mod = await import('../../src/app.js?t=' + Math.random());
  app = mod.default;
});

test('GET /api/settings/calendar/status reports disconnected by default', async () => {
  const res = await request(app).get('/api/settings/calendar/status');
  expect(res.body).toEqual({ connected: false });
});

test('GET /api/settings/calendar/auth-url returns a Google consent URL', async () => {
  const res = await request(app).get('/api/settings/calendar/auth-url');
  expect(res.status).toBe(200);
  expect(res.body.url).toContain('accounts.google.com');
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npm run test -w server -- routes/settingsCalendar.test.js`
Expected: FAIL — route not mounted.

- [ ] **Step 7: Write `server/src/routes/settingsCalendar.js`**

```js
import { Router } from 'express';
import { google } from 'googleapis';
import { getSetting, setSetting } from '../db/settings.js';

const router = Router();

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

router.get('/status', (req, res) => {
  res.json({ connected: !!getSetting('google_refresh_token') });
});

router.get('/auth-url', (req, res) => {
  const url = oauthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar'],
  });
  res.json({ url });
});

router.get('/callback', async (req, res) => {
  const client = oauthClient();
  const { tokens } = await client.getToken(req.query.code);
  if (tokens.refresh_token) {
    setSetting('google_refresh_token', tokens.refresh_token);
  }
  res.redirect('/settings?connected=1');
});

export default router;
```

- [ ] **Step 8: Mount the route in `server/src/app.js`**

```js
import settingsCalendarRouter from './routes/settingsCalendar.js';
// ...
app.use('/api/settings/calendar', settingsCalendarRouter);
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm run test -w server -- routes/settingsCalendar.test.js`
Expected: PASS

- [ ] **Step 10: Commit**

```bash
git add server/src/db/settings.js server/src/routes/settingsCalendar.js server/src/app.js server/tests/db/settings.test.js server/tests/routes/settingsCalendar.test.js
git commit -m "feat: add settings store and Google Calendar OAuth flow"
```

---

## Task 13: Calendar Sync Service

**Files:**
- Create: `server/src/services/calendar.js`
- Test: `server/tests/services/calendar.test.js`

**Interfaces:**
- Consumes: `getSetting()` from Task 12; the `googleapis` package.
- Produces (used by Task 14):
  - `buildEventPayload(order)` → pure function → Google Calendar event resource: `{ summary, description, start: {dateTime}, end: {dateTime}, reminders: {useDefault: false, overrides: [{method: 'popup', minutes}]} }`. `start`/`end` are built from `order.dueDate` + `order.dueTime` (defaulting to a 1-hour block; if no `dueTime`, treat as an all-day event using `start.date`/`end.date` instead of `dateTime`).
  - `getCalendarClient()` → an authenticated `googleapis` Calendar client (throws `Error('Google Calendar not connected')` if no refresh token is stored)
  - `syncOrderToCalendar(order)` → async; creates an event if `order.googleEventId` is null, else updates the existing one; returns the `eventId` string. Callers are responsible for saving the returned `eventId` back onto the order.
  - `deleteOrderFromCalendar(order)` → async; deletes the event if `order.googleEventId` is set; no-op otherwise.

- [ ] **Step 1: Write the failing test**

```js
// server/tests/services/calendar.test.js
import { test, expect, vi, beforeEach } from 'vitest';

vi.mock('googleapis', () => {
  const events = {
    insert: vi.fn().mockResolvedValue({ data: { id: 'evt-123' } }),
    update: vi.fn().mockResolvedValue({ data: { id: 'evt-123' } }),
    delete: vi.fn().mockResolvedValue({}),
  };
  return {
    google: {
      auth: { OAuth2: vi.fn().mockImplementation(() => ({ setCredentials: vi.fn() })) },
      calendar: vi.fn().mockReturnValue({ events }),
    },
  };
});

import { google } from 'googleapis';
import { buildEventPayload, syncOrderToCalendar, deleteOrderFromCalendar } from '../../src/services/calendar.js';

const baseOrder = {
  id: 1,
  theme: 'Dinosaur Jungle',
  customerName: 'Jane Doe',
  dueDate: '2026-09-01',
  dueTime: '14:00',
  reminderOffsets: [1440, 60],
  googleEventId: null,
};

beforeEach(async () => {
  process.env.DB_PATH = './tests/tmp/test-calendar.db';
  process.env.GOOGLE_CLIENT_ID = 'id';
  process.env.GOOGLE_CLIENT_SECRET = 'secret';
  process.env.GOOGLE_REDIRECT_URI = 'http://localhost/callback';
  const fs = await import('node:fs');
  fs.rmSync(process.env.DB_PATH, { force: true });
  const connMod = await import('../../src/db/connection.js?t=' + Math.random());
  connMod.getDb();
  const settings = await import('../../src/db/settings.js?t=' + Math.random());
  settings.setSetting('google_refresh_token', 'refresh-abc');
});

test('buildEventPayload maps due date/time and reminder offsets', () => {
  const payload = buildEventPayload(baseOrder);
  expect(payload.summary).toContain('Dinosaur Jungle');
  expect(payload.summary).toContain('Jane Doe');
  expect(payload.start.dateTime).toContain('2026-09-01T14:00');
  expect(payload.reminders.overrides).toEqual([
    { method: 'popup', minutes: 1440 },
    { method: 'popup', minutes: 60 },
  ]);
});

test('buildEventPayload builds an all-day event when dueTime is missing', () => {
  const payload = buildEventPayload({ ...baseOrder, dueTime: null });
  expect(payload.start.date).toBe('2026-09-01');
  expect(payload.start.dateTime).toBeUndefined();
});

test('syncOrderToCalendar inserts a new event when googleEventId is null', async () => {
  const eventId = await syncOrderToCalendar(baseOrder);
  expect(eventId).toBe('evt-123');
  expect(google.calendar().events.insert).toHaveBeenCalled();
});

test('syncOrderToCalendar updates the existing event when googleEventId is set', async () => {
  await syncOrderToCalendar({ ...baseOrder, googleEventId: 'evt-123' });
  expect(google.calendar().events.update).toHaveBeenCalled();
});

test('deleteOrderFromCalendar deletes when googleEventId is set', async () => {
  await deleteOrderFromCalendar({ ...baseOrder, googleEventId: 'evt-123' });
  expect(google.calendar().events.delete).toHaveBeenCalled();
});

test('deleteOrderFromCalendar is a no-op without a googleEventId', async () => {
  await deleteOrderFromCalendar(baseOrder);
  expect(google.calendar().events.delete).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w server -- services/calendar.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Write `server/src/services/calendar.js`**

```js
import { google } from 'googleapis';
import { getSetting } from '../db/settings.js';

export function buildEventPayload(order) {
  const summary = `${order.theme || 'Cake'} — ${order.customerName}`;
  const base = {
    summary,
    description: order.description || '',
    reminders: {
      useDefault: false,
      overrides: (order.reminderOffsets || []).map((minutes) => ({ method: 'popup', minutes })),
    },
  };

  if (order.dueTime) {
    const startDateTime = `${order.dueDate}T${order.dueTime}:00`;
    const end = new Date(`${order.dueDate}T${order.dueTime}:00`);
    end.setHours(end.getHours() + 1);
    return {
      ...base,
      start: { dateTime: startDateTime },
      end: { dateTime: end.toISOString().slice(0, 19) },
    };
  }

  return {
    ...base,
    start: { date: order.dueDate },
    end: { date: order.dueDate },
  };
}

export function getCalendarClient() {
  const refreshToken = getSetting('google_refresh_token');
  if (!refreshToken) throw new Error('Google Calendar not connected');

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  auth.setCredentials({ refresh_token: refreshToken });

  return google.calendar({ version: 'v3', auth });
}

export async function syncOrderToCalendar(order) {
  const calendar = getCalendarClient();
  const requestBody = buildEventPayload(order);

  if (order.googleEventId) {
    const { data } = await calendar.events.update({
      calendarId: 'primary',
      eventId: order.googleEventId,
      requestBody,
    });
    return data.id;
  }

  const { data } = await calendar.events.insert({ calendarId: 'primary', requestBody });
  return data.id;
}

export async function deleteOrderFromCalendar(order) {
  if (!order.googleEventId) return;
  const calendar = getCalendarClient();
  await calendar.events.delete({ calendarId: 'primary', eventId: order.googleEventId });
}
```

> Note: this uses `calendarId: 'primary'` for simplicity. If you want the dedicated "Whipped Wisps Orders" calendar from the spec, create it once via the Google Calendar UI, grab its calendar ID from its settings page, and set it as `GOOGLE_CALENDAR_ID` — swap `'primary'` for `process.env.GOOGLE_CALENDAR_ID || 'primary'` in both places above.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w server -- services/calendar.test.js`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/src/services/calendar.js server/tests/services/calendar.test.js
git commit -m "feat: add Google Calendar sync service"
```

---

## Task 14: Wire Calendar Sync into Order Routes

**Files:**
- Modify: `server/src/routes/orders.js`
- Test: `server/tests/routes/ordersCalendarSync.test.js`

**Interfaces:**
- Consumes: `syncOrderToCalendar`, `deleteOrderFromCalendar` from Task 13; `updateOrder` from Task 4.
- Produces:
  - `POST /api/orders`, `PUT /api/orders/:id` now attempt a calendar sync after saving; on success, the order's `googleEventId` is persisted via `updateOrder` and included in the response. On failure, the response still reflects the saved order (200/201) plus a `calendarSyncError: string` field — the save itself never fails because of a sync error (per spec).
  - `DELETE /api/orders/:id` now attempts `deleteOrderFromCalendar` before removing the row; a sync failure is logged but does not block the delete.
  - `POST /api/orders/:id/resync-calendar` → retries the sync for one order; same success/failure response shape as create/update.

- [ ] **Step 1: Write the failing test**

```js
// server/tests/routes/ordersCalendarSync.test.js
import { test, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';

vi.mock('../../src/services/calendar.js', () => ({
  syncOrderToCalendar: vi.fn(),
  deleteOrderFromCalendar: vi.fn().mockResolvedValue(undefined),
}));

const TEST_DB = path.resolve('./tests/tmp/test-orders-calendar-sync.db');
let app, calendarService;

beforeEach(async () => {
  fs.rmSync(TEST_DB, { force: true });
  process.env.DB_PATH = TEST_DB;
  vi.resetModules();
  calendarService = await import('../../src/services/calendar.js');
  const mod = await import('../../src/app.js?t=' + Math.random());
  app = mod.default;
});

test('POST /api/orders stores the googleEventId on successful sync', async () => {
  calendarService.syncOrderToCalendar.mockResolvedValue('evt-999');
  const res = await request(app).post('/api/orders').send({ customerName: 'A', theme: 'X', dueDate: '2026-09-01' });
  expect(res.body.googleEventId).toBe('evt-999');
  expect(res.body.calendarSyncError).toBeUndefined();
});

test('POST /api/orders still saves the order when sync fails', async () => {
  calendarService.syncOrderToCalendar.mockRejectedValue(new Error('Google Calendar not connected'));
  const res = await request(app).post('/api/orders').send({ customerName: 'A', theme: 'X', dueDate: '2026-09-01' });
  expect(res.status).toBe(201);
  expect(res.body.calendarSyncError).toBe('Google Calendar not connected');
});

test('POST /api/orders/:id/resync-calendar retries and stores the eventId', async () => {
  calendarService.syncOrderToCalendar.mockRejectedValueOnce(new Error('boom'));
  const created = await request(app).post('/api/orders').send({ customerName: 'A', theme: 'X', dueDate: '2026-09-01' });

  calendarService.syncOrderToCalendar.mockResolvedValue('evt-retry');
  const res = await request(app).post(`/api/orders/${created.body.id}/resync-calendar`);
  expect(res.body.googleEventId).toBe('evt-retry');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -w server -- routes/ordersCalendarSync.test.js`
Expected: FAIL — sync not wired in yet.

- [ ] **Step 3: Update `server/src/routes/orders.js`**

Add the import and a shared helper, then use it in the three relevant handlers:

```js
import * as orders from '../db/orders.js';
import * as neededItems from '../db/neededItems.js';
import * as tags from '../db/tags.js';
import { syncOrderToCalendar, deleteOrderFromCalendar } from '../services/calendar.js';

// ...withAttachments stays the same...

async function saveAndSync(order) {
  try {
    const eventId = await syncOrderToCalendar(order);
    const updated = orders.updateOrder(order.id, { googleEventId: eventId });
    return withAttachments(updated);
  } catch (err) {
    return { ...withAttachments(order), calendarSyncError: err.message };
  }
}

router.post('/', async (req, res) => {
  const order = orders.createOrder(req.body);
  res.status(201).json(await saveAndSync(order));
});

router.put('/:id', async (req, res) => {
  const order = orders.updateOrder(Number(req.params.id), req.body);
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(await saveAndSync(order));
});

router.post('/:id/resync-calendar', async (req, res) => {
  const order = orders.getOrderById(Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Order not found' });
  res.json(await saveAndSync(order));
});

router.delete('/:id', async (req, res) => {
  const order = orders.getOrderById(Number(req.params.id));
  if (!order) return res.status(404).json({ error: 'Order not found' });
  try {
    await deleteOrderFromCalendar(order);
  } catch (err) {
    console.error('Calendar delete failed:', err.message);
  }
  orders.deleteOrder(order.id);
  res.status(204).end();
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -w server -- routes/ordersCalendarSync.test.js`
Expected: PASS

- [ ] **Step 5: Run the full server test suite to check nothing else broke**

Run: `npm run test -w server`
Expected: all tests PASS

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/orders.js server/tests/routes/ordersCalendarSync.test.js
git commit -m "feat: wire non-blocking Google Calendar sync into order save/delete"
```

---

## Task 15: Frontend Scaffold — Routing, Layout, API Client

**Files:**
- Modify: `client/package.json` (add `react-router-dom`)
- Create: `client/src/api/client.js`
- Create: `client/src/App.jsx` (replace Vite default)
- Modify: `client/src/main.jsx`
- Create: `client/vite.config.js` (dev proxy to Express)

**Interfaces:**
- Produces: `client/src/api/client.js` exports one function per backend endpoint used by later frontend tasks, all returning parsed JSON and throwing on non-2xx:
  - `fetchOrders(status)`, `fetchOrder(id)`, `fetchOrderBySlug(slug)`, `createOrder(data)`, `updateOrder(id, data)`, `deleteOrder(id)`, `archiveOrder(id)`, `searchArchive(query)`
  - `addNeededItem(orderId, label)`, `updateNeededItem(id, data)`, `deleteNeededItem(id)`
  - `setOrderTags(orderId, tags)`
  - `uploadPhoto(orderId, file)`, `deletePhoto(id)`, `setCoverPhoto(id, orderId)`
  - `fetchRecipes()`, `createRecipe(data)`, `updateRecipe(id, data)`, `deleteRecipe(id)`
  - `attachRecipe(orderId, recipeId)`, `fetchOrderRecipes(orderId)`, `updateOrderRecipe(id, data)`, `deleteOrderRecipe(id)`
  - `fetchCalendarStatus()`, `fetchCalendarAuthUrl()`
- `App.jsx` defines routes: `/`, `/orders/new`, `/orders/:id`, `/archive`, `/archive/:slug`, `/recipes`, `/settings`, each rendering a placeholder `<h1>` from its page component (page components get filled in by Tasks 16–22).

- [ ] **Step 1: Add `react-router-dom`**

Run: `npm install react-router-dom -w client`

- [ ] **Step 2: Write `client/vite.config.js`**

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
    },
  },
});
```

- [ ] **Step 3: Write `client/src/api/client.js`**

```js
async function request(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: options.body instanceof FormData ? options.headers : { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const fetchOrders = (status) => request(`/api/orders${status ? `?status=${status}` : ''}`);
export const fetchOrder = (id) => request(`/api/orders/${id}`);
export const fetchOrderBySlug = (slug) => request(`/api/orders/slug/${slug}`);
export const createOrder = (data) => request('/api/orders', { method: 'POST', body: JSON.stringify(data) });
export const updateOrder = (id, data) => request(`/api/orders/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteOrder = (id) => request(`/api/orders/${id}`, { method: 'DELETE' });
export const archiveOrder = (id) => request(`/api/orders/${id}/archive`, { method: 'POST' });
export const searchArchive = (query) => request(`/api/orders/search?q=${encodeURIComponent(query)}`);
export const resyncCalendar = (id) => request(`/api/orders/${id}/resync-calendar`, { method: 'POST' });

export const addNeededItem = (orderId, label) =>
  request(`/api/orders/${orderId}/needed-items`, { method: 'POST', body: JSON.stringify({ label }) });
export const updateNeededItem = (id, data) => request(`/api/needed-items/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteNeededItem = (id) => request(`/api/needed-items/${id}`, { method: 'DELETE' });

export const setOrderTags = (orderId, tags) =>
  request(`/api/orders/${orderId}/tags`, { method: 'PUT', body: JSON.stringify({ tags }) });

export const uploadPhoto = (orderId, file) => {
  const form = new FormData();
  form.append('photo', file);
  return request(`/api/orders/${orderId}/photos`, { method: 'POST', body: form });
};
export const deletePhoto = (id) => request(`/api/photos/${id}`, { method: 'DELETE' });
export const setCoverPhoto = (id, orderId) =>
  request(`/api/photos/${id}/cover`, { method: 'PUT', body: JSON.stringify({ orderId }) });

export const fetchRecipes = () => request('/api/recipes');
export const createRecipe = (data) => request('/api/recipes', { method: 'POST', body: JSON.stringify(data) });
export const updateRecipe = (id, data) => request(`/api/recipes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteRecipe = (id) => request(`/api/recipes/${id}`, { method: 'DELETE' });

export const attachRecipe = (orderId, recipeId) =>
  request(`/api/orders/${orderId}/recipes`, { method: 'POST', body: JSON.stringify({ recipeId }) });
export const fetchOrderRecipes = (orderId) => request(`/api/orders/${orderId}/recipes`);
export const updateOrderRecipe = (id, data) => request(`/api/order-recipes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteOrderRecipe = (id) => request(`/api/order-recipes/${id}`, { method: 'DELETE' });

export const fetchCalendarStatus = () => request('/api/settings/calendar/status');
export const fetchCalendarAuthUrl = () => request('/api/settings/calendar/auth-url');
```

- [ ] **Step 4: Write `client/src/App.jsx`**

```jsx
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import OrderForm from './pages/OrderForm.jsx';
import Archive from './pages/Archive.jsx';
import ArchiveDetail from './pages/ArchiveDetail.jsx';
import Recipes from './pages/Recipes.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <nav className="main-nav">
        <NavLink to="/">Schedule</NavLink>
        <NavLink to="/archive">Archive</NavLink>
        <NavLink to="/recipes">Recipes</NavLink>
        <NavLink to="/settings">Settings</NavLink>
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/orders/new" element={<OrderForm />} />
          <Route path="/orders/:id" element={<OrderForm />} />
          <Route path="/archive" element={<Archive />} />
          <Route path="/archive/:slug" element={<ArchiveDetail />} />
          <Route path="/recipes" element={<Recipes />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
```

- [ ] **Step 5: Create placeholder page components**

```jsx
// client/src/pages/Dashboard.jsx
export default function Dashboard() { return <h1>Schedule</h1>; }
```

```jsx
// client/src/pages/OrderForm.jsx
export default function OrderForm() { return <h1>Order Form</h1>; }
```

```jsx
// client/src/pages/Archive.jsx
export default function Archive() { return <h1>Archive</h1>; }
```

```jsx
// client/src/pages/ArchiveDetail.jsx
export default function ArchiveDetail() { return <h1>Archive Detail</h1>; }
```

```jsx
// client/src/pages/Recipes.jsx
export default function Recipes() { return <h1>Recipes</h1>; }
```

```jsx
// client/src/pages/Settings.jsx
export default function Settings() { return <h1>Settings</h1>; }
```

- [ ] **Step 6: Update `client/src/main.jsx`**

```jsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 7: Verify the app runs**

Run `npm run dev:server` in one terminal and `npm run dev:client` in another, then open the client's dev URL (typically `http://localhost:5173`).
Expected: navigation bar with 4 links, each rendering its placeholder heading with no console errors.

- [ ] **Step 8: Commit**

```bash
git add client/package.json client/package-lock.json client/vite.config.js client/src
git commit -m "feat: scaffold frontend routing, layout, and API client"
```

---

## Task 16: Order Form Page

**Files:**
- Modify: `client/src/pages/OrderForm.jsx`
- Create: `client/src/components/NeededItemsChecklist.jsx`
- Create: `client/src/components/TagInput.jsx`

**Interfaces:**
- Consumes: `fetchOrder`, `createOrder`, `updateOrder`, `deleteOrder`, `archiveOrder`, `addNeededItem`, `updateNeededItem`, `deleteNeededItem`, `setOrderTags`, `resyncCalendar` from `client/src/api/client.js` (Task 15).
- Produces: `NeededItemsChecklist` — props `{ items: Array<{id,label,done}>, onAdd(label), onToggle(id, done), onRemove(id) }`. `TagInput` — props `{ tags: string[], onChange(tags: string[]) }`.

- [ ] **Step 1: Write `client/src/components/NeededItemsChecklist.jsx`**

```jsx
import { useState } from 'react';

export default function NeededItemsChecklist({ items, onAdd, onToggle, onRemove }) {
  const [label, setLabel] = useState('');

  function handleAdd(e) {
    e.preventDefault();
    if (!label.trim()) return;
    onAdd(label.trim());
    setLabel('');
  }

  return (
    <div className="needed-items">
      <h3>Needed Items</h3>
      <ul>
        {items.map((item) => (
          <li key={item.id}>
            <label>
              <input type="checkbox" checked={item.done} onChange={(e) => onToggle(item.id, e.target.checked)} />
              {item.label}
            </label>
            <button type="button" onClick={() => onRemove(item.id)}>Remove</button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleAdd}>
        <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Cake board 12in" />
        <button type="submit">Add</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Write `client/src/components/TagInput.jsx`**

```jsx
import { useState } from 'react';

export default function TagInput({ tags, onChange }) {
  const [draft, setDraft] = useState('');

  function commit() {
    const value = draft.trim();
    if (value && !tags.includes(value)) onChange([...tags, value]);
    setDraft('');
  }

  return (
    <div className="tag-input">
      {tags.map((tag) => (
        <span key={tag} className="tag-chip">
          {tag}
          <button type="button" onClick={() => onChange(tags.filter((t) => t !== tag))}>×</button>
        </span>
      ))}
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
        onBlur={commit}
        placeholder="Add a tag and press Enter"
      />
    </div>
  );
}
```

- [ ] **Step 3: Write `client/src/pages/OrderForm.jsx`**

```jsx
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as api from '../api/client.js';
import NeededItemsChecklist from '../components/NeededItemsChecklist.jsx';
import TagInput from '../components/TagInput.jsx';

const emptyOrder = {
  customerName: '', customerContact: '', orderDate: '', dueDate: '', dueTime: '',
  deliveryType: 'pickup', deliveryAddress: '', deliveryWindowStart: '', deliveryWindowEnd: '',
  theme: '', description: '', dimensions: '', servings: '', flavors: '',
  price: '', depositAmount: '', depositPaid: false, notes: '',
  tags: [], neededItems: [],
};

export default function OrderForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id;
  const [order, setOrder] = useState(emptyOrder);
  const [saveError, setSaveError] = useState(null);
  const [calendarWarning, setCalendarWarning] = useState(null);

  const load = useCallback(async () => {
    if (isNew) return;
    const data = await api.fetchOrder(id);
    setOrder(data);
  }, [id, isNew]);

  useEffect(() => { load(); }, [load]);

  function setField(field, value) {
    setOrder((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaveError(null);
    setCalendarWarning(null);
    try {
      const result = isNew ? await api.createOrder(order) : await api.updateOrder(id, order);
      setOrder(result);
      if (result.calendarSyncError) setCalendarWarning(result.calendarSyncError);
      if (isNew) navigate(`/orders/${result.id}`, { replace: true });
    } catch (err) {
      setSaveError(err.message);
    }
  }

  async function handleAddNeededItem(label) {
    const item = await api.addNeededItem(id, label);
    setOrder((prev) => ({ ...prev, neededItems: [...prev.neededItems, item] }));
  }
  async function handleToggleNeededItem(itemId, done) {
    const updated = await api.updateNeededItem(itemId, { done });
    setOrder((prev) => ({ ...prev, neededItems: prev.neededItems.map((i) => (i.id === itemId ? updated : i)) }));
  }
  async function handleRemoveNeededItem(itemId) {
    await api.deleteNeededItem(itemId);
    setOrder((prev) => ({ ...prev, neededItems: prev.neededItems.filter((i) => i.id !== itemId) }));
  }
  async function handleTagsChange(tags) {
    setOrder((prev) => ({ ...prev, tags }));
    if (!isNew) await api.setOrderTags(id, tags);
  }

  async function handleArchive() {
    const updated = await api.archiveOrder(id);
    setOrder(updated);
  }

  async function handleResync() {
    setCalendarWarning(null);
    const result = await api.resyncCalendar(id);
    setOrder(result);
    if (result.calendarSyncError) setCalendarWarning(result.calendarSyncError);
  }

  return (
    <form className="order-form" onSubmit={handleSave}>
      <h1>{isNew ? 'New Order' : order.theme || 'Edit Order'}</h1>
      {saveError && <p className="error">{saveError}</p>}
      {calendarWarning && (
        <p className="warning">
          Calendar sync failed: {calendarWarning}{' '}
          {!isNew && <button type="button" onClick={handleResync}>Resync</button>}
        </p>
      )}

      <label>Customer name <input value={order.customerName} onChange={(e) => setField('customerName', e.target.value)} required /></label>
      <label>Customer contact <input value={order.customerContact} onChange={(e) => setField('customerContact', e.target.value)} /></label>
      <label>Order date <input type="date" value={order.orderDate || ''} onChange={(e) => setField('orderDate', e.target.value)} /></label>
      <label>Due date <input type="date" value={order.dueDate || ''} onChange={(e) => setField('dueDate', e.target.value)} required /></label>
      <label>Due time <input type="time" value={order.dueTime || ''} onChange={(e) => setField('dueTime', e.target.value)} /></label>

      <label>Delivery type
        <select value={order.deliveryType} onChange={(e) => setField('deliveryType', e.target.value)}>
          <option value="pickup">Pickup</option>
          <option value="delivery">Delivery</option>
        </select>
      </label>
      {order.deliveryType === 'delivery' && (
        <>
          <label>Delivery address <input value={order.deliveryAddress || ''} onChange={(e) => setField('deliveryAddress', e.target.value)} /></label>
          <label>Window start <input type="time" value={order.deliveryWindowStart || ''} onChange={(e) => setField('deliveryWindowStart', e.target.value)} /></label>
          <label>Window end <input type="time" value={order.deliveryWindowEnd || ''} onChange={(e) => setField('deliveryWindowEnd', e.target.value)} /></label>
        </>
      )}

      <label>Theme <input value={order.theme || ''} onChange={(e) => setField('theme', e.target.value)} /></label>
      <label>Description <textarea value={order.description || ''} onChange={(e) => setField('description', e.target.value)} /></label>
      <label>Dimensions <input value={order.dimensions || ''} onChange={(e) => setField('dimensions', e.target.value)} /></label>
      <label>Servings <input value={order.servings || ''} onChange={(e) => setField('servings', e.target.value)} /></label>
      <label>Flavors <input value={order.flavors || ''} onChange={(e) => setField('flavors', e.target.value)} /></label>

      <label>Price <input type="number" step="0.01" value={order.price || ''} onChange={(e) => setField('price', Number(e.target.value))} /></label>
      <label>Deposit amount <input type="number" step="0.01" value={order.depositAmount || ''} onChange={(e) => setField('depositAmount', Number(e.target.value))} /></label>
      <label><input type="checkbox" checked={!!order.depositPaid} onChange={(e) => setField('depositPaid', e.target.checked)} /> Deposit paid</label>

      <label>Notes <textarea value={order.notes || ''} onChange={(e) => setField('notes', e.target.value)} /></label>

      <TagInput tags={order.tags || []} onChange={handleTagsChange} />

      {!isNew && (
        <NeededItemsChecklist
          items={order.neededItems || []}
          onAdd={handleAddNeededItem}
          onToggle={handleToggleNeededItem}
          onRemove={handleRemoveNeededItem}
        />
      )}

      <button type="submit">Save</button>
      {!isNew && order.status === 'scheduled' && (
        <button type="button" onClick={handleArchive}>Mark Complete → Archive</button>
      )}
    </form>
  );
}
```

- [ ] **Step 4: Manually verify in the browser**

With both dev servers running, create a new order, fill in required fields, save, confirm it redirects to `/orders/:id`, add a needed item, add a tag, and archive it. Confirm no console errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/OrderForm.jsx client/src/components/NeededItemsChecklist.jsx client/src/components/TagInput.jsx
git commit -m "feat: add order form page with needed items and tag editing"
```

---

## Task 17: Photo Uploader Component

**Files:**
- Create: `client/src/components/PhotoUploader.jsx`
- Modify: `client/src/pages/OrderForm.jsx`

**Interfaces:**
- Consumes: `uploadPhoto`, `deletePhoto`, `setCoverPhoto` from `client/src/api/client.js`.
- Produces: `PhotoUploader` — props `{ orderId, photos: Array<{id,filePath,isCover}>, onChange(photos) }`.

- [ ] **Step 1: Write `client/src/components/PhotoUploader.jsx`**

```jsx
import * as api from '../api/client.js';

export default function PhotoUploader({ orderId, photos, onChange }) {
  async function handleUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const photo = await api.uploadPhoto(orderId, file);
    onChange([...photos, photo]);
    e.target.value = '';
  }

  async function handleRemove(photoId) {
    await api.deletePhoto(photoId);
    onChange(photos.filter((p) => p.id !== photoId));
  }

  async function handleSetCover(photoId) {
    const result = await api.setCoverPhoto(photoId, orderId);
    onChange(result.photos);
  }

  return (
    <div className="photo-uploader">
      <h3>Photos</h3>
      <div className="photo-grid">
        {photos.map((photo) => (
          <div key={photo.id} className={`photo-thumb ${photo.isCover ? 'is-cover' : ''}`}>
            <img src={`/uploads/${photo.filePath}`} alt="" />
            <button type="button" onClick={() => handleSetCover(photo.id)} disabled={photo.isCover}>
              {photo.isCover ? 'Cover' : 'Make Cover'}
            </button>
            <button type="button" onClick={() => handleRemove(photo.id)}>Remove</button>
          </div>
        ))}
      </div>
      <input type="file" accept="image/*" onChange={handleUpload} />
    </div>
  );
}
```

- [ ] **Step 2: Wire it into `client/src/pages/OrderForm.jsx`**

Add the import and, for existing orders, render it above the `<button type="submit">` line:

```jsx
import PhotoUploader from '../components/PhotoUploader.jsx';
// ...
{!isNew && (
  <PhotoUploader
    orderId={id}
    photos={order.photos || []}
    onChange={(photos) => setOrder((prev) => ({ ...prev, photos }))}
  />
)}
```

Also update the `load()` function's fetch to include photos — since `GET /api/orders/:id` doesn't return `photos` yet, add a follow-up fetch. The simplest correct approach: extend the backend response. Add this to `server/src/routes/orders.js`'s `withAttachments` (this is a small, necessary backend change for this task):

```js
import * as photos from '../db/photos.js';
// inside withAttachments:
photos: photos.listPhotos(order.id),
```

- [ ] **Step 3: Manually verify in the browser**

Upload two photos to an existing order, confirm the first becomes the cover automatically, click "Make Cover" on the second and confirm it swaps, then remove one and confirm it disappears and the file is gone from `data/uploads/<id>/`.

- [ ] **Step 4: Commit**

```bash
git add client/src/components/PhotoUploader.jsx client/src/pages/OrderForm.jsx server/src/routes/orders.js
git commit -m "feat: add photo uploader with cover photo selection"
```

---

## Task 18: Recipe Library Page & Recipe Attachment

**Files:**
- Modify: `client/src/pages/Recipes.jsx`
- Create: `client/src/components/RecipeAttach.jsx`
- Modify: `client/src/pages/OrderForm.jsx`

**Interfaces:**
- Consumes: `fetchRecipes`, `createRecipe`, `updateRecipe`, `deleteRecipe`, `attachRecipe`, `fetchOrderRecipes`, `updateOrderRecipe`, `deleteOrderRecipe` from the API client.
- Produces: `RecipeAttach` — props `{ orderId, orderRecipes: Array<{id,recipeName,ingredients,instructions}>, onChange(orderRecipes) }`.

- [ ] **Step 1: Write `client/src/pages/Recipes.jsx`**

```jsx
import { useState, useEffect } from 'react';
import * as api from '../api/client.js';

function emptyIngredient() { return { item: '', quantity: '', unit: '' }; }

export default function Recipes() {
  const [recipes, setRecipes] = useState([]);
  const [draft, setDraft] = useState({ name: '', ingredients: [emptyIngredient()], instructions: '' });

  useEffect(() => { api.fetchRecipes().then(setRecipes); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    const created = await api.createRecipe(draft);
    setRecipes((prev) => [...prev, created]);
    setDraft({ name: '', ingredients: [emptyIngredient()], instructions: '' });
  }

  async function handleDelete(id) {
    await api.deleteRecipe(id);
    setRecipes((prev) => prev.filter((r) => r.id !== id));
  }

  function updateDraftIngredient(idx, field, value) {
    setDraft((prev) => {
      const ingredients = [...prev.ingredients];
      ingredients[idx] = { ...ingredients[idx], [field]: value };
      return { ...prev, ingredients };
    });
  }

  return (
    <div className="recipes-page">
      <h1>Recipe Library</h1>
      <ul>
        {recipes.map((r) => (
          <li key={r.id}>
            <strong>{r.name}</strong>
            <button type="button" onClick={() => handleDelete(r.id)}>Delete</button>
          </li>
        ))}
      </ul>

      <form onSubmit={handleCreate}>
        <h2>New Recipe</h2>
        <label>Name <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required /></label>
        <h3>Ingredients</h3>
        {draft.ingredients.map((ing, idx) => (
          <div key={idx}>
            <input placeholder="item" value={ing.item} onChange={(e) => updateDraftIngredient(idx, 'item', e.target.value)} />
            <input placeholder="quantity" value={ing.quantity} onChange={(e) => updateDraftIngredient(idx, 'quantity', e.target.value)} />
            <input placeholder="unit" value={ing.unit} onChange={(e) => updateDraftIngredient(idx, 'unit', e.target.value)} />
          </div>
        ))}
        <button type="button" onClick={() => setDraft((prev) => ({ ...prev, ingredients: [...prev.ingredients, emptyIngredient()] }))}>
          Add Ingredient
        </button>
        <label>Instructions <textarea value={draft.instructions} onChange={(e) => setDraft({ ...draft, instructions: e.target.value })} /></label>
        <button type="submit">Save Recipe</button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Write `client/src/components/RecipeAttach.jsx`**

```jsx
import { useState, useEffect } from 'react';
import * as api from '../api/client.js';

export default function RecipeAttach({ orderId, orderRecipes, onChange }) {
  const [library, setLibrary] = useState([]);
  const [selected, setSelected] = useState('');

  useEffect(() => { api.fetchRecipes().then(setLibrary); }, []);

  async function handleAttach() {
    if (!selected) return;
    const attached = await api.attachRecipe(orderId, Number(selected));
    onChange([...orderRecipes, attached]);
  }

  async function handleFieldChange(id, field, value) {
    const updated = await api.updateOrderRecipe(id, { [field]: value });
    onChange(orderRecipes.map((r) => (r.id === id ? updated : r)));
  }

  async function handleRemove(id) {
    await api.deleteOrderRecipe(id);
    onChange(orderRecipes.filter((r) => r.id !== id));
  }

  return (
    <div className="recipe-attach">
      <h3>Recipes</h3>
      {orderRecipes.map((r) => (
        <div key={r.id} className="attached-recipe">
          <input value={r.recipeName} onChange={(e) => handleFieldChange(r.id, 'recipeName', e.target.value)} />
          <textarea value={r.instructions || ''} onChange={(e) => handleFieldChange(r.id, 'instructions', e.target.value)} />
          <button type="button" onClick={() => handleRemove(r.id)}>Remove</button>
        </div>
      ))}
      <select value={selected} onChange={(e) => setSelected(e.target.value)}>
        <option value="">Choose a recipe template…</option>
        {library.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
      </select>
      <button type="button" onClick={handleAttach}>Attach</button>
    </div>
  );
}
```

- [ ] **Step 3: Wire `RecipeAttach` into `client/src/pages/OrderForm.jsx`**

Add the import, load `orderRecipes` alongside the order in `load()`, and render the component for existing orders:

```jsx
import RecipeAttach from '../components/RecipeAttach.jsx';
// inside load(), after setOrder(data):
const orderRecipes = await api.fetchOrderRecipes(id);
setOrder((prev) => ({ ...prev, orderRecipes }));
// ...
{!isNew && (
  <RecipeAttach
    orderId={id}
    orderRecipes={order.orderRecipes || []}
    onChange={(orderRecipes) => setOrder((prev) => ({ ...prev, orderRecipes }))}
  />
)}
```

- [ ] **Step 4: Manually verify in the browser**

Create a recipe template in `/recipes`, open an existing order, attach the template, edit the attached copy's instructions, and confirm the template in `/recipes` is unchanged.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Recipes.jsx client/src/components/RecipeAttach.jsx client/src/pages/OrderForm.jsx
git commit -m "feat: add recipe library page and per-order recipe attachment"
```

---

## Task 19: Scheduling Dashboard (Calendar + Upcoming List)

**Files:**
- Modify: `client/src/pages/Dashboard.jsx`
- Create: `client/src/components/CalendarGrid.jsx`
- Create: `client/src/components/UpcomingList.jsx`

**Interfaces:**
- Consumes: `fetchOrders('scheduled')` from the API client.
- Produces: `CalendarGrid` — props `{ orders: Array<{id,slug,dueDate,theme,customerName}>, month: Date, onMonthChange(Date) }`, renders a month grid with orders on their due date, each linking to `/orders/:id`. `UpcomingList` — props `{ orders }`, renders a simple sorted list.

- [ ] **Step 1: Write `client/src/components/CalendarGrid.jsx`**

```jsx
import { Link } from 'react-router-dom';

function daysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

export default function CalendarGrid({ orders, month, onMonthChange }) {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const totalDays = daysInMonth(year, monthIndex);
  const firstWeekday = new Date(year, monthIndex, 1).getDay();

  const ordersByDay = {};
  for (const order of orders) {
    const d = new Date(order.dueDate);
    if (d.getFullYear() === year && d.getMonth() === monthIndex) {
      const day = d.getDate();
      (ordersByDay[day] ||= []).push(order);
    }
  }

  const cells = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= totalDays; day += 1) cells.push(day);

  return (
    <div className="calendar-grid">
      <div className="calendar-header">
        <button type="button" onClick={() => onMonthChange(new Date(year, monthIndex - 1, 1))}>‹</button>
        <span>{month.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
        <button type="button" onClick={() => onMonthChange(new Date(year, monthIndex + 1, 1))}>›</button>
      </div>
      <div className="calendar-cells">
        {cells.map((day, idx) => (
          <div key={idx} className="calendar-cell">
            {day && <div className="day-number">{day}</div>}
            {day && (ordersByDay[day] || []).map((order) => (
              <Link key={order.id} to={`/orders/${order.id}`} className="calendar-order">
                {order.theme || order.customerName}
              </Link>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `client/src/components/UpcomingList.jsx`**

```jsx
import { Link } from 'react-router-dom';

export default function UpcomingList({ orders }) {
  const sorted = [...orders].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  return (
    <ul className="upcoming-list">
      {sorted.map((order) => (
        <li key={order.id}>
          <Link to={`/orders/${order.id}`}>
            <strong>{order.dueDate}</strong> — {order.theme || 'Untitled'} ({order.customerName})
          </Link>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 3: Write `client/src/pages/Dashboard.jsx`**

```jsx
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api/client.js';
import CalendarGrid from '../components/CalendarGrid.jsx';
import UpcomingList from '../components/UpcomingList.jsx';

export default function Dashboard() {
  const [orders, setOrders] = useState([]);
  const [month, setMonth] = useState(new Date());

  const load = useCallback(() => { api.fetchOrders('scheduled').then(setOrders); }, []);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="dashboard">
      <h1>Schedule</h1>
      <Link to="/orders/new">+ New Order</Link>
      <CalendarGrid orders={orders} month={month} onMonthChange={setMonth} />
      <h2>Upcoming</h2>
      <UpcomingList orders={orders} />
    </div>
  );
}
```

- [ ] **Step 4: Manually verify in the browser**

Create a couple of scheduled orders with different due dates, confirm they appear both on the correct calendar day and in the upcoming list, and confirm month navigation works.

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Dashboard.jsx client/src/components/CalendarGrid.jsx client/src/components/UpcomingList.jsx
git commit -m "feat: add scheduling dashboard with calendar grid and upcoming list"
```

---

## Task 20: Archive Grid Page with Search

**Files:**
- Modify: `client/src/pages/Archive.jsx`

**Interfaces:**
- Consumes: `fetchOrders('archived')`, `searchArchive(query)` from the API client.

- [ ] **Step 1: Write `client/src/pages/Archive.jsx`**

```jsx
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api/client.js';

export default function Archive() {
  const [orders, setOrders] = useState([]);
  const [query, setQuery] = useState('');

  useEffect(() => { api.fetchOrders('archived').then(setOrders); }, []);

  useEffect(() => {
    const handle = setTimeout(() => {
      if (query.trim()) {
        api.searchArchive(query.trim()).then(setOrders);
      } else {
        api.fetchOrders('archived').then(setOrders);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query]);

  return (
    <div className="archive-page">
      <h1>Archive</h1>
      <input
        placeholder="Search by customer, theme, flavor, tag…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="archive-grid">
        {orders.map((order) => {
          const cover = (order.photos || []).find((p) => p.isCover) || (order.photos || [])[0];
          return (
            <Link key={order.id} to={`/archive/${order.slug}`} className="archive-card">
              {cover && <img src={`/uploads/${cover.filePath}`} alt="" />}
              <h3>{order.theme || 'Untitled'}</h3>
              <p>{order.customerName} — {order.dueDate}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manually verify in the browser**

Archive a couple of orders with photos, confirm they appear as cards with cover photos, search by a customer name and by a tag, confirm the grid filters correctly, and confirm clearing the search restores the full grid.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/Archive.jsx
git commit -m "feat: add archive grid page with debounced search"
```

---

## Task 21: Archive Detail Page (Recipe-Page Layout)

**Files:**
- Modify: `client/src/pages/ArchiveDetail.jsx`

**Interfaces:**
- Consumes: `fetchOrderBySlug(slug)` from the API client.

- [ ] **Step 1: Write `client/src/pages/ArchiveDetail.jsx`**

```jsx
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import * as api from '../api/client.js';

export default function ArchiveDetail() {
  const { slug } = useParams();
  const [order, setOrder] = useState(null);

  useEffect(() => {
    api.fetchOrderBySlug(slug).then(async (data) => {
      const orderRecipes = await api.fetchOrderRecipes(data.id);
      setOrder({ ...data, orderRecipes });
    });
  }, [slug]);

  if (!order) return <p>Loading…</p>;

  return (
    <div className="archive-detail">
      <Link to={`/orders/${order.id}`}>Edit</Link>
      <div className="archive-detail-top">
        <div className="archive-photos">
          {(order.photos || []).map((photo) => (
            <img key={photo.id} src={`/uploads/${photo.filePath}`} alt="" />
          ))}
        </div>
        <div className="archive-info">
          <h1>{order.theme}</h1>
          <p>{order.customerName} — {order.dueDate}</p>
          <p>{order.dimensions} · {order.servings} servings</p>
          <p>Flavors: {order.flavors}</p>
          <p>{order.description}</p>
          <div className="tags">{(order.tags || []).map((t) => <span key={t} className="tag-chip">{t}</span>)}</div>
        </div>
      </div>
      <div className="archive-recipes">
        {(order.orderRecipes || []).map((r) => (
          <section key={r.id}>
            <h2>{r.recipeName}</h2>
            <ul>
              {r.ingredients.map((ing, idx) => (
                <li key={idx}>{ing.quantity} {ing.unit} {ing.item}</li>
              ))}
            </ul>
            <p>{r.instructions}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Manually verify in the browser**

Open an archived order's detail page from the archive grid, confirm photos render on the left, basic info on the right, and recipes/ingredients below, matching the spec's recipe-page layout.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/ArchiveDetail.jsx
git commit -m "feat: add recipe-page-style archive detail view"
```

---

## Task 22: Settings Page (Google Calendar Connect)

**Files:**
- Modify: `client/src/pages/Settings.jsx`

**Interfaces:**
- Consumes: `fetchCalendarStatus`, `fetchCalendarAuthUrl` from the API client.

- [ ] **Step 1: Write `client/src/pages/Settings.jsx`**

```jsx
import { useState, useEffect } from 'react';
import * as api from '../api/client.js';

export default function Settings() {
  const [connected, setConnected] = useState(null);

  useEffect(() => { api.fetchCalendarStatus().then((s) => setConnected(s.connected)); }, []);

  async function handleConnect() {
    const { url } = await api.fetchCalendarAuthUrl();
    window.location.href = url;
  }

  return (
    <div className="settings-page">
      <h1>Settings</h1>
      <h2>Google Calendar</h2>
      {connected === null && <p>Checking connection…</p>}
      {connected === true && <p>Connected ✓</p>}
      {connected === false && <button type="button" onClick={handleConnect}>Connect Google Calendar</button>}
    </div>
  );
}
```

- [ ] **Step 2: Manually verify in the browser**

With real `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI` set on the server (see Task 12's note on creating OAuth credentials), click "Connect Google Calendar," complete the consent flow, and confirm the page shows "Connected ✓" afterward and that a newly-saved order creates a matching event.

- [ ] **Step 3: Commit**

```bash
git add client/src/pages/Settings.jsx
git commit -m "feat: add Google Calendar connection settings page"
```

---

## Task 23: Production Build Wiring & Pi Deployment

**Files:**
- Modify: `server/src/app.js`
- Create: `whippedwisps.service` (systemd unit, repo root)
- Create: `README.md` (deployment instructions)

**Interfaces:**
- Produces: in production (`NODE_ENV=production`), Express serves `client/dist` for any non-`/api`, non-`/uploads` request, so the whole app is reachable from a single port.

- [ ] **Step 1: Update `server/src/app.js` to serve the built client in production**

Add near the bottom, before `app.use(errorHandler)`:

```js
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.resolve('../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}
```

- [ ] **Step 2: Verify a production build serves correctly**

Run: `npm run build:client && NODE_ENV=production DB_PATH=./data/whippedwisps.db UPLOADS_DIR=./data/uploads npm run start -w server`
Then visit `http://localhost:3001` in a browser.
Expected: the Dashboard page loads (not a 404), and `/api/orders` still returns JSON.

- [ ] **Step 3: Write `whippedwisps.service`**

```ini
[Unit]
Description=Whipped Wisps cake order/archive app
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/pi/whippedwisps/server
Environment=NODE_ENV=production
Environment=PORT=3001
Environment=DB_PATH=/home/pi/whippedwisps-data/whippedwisps.db
Environment=UPLOADS_DIR=/home/pi/whippedwisps-data/uploads
EnvironmentFile=/home/pi/whippedwisps-data/secrets.env
ExecStart=/usr/bin/node src/server.js
Restart=on-failure
User=pi

[Install]
WantedBy=multi-user.target
```

- [ ] **Step 4: Write `README.md`**

```markdown
# Whipped Wisps

Personal cake order scheduler and archive, self-hosted on a Raspberry Pi 5, accessed over Tailscale.

## Local development

npm install
npm run dev:server   # in one terminal
npm run dev:client   # in another — opens on http://localhost:5173

## Google Calendar setup

1. Create a Google Cloud project, enable the Calendar API, and create an OAuth 2.0 Client ID
   (type: Web application). Add `http://<your-pi-tailnet-hostname>:3001/api/settings/calendar/callback`
   as an authorized redirect URI.
2. Create `/home/pi/whippedwisps-data/secrets.env` on the Pi with:
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=http://<your-pi-tailnet-hostname>:3001/api/settings/calendar/callback
3. Visit `/settings` in the app and click "Connect Google Calendar."

## Deploying to the Pi

1. `git clone` this repo to `/home/pi/whippedwisps`.
2. `mkdir -p /home/pi/whippedwisps-data` and place `secrets.env` there (see above).
3. `npm install && npm run build:client`.
4. Copy `whippedwisps.service` to `/etc/systemd/system/` and run:
   sudo systemctl daemon-reload
   sudo systemctl enable --now whippedwisps
5. Join the Pi to your Tailscale network (`tailscale up`) and access the app at
   `http://<pi-tailnet-hostname>:3001`.

## Backups

A daily cron job should copy `/home/pi/whippedwisps-data/whippedwisps.db` and
`/home/pi/whippedwisps-data/uploads/` to a separate drive or cloud folder.
```

- [ ] **Step 5: Commit**

```bash
git add server/src/app.js whippedwisps.service README.md
git commit -m "feat: wire production static serving and add Pi deployment docs"
```

---

## Plan Self-Review Notes

- **Spec coverage:** Scheduling dashboard (Task 19), order CRUD + needed items + delivery fields (Tasks 4, 8, 9, 16), photos (Tasks 6, 10, 17), archive grid + broad search (Tasks 4, 20), archive detail recipe-page layout (Task 21), recipe template library + copy-on-attach (Tasks 7, 11, 18), Google Calendar OAuth + auto-sync + customizable reminders + non-blocking failure handling (Tasks 12–14, 22), no-login/Tailscale-only access (no auth code anywhere, per Global Constraints), deployment on the Pi (Task 23) — all spec sections have a corresponding task.
- **Type consistency:** verified `googleEventId`/`reminderOffsets` naming matches from Task 4's data layer through Task 13's calendar service and Task 14's route wiring; `OrderRecipe` field names (`recipeName`, `ingredients`, `instructions`) match from Task 7 through Task 18's frontend.
- **No placeholders:** every step has runnable code; the one deliberately deferred item (drag-to-reorder photos) is called out explicitly in the spec's Out of Scope section, not silently dropped.
