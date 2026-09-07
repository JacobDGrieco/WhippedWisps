# Database Current State

Whipped Wisps is a greenfield personal-use application. Before this implementation, the repository had no database runtime, migrations, schema, application queries, seed data, or production database.

## Stack

- SQLite single-file database.
- `better-sqlite3` in the Express server.
- Source of truth is `server/src/db/schema.sql`.
- Runtime database path is configured by `DB_PATH`; local fallback is `./data/whippedwisps.db`.

## Tables

- `orders`: core scheduled or archived cake order record.
- `order_items`: repeatable product lines owned by an order, covering type, theme, dimensions, servings, flavors, count, price, custom notes, and tier details.
- `needed_items`: checklist rows owned by an order.
- `tags` and `order_tags`: freeform many-to-many labels for search and categorization.
- `photos`: uploaded image metadata owned by an order.
- `recipes`: reusable recipe templates.
- `order_recipes`: editable per-order recipe snapshots copied from templates.
- `settings`: server-side key/value store for Calendar OAuth tokens and calendar metadata.

## Risks And Assumptions

- There is no existing data to migrate.
- Tailscale is the intended access gate; the app intentionally has no login layer.
- Cascading deletes are acceptable for order-owned records because this is a single-user CMS and deletes are explicit.
- Date and time values are stored as text to match browser form inputs and Google Calendar payload construction.
- Legacy item summary columns still exist on `orders` for compatibility; new writes use `order_items`.
- `order_items.tier_details` stores tiered cake child rows as JSON because tiers are small, order-local, and not queried independently.
- Reminder offsets are stored in minutes for Google Calendar compatibility; the default is `[2880]`, which means two days before the due date.
- The tag catalog grows from saved orders; type, flavor, and dimension values from order items are automatically attached as order tags, while user-created tags are added when selected on an order.
- Money values are stored as `REAL` for this personal app; if bookkeeping accuracy becomes a requirement, prices should move to integer cents.
