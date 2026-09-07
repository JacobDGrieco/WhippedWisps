# Mobile Responsive Audit

## Scope and current state

This audit covers the React client in `client/src`: the shared application shell and all seven routes (`/`, `/orders/new`, `/orders/:id`, `/archive`, `/archive/:slug`, `/recipes`, and `/settings`). The application already has a valid viewport declaration, 44px primary controls, flexible media, and two broad breakpoints at 900px and 560px. No API, database, route, authentication, or permission changes are proposed.

The existing responsive CSS is a useful foundation, but it largely stacks desktop regions at 900px. Several components still carry desktop density into a phone viewport, and the 560px rules do not fully address navigation height, calendar legibility, form affordances, long content, or landscape phones.

## Mobile priorities

1. See upcoming orders and create or open an order quickly.
2. Enter and edit order details without horizontal scrolling or obscured actions.
3. Find an archived cake and inspect its photos, items, and recipes.
4. Maintain recipe templates and order checklists with touch-friendly controls.
5. Connect or disconnect the calendar safely.

All current capabilities should remain available on phones. No feature removal is required for the first implementation pass.

## Inventory by route

| Route | Primary goal | Essential | Secondary/contextual | Desktop assumptions and mobile risks |
| --- | --- | --- | --- | --- |
| Schedule `/` | Find the next cake or create an order | Page title, New Order, upcoming list | Monthly calendar | Calendar keeps a seven-column desktop representation; order labels become very small and cells provide weak tap targets at 320–430px. |
| New/edit order | Create or maintain an order | Header actions, customer/due fields, items, save | Notes, tags, reminders, supplies, photos, recipes, archive/resync/delete | Long form actions are only at the top; fields stack, but item and tier layouts lose grouping; ingredient rows rely on placeholders; destructive actions are visually crowded. |
| Archive `/archive` | Search and open a completed cake | Search, result cards | Decorative image treatment | Search is unlabeled and only has a placeholder; large headings plus a full-width stacked search use substantial vertical space; card grid should resolve to one useful column at narrow widths. |
| Archive detail | Review a completed order | Identity, customer/date, photos, items | Tags and recipe details | Photo controls and chips can crowd; dense recipe cards become a long stream; large media can dominate short landscape viewports. |
| Recipes `/recipes` | Review templates or create one | Saved recipes, recipe form, save/delete | None | Ingredient inputs lose their column meaning when stacked because they use placeholders rather than persistent labels; delete actions need clearer separation. |
| Settings `/settings` | Manage calendar connection | Status and connection action | None | Low layout risk; action should fill available width only on narrow phones and status text must wrap. |

## Findings and proposed behavior

### 1. Shared header and primary navigation

- **Files:** `client/src/App.jsx`, `client/src/styles.css`
- **Current behavior:** At 560px the four navigation links form a two-by-two grid beneath an oversized brand heading. At intermediate widths the links wrap based on available space.
- **Failure range:** Most visible at 320–430px and landscape phones with limited height.
- **Root cause:** Desktop navigation is wrapped rather than reorganized, so the header consumes a large portion of the first viewport.
- **Impact:** Slows access to page content; polish and task-completion cost, but not a blocker.
- **Recommended change:** Keep all four destinations, reduce mobile brand scale and header spacing, and make the nav a single horizontally scrollable tab row with visible current state and scroll padding. Do not use a menu because there are only four peer destinations and direct access is valuable.
- **Desktop effect:** None above the content-driven breakpoint.
- **Accessibility:** Preserve the existing semantic `nav`, focus styles, and 44px targets. Do not hide destinations.
- **Performance:** Neutral.
- **Verification:** 320, 360, 390, 430, 568×320, keyboard focus, and 200% zoom.
- **Risk:** Low.

### 2. Page headings and actions

- **Files:** all page files, `client/src/styles.css`
- **Current behavior:** Headings and their actions stack at 900px; buttons only become a vertical group below 560px.
- **Failure range:** 320–600px, especially long order themes and archive titles.
- **Root cause:** Very large fluid type and generic stacking without explicit overflow handling.
- **Impact:** Long text can dominate the viewport; header actions can become separated from the task context.
- **Recommended change:** Tighten mobile type with `clamp()`, allow safe word wrapping, make action groups full-width on narrow phones, and keep each action at least 44px. Preserve action order and semantics.
- **Desktop effect:** None above 900px.
- **Accessibility:** Improves text zoom and touch use.
- **Performance:** Neutral.
- **Verification:** Long customer/theme strings, 200% text enlargement, 320px and landscape.
- **Risk:** Low.

### 3. Schedule calendar

