import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, expect, test } from 'vitest';
import { closeDb, getDb } from '../../src/db/connection.js';
import { createOrder } from '../../src/db/orders.js';
import { createPhoto, listPhotos } from '../../src/db/photos.js';

const TEST_DB = path.resolve('./server/tests/tmp/test-photos.db');

beforeEach(async () => {
	await closeDb();
	fs.rmSync(TEST_DB, { force: true });
	process.env.DB_PATH = TEST_DB;
	delete process.env.DATABASE_URL;
	delete process.env.POSTGRES_URL;
	delete process.env.POSTGRES_PRISMA_URL;
	delete process.env.POSTGRES_URL_NON_POOLING;
	await getDb();
});

test('createPhoto separates reference and final images', async () => {
	const order = await createOrder({ customerName: 'Jane', theme: 'Garden', dueDate: '2026-09-01' });

	const referencePhoto = await createPhoto(order.id, '1/reference.jpg', 'reference');
	const finalPhoto = await createPhoto(order.id, '1/final.jpg', 'final');

	expect(referencePhoto).toMatchObject({ imageType: 'reference', isCover: false });
	expect(finalPhoto).toMatchObject({ imageType: 'final', isCover: true });
	expect(await listPhotos(order.id)).toMatchObject([
		{ filePath: '1/reference.jpg', imageType: 'reference', isCover: false },
		{ filePath: '1/final.jpg', imageType: 'final', isCover: true }
	]);
});
