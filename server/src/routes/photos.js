import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { createPhoto, deletePhoto, getPhotoById, listPhotos } from '../db/photos.js';
import { getOrderById } from '../db/orders.js';

const router = express.Router({ mergeParams: true });

function asyncHandler(handler) {
	return (req, res, next) => {
		Promise.resolve(handler(req, res, next)).catch(next);
	};
}

function getDefaultUploadsDir() {
	return process.env.VERCEL ? '/tmp/whippedwisps-uploads' : './data/uploads';
}

export function getUploadsDir() {
	return path.resolve(process.env.UPLOADS_DIR || getDefaultUploadsDir());
}

function sanitizeFilename(filename) {
	return filename.replace(/[^a-zA-Z0-9._-]/g, '-');
}

const storage = multer.diskStorage({
	destination(req, file, callback) {
		const orderDir = path.join(getUploadsDir(), String(req.params.orderId));
		fs.mkdirSync(orderDir, { recursive: true });
		callback(null, orderDir);
	},
	filename(req, file, callback) {
		const ext = path.extname(file.originalname);
		const base = path.basename(file.originalname, ext);
		callback(null, `${Date.now()}-${crypto.randomUUID()}-${sanitizeFilename(base)}${ext.toLowerCase()}`);
	}
});

const upload = multer({
	storage,
	fileFilter(req, file, callback) {
		if (!file.mimetype.startsWith('image/')) {
			callback(new Error('Only image uploads are allowed.'));
			return;
		}

		callback(null, true);
	},
	limits: {
		fileSize: 12 * 1024 * 1024
	}
});

router.get('/', asyncHandler(async (req, res) => {
	res.json(await listPhotos(req.params.orderId));
}));

async function requireExistingOrder(req, res, next) {
	if (!(await getOrderById(req.params.orderId))) {
		res.status(404).json({ message: 'Order not found.' });
		return;
	}

	next();
}

router.post('/', asyncHandler(requireExistingOrder), upload.single('photo'), asyncHandler(async (req, res) => {
	if (!req.file) {
		res.status(400).json({ message: 'Photo file is required.' });
		return;
	}

	const relativePath = path.join(String(req.params.orderId), req.file.filename).replaceAll('\\', '/');
	res.status(201).json(await createPhoto(req.params.orderId, relativePath));
}));

router.delete('/:photoId', asyncHandler(async (req, res) => {
	const photo = await getPhotoById(req.params.photoId);
	if (!photo) {
		res.status(404).json({ message: 'Photo not found.' });
		return;
	}

	await deletePhoto(req.params.photoId);

	const absolutePath = path.resolve(getUploadsDir(), photo.filePath);
	const uploadsDir = getUploadsDir();
	if (absolutePath.startsWith(uploadsDir)) {
		fs.rmSync(absolutePath, { force: true });
	}

	res.json({ deleted: true });
}));

export default router;
