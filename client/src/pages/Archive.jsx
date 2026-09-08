import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api/client.js';
import { displayLabel } from '../utils/displayText.js';

export default function Archive() {
	const [orders, setOrders] = useState([]);
	const [query, setQuery] = useState('');
	const [error, setError] = useState('');

	useEffect(() => {
		const timeout = setTimeout(() => {
			const request = query.trim() ? api.searchArchive(query.trim()) : api.fetchOrders('archived');
			request.then(setOrders).catch((err) => setError(err.message));
		}, 200);

		return () => clearTimeout(timeout);
	}, [query]);

	return (
		<div className="page-grid">
			<section className="page-heading">
				<div>
					<p className="eyebrow">Archive</p>
					<h2>Completed Cakes</h2>
				</div>
				<label className="field archive-search">
					<span>Search completed cakes</span>
					<input className="search-input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Customer, theme, flavor, or tag" />
				</label>
			</section>
			{error ? <p className="alert">{error}</p> : null}
			<div className="archive-grid">
				{orders.map((order) => {
					const finalPhotos = (order.photos || []).filter((photo) => (photo.imageType || 'final') === 'final');
					const cover = finalPhotos.find((photo) => photo.isCover) || finalPhotos[0];
					const title = displayLabel(order.theme, 'Untitled cake');
					return (
						<Link key={order.id} to={`/archive/${order.slug}`} className="archive-card">
							{cover ? <img src={`/uploads/${cover.filePath}`} alt={`${title} cake`} loading="lazy" /> : <div className="photo-placeholder">No photo</div>}
							<div className="archive-card-meta">
								<h3>{title}</h3>
								<p>{order.customerName}</p>
								<span>{order.dueDate}</span>
							</div>
						</Link>
					);
				})}
			</div>
		</div>
	);
}
