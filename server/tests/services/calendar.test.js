import { expect, test } from 'vitest';
import { buildCalendarEventPayload } from '../../src/services/calendar.js';

test('buildCalendarEventPayload maps order details and custom reminders', () => {
	const payload = buildCalendarEventPayload({
		customerName: 'Jane Doe',
		customerContact: 'jane@example.com',
		dueDate: '2026-09-01',
		dueTime: '13:30',
		deliveryType: 'delivery',
		deliveryAddress: '123 Cake Lane',
		theme: 'Dinosaur Jungle',
		orderItems: [
			{ type: 'cake', theme: 'jungle', dimensions: '8 inch', servings: '12', flavors: 'vanilla', price: 80 },
			{
				type: 'tiered cake',
				theme: 'garden',
				servings: '32',
				tierDetails: [
					{ dimensions: '6 inch', flavors: 'lemon' },
					{ dimensions: '8 inch', flavors: 'vanilla' }
				],
				price: 180
			},
			{ type: 'cupcakes', theme: 'sprinkles', count: 24, flavors: 'chocolate', price: 60 },
			{ type: 'other', notes: 'custom topper', price: 20 }
		],
		reminderOffsets: [60, 1440]
	});

	expect(payload.summary).toBe('Dinosaur Jungle - Jane Doe');
	expect(payload.start.dateTime).toBe('2026-09-01T13:30:00');
	expect(payload.description).toContain('123 Cake Lane');
	expect(payload.description).toContain('- Cake, Vanilla, 8 inch, 12 servings, Theme: Jungle');
	expect(payload.description).toContain('- Tiered Cake, 2 tiers, 32 servings, Theme: Garden\n  - Lemon, 6 inch\n  - Vanilla, 8 inch');
	expect(payload.description).toContain('- Cupcakes, Chocolate, 24 count, Theme: Sprinkles');
	expect(payload.description).toContain('- Other, Notes: custom topper');
	expect(payload.reminders.overrides).toEqual([
		{ method: 'popup', minutes: 60 },
		{ method: 'popup', minutes: 1440 }
	]);
});
