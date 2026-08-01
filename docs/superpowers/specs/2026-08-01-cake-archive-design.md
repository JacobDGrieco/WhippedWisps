# Whipped Wisps — Cake Order & Archive App — Design

**Date:** 2026-08-01
**Status:** Approved for planning

## Purpose

A personal-use web app, self-hosted on a Raspberry Pi 5, for managing cake orders end-to-end:

- Schedule upcoming cake orders (customer, dates, theme, dimensions, price, delivery details, needed items).
- Sync scheduled orders to a dedicated Google Calendar with customizable reminders.
- Once an order is complete, manually archive it into a public-style grid of cards.
- Each archived card opens a recipe-page-style detail view: photos left, basic info right, recipe/ingredients below.
- Fully editable at any time — this is a personal CMS, not a static record.

Single user (the baker). No customer-facing accounts, no public internet exposure.

## Access & Security

- Reachable only via **Tailscale** (the Pi joins the owner's tailnet; accessed by tailnet hostname). No ports exposed on the home router, no reverse proxy, no TLS cert management (Tailscale provides its own).
- **No login/auth on the app itself** — Tailscale network membership is the sole access gate.

## Architecture & Stack

- **Backend:** Express (Node.js) — REST API.
- **Database:** SQLite, single file (e.g. `whippedwisps.db`), accessed via `better-sqlite3` with a thin query layer (no heavyweight ORM needed at this scale).
- **Frontend:** React SPA built with Vite. In production, Express serves the built static assets directly; anything not matching `/api/*` falls through to the SPA. In dev, Vite's dev server proxies API calls to Express. This keeps production to a single Node process — no separate frontend server, no Next.js framework conventions.
- **Photo storage:** Local disk on the Pi (e.g. `uploads/<order-id>/...`), served by Express as static files.
- **Process management:** systemd service, `Restart=on-failure`, enabled on boot.
- **Data location:** the SQLite DB file and `uploads/` directory live outside the app's source tree (e.g. `/home/pi/whippedwisps-data/`) so redeploys never touch stored data.
- **Backups:** daily cron copying the DB file + `uploads/` to another drive/cloud folder. No dedicated backup tooling needed at this scale.

## Data Model

### Order
The core entity. Represents a cake order in either `scheduled` or `archived` status — archiving is a manual status flip, not automatic or date-driven.

| Field | Notes |
|---|---|
| `id` | primary key |
| `slug` | generated from `theme` + `customerName` (kebab-case), with a numeric suffix appended on collision; used for `/archive/:slug` URLs |
| `status` | `scheduled` \| `archived` |
| `customerName`, `customerContact` | free text |
| `orderDate`, `dueDate`, `dueTime` | |
| `deliveryType` | `pickup` \| `delivery` |
| `deliveryAddress`, `deliveryWindowStart`, `deliveryWindowEnd` | only relevant when `deliveryType = delivery` |
| `theme`, `description`, `dimensions`, `servings`, `flavors` | cake info |
| `price`, `depositAmount`, `depositPaid` | money |
| `notes` | free text |
| `googleEventId` | nullable; set once synced to Calendar |
| `reminderOffsets` | JSON array of minutes-before-due, customizable per order |

### NeededItem
Checklist rows attached to an order (board size, boxes, toppers, etc.), addable/removable per order.

| Field | Notes |
|---|---|
| `id`, `orderId` | |
| `label` | |
| `done` | bool |

### Tag / OrderTag
Freeform tags (many-to-many with Order), used for categorization and archive search.

### Photo
| Field | Notes |
|---|---|
| `id`, `orderId` | |
| `filePath` | |
| `sortOrder` | for future drag-reorder |
| `isCover` | marks the archive-grid thumbnail; defaults to first uploaded |

### Recipe (template library)
Reusable templates, edited independently via `/recipes`.

| Field | Notes |
|---|---|
| `id`, `name` | e.g. "Vanilla Sponge" |
| `ingredients` | structured list: `{ item, quantity, unit }` |
| `instructions` | free text |

### OrderRecipe (per-order editable snapshot)
Attaching a `Recipe` template to an order **copies** its `name`/`ingredients`/`instructions` into a new `OrderRecipe` row at attach-time. Subsequent edits to the `OrderRecipe` never affect the template, and subsequent edits to the template never affect past orders' copies.

| Field | Notes |
|---|---|
| `id`, `orderId` | |
| `recipeName`, `ingredients`, `instructions` | copied from template, then freely editable |

## Pages & Features

- **`/` — Scheduling dashboard:** month calendar grid showing scheduled orders on their due dates, plus a chronological upcoming-orders list. Click through to order detail.
- **`/orders/new`, `/orders/:id` — Order form:** single inline-editable page covering all Order fields, the needed-items checklist, photo upload, tag editing, and recipe attachment (select a template → copies in as an `OrderRecipe`, then edit freely). A "Mark Complete → Archive" action flips `status` to `archived`.
- **`/archive` — Archive grid:** card grid (cover photo, customer/theme, date) of all `archived` orders. Search box matches across customer name, theme, description, flavors, and tags (broad match, not tag-only).
- **`/archive/:slug` — Archive detail:** recipe-page layout — photos left, basic info right (theme, dimensions, servings, flavors, date, tags), recipe(s) + ingredients below. Same Order record as the order form, just `status: archived` — fully editable after the fact (fix typos, add photos, etc.).
- **`/recipes` — Recipe library:** list/create/edit/delete templates.
- **`/settings` — Google Calendar auth:** one-time OAuth authorization flow; stores the refresh token server-side (not committed to git).

## Google Calendar Integration

- Events sync to a **dedicated calendar** (e.g. "Whipped Wisps Orders") under the owner's Google account, not the primary calendar.
- **Auto-sync on save:** creating an order creates the Calendar event; editing (date/time/theme/etc.) updates it; deleting the order deletes the event. `googleEventId` tracks the link.
- **Reminders are customizable per order:** UI lets the user pick offsets (e.g. "1 day before", "3 days before", "morning of"), stored in `reminderOffsets`, mapped to the event's `reminders.overrides`.
- **Sync failures are non-blocking:** if the Calendar API call fails, the order save still succeeds; the UI shows a small "Calendar sync failed" warning with a manual "Resync" button. No background job queue at this scale.

## Error Handling

- Server-side validation of required fields (dates, required text); 4xx responses carry messages the frontend surfaces inline near the relevant field.
- Unexpected 5xx errors show a generic "something went wrong" toast rather than a blank screen.
- Calendar sync failures are surfaced but never block saving order data (see above).

## Testing Approach

Pragmatic, matched to a personal single-user app:

- Unit tests (Vitest or Node's built-in test runner) for data-layer logic: order CRUD, the recipe-copy-on-attach behavior, Calendar event payload building, search/filter matching.
- No automated browser/E2E tests (no Playwright, per standing instruction) — manual verification in the browser for UI flows during implementation.

## Out of Scope (for this spec)

- Multi-user accounts or customer-facing login.
- Drag-to-reorder photos / cover-photo picker UI (data fields exist, but the interaction can be a fast-follow).
- Background job queue / automatic retry for Calendar sync.
- Public internet exposure, reverse proxy, or TLS setup beyond Tailscale.
