export function capitalizeWords(value) {
	return String(value || '')
		.trim()
		.replace(/\s+/g, ' ')
		.split(' ')
		.map((word) => (word ? `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}` : word))
		.join(' ');
}

export function displayLabel(value, fallback = 'Not set') {
	const label = capitalizeWords(value);
	return label || fallback;
}
