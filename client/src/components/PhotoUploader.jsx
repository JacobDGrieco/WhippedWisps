import * as api from '../api/client.js';

export default function PhotoUploader({ orderId, photos, onChange }) {
	async function handleUpload(event) {
		const file = event.target.files?.[0];
		if (!file) {
			return;
		}

		const uploaded = await api.uploadPhoto(orderId, file);
		onChange([...photos, uploaded]);
		event.target.value = '';
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
					Upload
					<input type="file" accept="image/*" onChange={handleUpload} />
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
