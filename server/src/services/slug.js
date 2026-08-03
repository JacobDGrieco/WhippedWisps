const DASHES = /-+/g;
const NON_SLUG_CHARS = /[^a-z0-9]+/g;

function slugify(text) {
	const slug = text
		.toLowerCase()
		.replace(/'/g, '')
		.replace(NON_SLUG_CHARS, '-')
		.replace(DASHES, '-')
		.replace(/^-+|-+$/g, '');

	return slug || 'cake-order';
}

export function generateSlug({ theme, customerName }, existingSlugsSet) {
	const base = slugify(`${theme || ''} ${customerName || ''}`.trim());
	if (!existingSlugsSet.has(base)) {
		return base;
	}

	let suffix = 2;
	while (existingSlugsSet.has(`${base}-${suffix}`)) {
		suffix += 1;
	}

	return `${base}-${suffix}`;
}
