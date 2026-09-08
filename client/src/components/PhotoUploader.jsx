import { useState } from 'react';
import * as api from '../api/client.js';

export default function PhotoUploader({
	orderId,
	photos,
	imageType = 'final',
	title = 'Photos',
	pendingFiles = [],
	onChange,
	onPendingChange,
	embedded = false
}) {
	const [isUploading, setIsUploading] = useState(false);
	const visiblePhotos = (photos || []).filter((photo) => (photo.imageType || 'final') === imageType);

	async function handleUpload(event) {
		const files = Array.from(event.target.files || []);
		if (!files.length) {
			return;
		}

		if (!orderId) {
			onPendingChange?.([...pendingFiles, ...files]);
			event.target.value = '';
			return;
		}

		setIsUploading(true);

		try {
			const uploadedPhotos = await Promise.all(files.map((file) => api.uploadPhoto(orderId, file, imageType)));
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

	function removePendingFile(fileIndex) {
		onPendingChange?.(pendingFiles.filter((file, index) => index !== fileIndex));
	}

	return (
		<section className={embedded ? 'embedded-panel' : 'panel'}>
			<div className="section-heading">
				<h2>{title}</h2>
				<label className="file-button">
					{isUploading ? 'Uploading...' : 'Upload'}
					<input type="file" accept="image/*" multiple onChange={handleUpload} disabled={isUploading} />
				</label>
			</div>
			{visiblePhotos.length || pendingFiles.length ? (
				<div className="photo-grid">
					{visiblePhotos.map((photo) => (
						<figure key={photo.id}>
							<img src={`/uploads/${photo.filePath}`} alt="" loading="lazy" />
							<figcaption>{photo.isCover ? 'Cover' : title.replace(/s$/, '')}</figcaption>
							<button type="button" onClick={() => removePhoto(photo.id)}>Remove</button>
						</figure>
					))}
					{pendingFiles.map((file, index) => (
						<figure key={`${file.name}-${file.lastModified}-${index}`} className="pending-photo">
							<div className="photo-placeholder">Pending</div>
							<figcaption>{file.name}</figcaption>
							<button type="button" onClick={() => removePendingFile(index)}>Remove</button>
						</figure>
					))}
				</div>
			) : (
				<p className="empty-state">No {title.toLowerCase()} yet.</p>
			)}
		</section>
	);
}
