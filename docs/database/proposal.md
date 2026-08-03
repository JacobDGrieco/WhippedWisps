# Database Proposal

## Proposed Design

Create the initial SQLite schema described in `docs/superpowers/specs/2026-08-01-cake-archive-design.md`.

Add `order_items` as an order-owned child table so one customer order can contain multiple product types, such as cakes, cake pops, cupcakes, or other bakery items. Keep the existing `orders.dimensions`, `orders.servings`, `orders.flavors`, and `orders.price` columns as legacy compatibility fields for now, and backfill a single `cake` line item from them only when an existing order has no child items.

Extend `order_items` with type-specific fields:

- `theme` for every item type.
- `flavors` and `price` for cake, tiered cake, cupcakes, cake pops, and cookies.
- `dimensions` for single cakes and `servings` for cakes and tiered cakes.
- `count` for cupcakes, cake pops, and cookies.
- `tier_count` and `tier_details` JSON for tiered cake child rows, with tier-level dimensions and flavors.
- `notes` and `price` for other custom items.

## Classification

Safe additive. This is the first application schema and there is no existing database content in the repository.

The `order_items` change is additive with application coordination. It does not remove existing columns, and its backfill is idempotent for local databases.

The type-specific item fields are safe additive. Existing rows receive nullable columns plus a JSON default for `tier_details`.

## Application Features Covered

- Scheduling dashboard and upcoming list read from `orders`.
- Order editor writes `orders`, `needed_items`, `tags`, `photos`, and `order_recipes`.
- Order editor writes `order_items` as repeatable product lines for each order.
- Archive grid and search read archived `orders`, joined tags, and cover photos.
- Recipe library writes `recipes`; order recipe attachment copies template fields into `order_recipes`.
- Calendar settings and OAuth token storage use `settings`.

## Integrity And Operational Notes

- Foreign keys are enabled per connection and child rows cascade on order deletion.
- `order_items.order_id` cascades on order deletion and is ordered by `sort_order`.
- `orders.slug` and `tags.name` are unique.
- Status and delivery type are constrained to the spec-supported values.
- Runtime data remains outside the source tree via `DB_PATH` and `UPLOADS_DIR`.

## Rollback

Because this is a greenfield additive implementation, rollback is a source-control rollback plus removal of any disposable local `DB_PATH` created during development.

## Verification

- Unit tests should cover schema creation, CRUD, slug uniqueness, recipe copy-on-attach, Calendar payload construction, and search.
- Integration tests should cover representative order API flows.
- Order item verification should cover multi-item create/update payloads, legacy-field backfill, archive search, and Calendar description formatting.
- Type-specific item verification should cover cake, tiered cake, counted product, and custom other payload normalization.
