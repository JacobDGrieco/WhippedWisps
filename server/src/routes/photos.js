import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import multer from 'multer';
import { createPhoto, deletePhoto, getPhotoById, listPhotos } from '../db/photos.js';
import { getOrderById } from '../db/orders.js';

const router = express.Router({ mergeParams: true });

export function getUploadsDir() {
	return path.resolve(process.env.UPLOADS_DIR || './data/uploads');
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

router.get('/', (req, res) => {
	res.json(listPhotos(req.params.orderId));
});

function requireExistingOrder(req, res, next) {
	if (!getOrderById(req.params.orderId)) {
		res.status(404).json({ message: 'Order not found.' });
		return;
	}

	next();
}

router.post('/', requireExistingOrder, upload.single('photo'), (req, res) => {
	if (!req.file) {
		res.status(400).json({ message: 'Photo file is required.' });
		return;
	}

	const relativePath = path.join(String(req.params.orderId), req.file.filename).replaceAll('\\', '/');
	res.status(201).json(createPhoto(req.params.orderId, relativePath));
});

router.delete('/:photoId', (req, res) => {
	const photo = getPhotoById(req.params.photoId);
	if (!photo) {
		res.status(404).json({ message: 'Photo not found.' });
		return;
	}

	deletePhoto(req.params.photoId);

	const absolutePath = path.resolve(getUploadsDir(), photo.filePath);
	const uploadsDir = getUploadsDir();
	if (absolutePath.startsWith(uploadsDir)) {
		fs.rmSync(absolutePath, { force: true });
	}

	res.json({ deleted: true });
});

export default router;
