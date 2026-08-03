import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb } from './db/connection.js';
import orderRoutes from './routes/orders.js';
import neededItemRoutes from './routes/neededItems.js';
import tagRoutes from './routes/tags.js';
import photoRoutes, { getUploadsDir } from './routes/photos.js';
import recipeRoutes from './routes/recipes.js';
import orderRecipeRoutes from './routes/orderRecipes.js';
import settingsCalendarRoutes from './routes/settingsCalendar.js';
import { listTags } from './db/tags.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
	getDb();

	const app = express();
	app.use(cors());
	app.use(express.json({ limit: '1mb' }));
	app.use('/uploads', express.static(getUploadsDir()));

	app.get('/api/health', (req, res) => {
		res.json({ ok: true });
	});

	app.use('/api/orders/:orderId/needed-items', neededItemRoutes);
	app.use('/api/orders/:orderId/tags', tagRoutes);
	app.use('/api/orders/:orderId/photos', photoRoutes);
	app.use('/api/orders/:orderId/order-recipes', orderRecipeRoutes);
	app.use('/api/orders', orderRoutes);
	app.use('/api/recipes', recipeRoutes);
	app.get('/api/tags', (req, res) => {
		res.json(listTags());
	});
	app.use('/api/settings/calendar', settingsCalendarRoutes);
	app.use('/api', notFound);

	if (process.env.NODE_ENV === 'production') {
		const clientDist = path.resolve(moduleDir, '../../client/dist');
		app.use(express.static(clientDist));
		app.get('*', (req, res) => {
			res.sendFile(path.join(clientDist, 'index.html'));
		});
	}

	app.use(errorHandler);
	return app;
}
