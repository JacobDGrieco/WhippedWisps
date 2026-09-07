# Mobile Responsive Standards

These standards apply to the Whipped Wisps client and extend the conventions already present in `client/src/styles.css`.

## Layout

- Treat 320px as the supported minimum CSS viewport width.
- Use content-driven responsive changes within the existing broad transition points near 900px and 560px. Add a breakpoint only when a specific component fails between them.
- Use `minmax(0, 1fr)`, `min-width: 0`, flexible wrapping, and `max-width: 100%` to contain content.
- Default phone workflows to one clear content column. Use two columns only when each control remains readable and touchable at intermediate widths.
- Do not create horizontal page scrolling. Locally scrollable regions are acceptable only when their content genuinely benefits from horizontal continuity, such as photo thumbnails or the compact primary navigation.
- Preserve DOM and focus order when changing visual layout.

## Spacing and safe areas

- Use the existing spacing rhythm and reduce outer shell/panel padding gradually, not below 12px at 320px.
- Fixed or sticky mobile controls must include `env(safe-area-inset-bottom)` clearance and must never cover focused fields or final content.
- Prefer `min-height: 100dvh` with a `100vh` fallback only where a full-height layout is actually needed.

## Typography and content

- Body and form text must remain at least 1rem where mobile browser input zoom is a concern.
- Use `clamp()` for large headings, with an explicit narrow-phone ceiling.
- Allow names, themes, tags, URLs, and recipe text to wrap. Use truncation only when the full value is available through the same interaction.
- Keep persistent labels on form controls. Placeholder text may provide an example but must not be the only label.

## Controls and navigation

- Aim for a minimum 44×44 CSS-pixel target for buttons, links used as controls, checkboxes with their label area, and calendar order actions.
- Maintain visible `:focus-visible` states and keyboard behavior.
- Keep the four primary destinations directly accessible on mobile; a compact scrollable tab row is preferred over hiding them in an unstructured menu.
- Hover styling must be supplementary. Every action must work through tap and keyboard input.
- Destructive actions remain available but should be visually separated from primary actions.

## Forms

- Use a single-column flow on narrow phones. Pair fields only when their relationship is clear and both remain comfortably usable.
- Use native input types, `inputMode`, and `autocomplete` when the field meaning permits it.
- Validation messages must be visible near the relevant workflow and focus must not be moved behind sticky UI.
- Repeated groups such as items, tiers, ingredients, and checklist entries need clear group boundaries and persistent field identity after stacking.
- Do not duplicate mobile and desktop form state or submission logic.

## Calendar and dense content

- The upcoming list is the primary phone schedule workflow.
- Preserve a recognizable month overview, but do not depend on tiny text links inside seven narrow columns for the only access to an order.
- If a selected-day agenda is implemented, expose selection with buttons and `aria-pressed` or an equivalent semantic state, and announce the selected date clearly.
- Preserve tabular semantics for true tables; choose cards or disclosures only when row comparison is not the primary task.

## Images and media

- Images must use `max-width: 100%`, a stable aspect ratio, and `object-fit` appropriate to the context.
- Below-the-fold archive and photo-grid images should be lazy-loaded where it does not delay essential content.
- Short landscape viewports should constrain hero/gallery media so identity, controls, and metadata remain reachable.
- Thumbnail strips may scroll horizontally and should use scroll padding and snap behavior without hiding keyboard focus.

## Accessibility and motion

- Preserve semantic landmarks, heading order, native form elements, zoom, and orientation support.
- Do not communicate state only through color, hover, or position.
- Ensure scrollable regions have visible focus and do not trap keyboard users.
- Respect `prefers-reduced-motion: reduce` by removing non-essential transforms and transitions.
- Test at 200% browser zoom and with enlarged text.

## Performance

- Do not render a separate hidden desktop DOM tree for mobile presentation.
- Avoid fetching separate data solely for hidden decorative regions.
- Add responsive image hints and lazy loading when the server's image metadata supports stable dimensions.
- Keep mobile CSS targeted; avoid animation or large visual effects that increase scrolling/render cost without aiding the workflow.

## Required verification

Test at 320, 360, 390, 430, 600, and 768 CSS pixels; at least one landscape phone; and desktop regression widths. Include long, empty, loading, error, and populated states. Run the client build and server test suite, then manually inspect horizontal overflow, touch targets, focus order, text zoom, keyboard interaction, and media behavior.
