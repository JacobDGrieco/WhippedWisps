import { useState } from 'react';
import * as api from '../api/client.js';

export default function PhotoUploader({ orderId, photos, onChange }) {
	const [isUploading, setIsUploading] = useState(false);

	async function handleUpload(event) {
		const files = Array.from(event.target.files || []);
		if (!files.length) {
			return;
		}

		setIsUploading(true);

		try {
			const uploadedPhotos = await Promise.all(files.map((file) => api.uploadPhoto(orderId, file)));
			onChange([...photos, ...uploadedPhotos]);
			event.target.value = '';
		} finally {
			setIsUploading(false);
		}
	}

	async function removePhoto(photoId) {
		await api.deletePhoto(orderId, photoId);
		onChange(photos.filter((photo) => photo.id !== photoId));
	}

	return (
		<section className="panel">
			<div className="section-heading">
				<h2>Photos</h2>
				<label className="file-button">
					{isUploading ? 'Uploading...' : 'Upload'}
					<input type="file" accept="image/*" multiple onChange={handleUpload} disabled={isUploading} />
				</label>
			</div>
			<div className="photo-grid">
				{photos.map((photo) => (
					<figure key={photo.id}>
						<img src={`/uploads/${photo.filePath}`} alt="" />
						<figcaption>{photo.isCover ? 'Cover' : 'Photo'}</figcaption>
						<button type="button" onClick={() => removePhoto(photo.id)}>Remove</button>
					</figure>
				))}
			</div>
		</section>
	);
}
