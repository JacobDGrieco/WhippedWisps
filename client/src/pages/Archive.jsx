import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api/client.js';

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
				<input className="search-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search customer, theme, flavor, tag" />
			</section>
			{error ? <p className="alert">{error}</p> : null}
			<div className="archive-grid">
				{orders.map((order) => {
					const cover = (order.photos || []).find((photo) => photo.isCover) || order.photos?.[0];
					return (
						<Link key={order.id} to={`/archive/${order.slug}`} className="archive-card">
							{cover ? <img src={`/uploads/${cover.filePath}`} alt="" /> : <div className="photo-placeholder">No photo</div>}
							<div>
								<h3>{order.theme || 'Untitled cake'}</h3>
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