- **Files:** `client/src/components/CalendarGrid.jsx`, `client/src/pages/Dashboard.jsx`, `client/src/styles.css`
- **Current behavior:** A seven-column month grid remains visible on phones with 68px cells and 0.68rem order labels.
- **Failure range:** 320–430px. At 320px, the panel's internal width leaves roughly 39px per day column.
- **Root cause:** A dense month grid is scaled down instead of being adapted for phone reading and tapping.
- **Impact:** Order names are hard to scan and links can be smaller than comfortable touch targets. This materially slows schedule use.
- **Recommended default:** Preserve the month overview but show compact day indicators/counts at narrow widths, with the upcoming list as the primary phone workflow. A subsequent medium-risk enhancement can add a selected-day agenda below the grid so every calendar order remains directly accessible without tiny links.
- **Alternative considered:** Horizontal calendar scrolling preserves labels but makes month scanning and week comparison harder. Hiding the calendar removes useful capability and is not proposed.
- **Desktop effect:** None.
- **Accessibility:** Day summaries need explicit accessible names; links must remain reachable through the agenda.
- **Performance:** Neutral; no extra fetching is needed.
- **Verification:** Months beginning on every weekday, multiple orders per date, current-day state, keyboard navigation.
- **Risk:** Medium because it changes the phone interaction model. The first low-risk pass should improve containment and legibility without removing links; selected-day behavior should follow explicit review.

### 4. Order form structure and save access

- **Files:** `client/src/pages/OrderForm.jsx`, `client/src/styles.css`
- **Current behavior:** Desktop grids stack at 900px. Save and Back remain only in the page heading, while the form may be many screens long. Existing `padding-bottom` is large but does not provide a persistent action.
- **Failure range:** All phone widths; landscape is especially constrained.
- **Root cause:** The workflow retains desktop action placement and generic section stacking.
- **Impact:** Users must scroll back to save; repeated item editing is slower and error-prone.
- **Recommended default:** Keep Back and Save at the top in the low-risk pass, improve mobile section density and grouping, and replace the arbitrary large bottom padding. A sticky bottom Save action is a medium-risk follow-up because it must account for safe areas, keyboard visibility, duplicate submit controls, and content obstruction.
- **Desktop effect:** Low-risk styling has none. A future sticky action would be mobile-only.
- **Accessibility:** Maintain native form submission, visible labels, error messages, focus order, and safe-area clearance.
- **Performance:** Neutral.
- **Verification:** Create/edit states, save loading state, validation errors, on-screen keyboard, and 200% zoom.
- **Risk:** Low for layout; medium for sticky actions.

### 5. Order items, tiers, and form fields

- **Files:** `client/src/pages/OrderForm.jsx`, `client/src/components/ThemeInput.jsx`, `client/src/components/TagInput.jsx`, `client/src/styles.css`
- **Current behavior:** Horizontal desktop item fields switch to one-column grids at 900px. Tier rows also collapse, but their vertical writing-mode label and inherited fixed flex bases remain desktop-oriented. Several numeric inputs omit `inputMode="numeric"`.
- **Failure range:** 320–768px.
- **Root cause:** Width overrides change columns without fully resetting desktop sizing and presentation assumptions.
- **Impact:** Excessive scrolling, weak grouping, potential overflow with long tags/themes, and suboptimal keyboards.
- **Recommended change:** Reset mobile flex bases/min-widths, use a compact two-column layout only where content comfortably supports it and one column at narrow widths, make tier headings horizontal, wrap long tokens, and add suitable input modes/autocomplete where the field meaning is known.
- **Desktop effect:** None.
- **Accessibility:** Better labels, zoom behavior, and keyboard selection; DOM order remains unchanged.
- **Performance:** Neutral.
- **Verification:** Each item type, tiered cakes with several tiers, long themes/tags, empty and validation states.
- **Risk:** Low.

### 6. Ingredient editors and checklists

- **Files:** `client/src/pages/Recipes.jsx`, `client/src/components/RecipeAttach.jsx`, `client/src/components/NeededItemsChecklist.jsx`, `client/src/styles.css`
- **Current behavior:** Ingredient rows become single-column below 560px. Their field meaning is conveyed only through placeholders. Checklist checkbox, text field, and Remove button also become three anonymous rows.
- **Failure range:** 320–560px and text zoom.
- **Root cause:** Desktop column context disappears when controls stack.
- **Impact:** Form comprehension and accessibility are impaired; placeholder text disappears after entry.
- **Recommended change:** Add persistent accessible labels (visually compact where appropriate), group each ingredient as a mobile sub-card, retain clear Remove placement, and keep checkbox plus label editing logically paired.
- **Desktop effect:** Labels may be visually hidden or expressed as a shared heading row on desktop.
- **Accessibility:** Material improvement for screen readers and cognitive clarity.
- **Performance:** Negligible.
- **Verification:** Screen-reader names, keyboard sequence, multiple ingredients/items, 320px and 200% zoom.
- **Risk:** Medium because JSX changes are required, though data behavior is unchanged.

