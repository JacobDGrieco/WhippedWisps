import { expect, test } from 'vitest';
import { generateSlug } from '../../src/services/slug.js';

test('builds a kebab-case slug from theme and customer name', () => {
	expect(generateSlug({ theme: 'Dinosaur Jungle', customerName: 'Jane Doe' }, new Set())).toBe('dinosaur-jungle-jane-doe');
});

test('appends a numeric suffix on collision', () => {
	const existingSlugs = new Set(['dinosaur-jungle-jane-doe', 'dinosaur-jungle-jane-doe-2']);
	expect(generateSlug({ theme: 'Dinosaur Jungle', customerName: 'Jane Doe' }, existingSlugs)).toBe('dinosaur-jungle-jane-doe-3');
});

test('strips punctuation and collapses whitespace', () => {
	expect(generateSlug({ theme: "Kid's 5th B-day!", customerName: 'Sam' }, new Set())).toBe('kids-5th-b-day-sam');
});