### 7. Archive search, cards, and detail media

- **Files:** `client/src/pages/Archive.jsx`, `client/src/pages/ArchiveDetail.jsx`, `client/src/styles.css`
- **Current behavior:** Search uses only placeholder text; cards use image-overlay copy; detail media and controls stack acceptably but remain large.
- **Failure range:** 320–430px and 568×320 landscape.
- **Root cause:** Search lacks a persistent label; image ratios and maximum heights are optimized for portrait desktop/tablet presentation.
- **Impact:** Search accessibility issue; media can push essential metadata below the fold; overlay text may struggle with unusually bright images.
- **Recommended change:** Add an accessible search label/type, enforce one-column cards on narrow phones, improve overlay contrast, constrain media with viewport-aware sizing in short landscape viewports, and preserve the explicit Previous/Next controls and scrollable thumbnail strip.
- **Desktop effect:** None except the added accessible label.
- **Accessibility:** Improves input naming and content readability.
- **Performance:** Add `loading="lazy"` and image dimensions/aspect-ratio where feasible to reduce mobile transfer/render pressure and layout shift.
- **Verification:** No-photo, one-photo, many-photo states; bright photos; long titles; keyboard and screen reader.
- **Risk:** Low.

### 8. Safe overflow and long content

- **Files:** `client/src/styles.css` and shared components
- **Current behavior:** Some grid children use `minmax(0, 1fr)`, but long URLs, names, tags, recipe steps, and control labels do not have a consistent overflow policy.
- **Failure range:** Any narrow width or enlarged text.
- **Root cause:** Missing `min-width: 0`, wrapping, and overflow-wrap rules at component boundaries.
- **Impact:** Potential horizontal page scrolling or clipped content.
- **Recommended change:** Apply targeted `min-width: 0`, `overflow-wrap: anywhere`, and `max-width: 100%`; avoid global clipping.
- **Desktop effect:** Only unusually long content wraps sooner.
- **Accessibility:** Supports zoom and localization.
- **Performance:** Neutral.
- **Verification:** Synthetic long strings and URLs at every target width.
- **Risk:** Low.

## Implementation stages

### Stage 1 — low risk

- Refine shared spacing, header navigation, page headings, action wrapping, long-content containment, media sizing, card columns, and touch targets.
- Reset desktop field sizing in stacked mobile layouts and improve tier presentation.
- Improve calendar containment and legibility without removing order links.
- Add mobile/landscape and reduced-motion rules using the existing breakpoint system.
- Add semantic/accessibility attributes that do not alter workflows.

### Stage 2 — medium risk

- Add persistent labels and mobile grouping to ingredients and checklist rows.
- Consider a selected-day calendar agenda while keeping the month overview.
- Consider a safe-area-aware sticky Save action for long order forms.
- Add responsive/lazy image hints after confirming image metadata availability.

### Stage 3 — high risk (deferred)

No high-risk work is currently necessary. No routes, capabilities, API calls, permissions, or data contracts should be removed or changed.

## Product decisions requested before broad implementation

1. **Calendar on phones:** Recommended: retain the compact month grid and add a selected-day agenda so order links remain comfortable to use. The simpler option is to keep the existing tiny links, which preserves behavior but remains harder to use.
2. **Order Save action:** Recommended: add a phone-only sticky Save bar after the layout pass. This improves long-form completion but consumes viewport space and needs careful keyboard/safe-area testing. Keeping Save only at the top avoids that complexity.

All other changes can proceed using the recommended low-risk defaults without reducing functionality.

## Verification plan

- Viewports: 320×568, 360×800, 390×844, 430×932, 568×320, 800×360, 600×960, 768×1024, 1024px, and 1440px.
- States: loading, empty, error, long content, no/many photos, every order item type, several tiers/ingredients, new and archived orders, connected/disconnected calendar.
- Interaction: keyboard navigation, visible focus, touch targets, browser zoom, text enlargement, on-screen keyboard, and reduced motion.
- Automated checks: `npm run build:client` and `npm run test:server`. This repository currently has no client lint, type-check, unit-test, or visual-regression scripts.
- Manual checks: horizontal page overflow, sticky/fixed obstruction, focus order, calendar link reachability, image layout shift, and desktop regressions.

