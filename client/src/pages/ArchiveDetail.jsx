import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import * as api from '../api/client.js';

function describeOrderItem(item) {
	return [
		item.dimensions,
		item.servings ? `${item.servings} servings` : null,
		item.flavors
	].filter(Boolean).join(' · ');
}

function describeTypedOrderItem(item) {
	const details = [
		item.theme ? `Theme: ${item.theme}` : null,
		item.dimensions ? `Dimensions: ${item.dimensions}` : null,
		item.servings ? `Servings: ${item.servings}` : null,
		item.count || item.count === 0 ? `Count: ${item.count}` : null,
		item.flavors ? `Flavors: ${item.flavors}` : null,
		item.notes ? `Notes: ${item.notes}` : null,
		item.price || item.price === 0 ? `Price: $${Number(item.price).toFixed(2)}` : null
	];
	const tiers = (item.tierDetails || []).map((tier, index) => {
		const tierDetails = [
			tier.dimensions ? `dimensions ${tier.dimensions}` : null,
			tier.flavors ? `flavors ${tier.flavors}` : null
		].filter(Boolean).join(', ');

		return tierDetails ? `Tier ${index + 1}: ${tierDetails}` : null;
	});

	return [...details, ...tiers].filter(Boolean).join(' | ');
}

export default function ArchiveDetail() {
	const { slug } = useParams();
	const [order, setOrder] = useState(null);
	const [error, setError] = useState('');

	useEffect(() => {
		api.fetchOrderBySlug(slug).then(setOrder).catch((err) => setError(err.message));
	}, [slug]);

	if (error) {
		return <p className="alert">{error}</p>;
	}

	if (!order) {
		return <p className="empty-state">Loading...</p>;
	}

	return (
		<div className="page-grid archive-detail">
			<section className="page-heading">
				<div>
					<p className="eyebrow">Archive detail</p>
					<h2>{order.theme || 'Untitled cake'}</h2>
				</div>
				<Link className="secondary-action" to={`/orders/${order.id}`}>Edit</Link>
			</section>
			<section className="archive-detail-top">
				<div className="archive-photos">
					{(order.photos || []).length ? (
						order.photos.map((photo) => <img key={photo.id} src={`/uploads/${photo.filePath}`} alt="" />)
					) : (
						<div className="photo-placeholder">No photos uploaded</div>
					)}
				</div>
				<aside className="archive-info">
					<p><strong>Customer</strong><span>{order.customerName}</span></p>
					<p><strong>Date</strong><span>{order.dueDate}</span></p>
					<div className="archive-items">
						<strong>Items</strong>
						{(order.orderItems || []).length ? (
							order.orderItems.map((item, index) => (
								<div key={item.id || index} className="archive-item">
									<span>{item.type}</span>
									<small>{describeTypedOrderItem(item) || 'No details set'}</small>
								</div>
							))
						) : (
							<span>Not set</span>
						)}
					</div>
					<p><strong>Description</strong><span>{order.description || 'No description'}</span></p>
					<div className="tag-row">
						{(order.tags || []).map((tag) => <span key={tag} className="tag-chip">{tag}</span>)}
					</div>
				</aside>
			</section>
			<section className="archive-recipes">
				{(order.orderRecipes || []).map((recipe) => (
					<article key={recipe.id} className="recipe-card">
						<h3>{recipe.recipeName}</h3>
						<ul>
							{recipe.ingredients.map((ingredient, index) => (
								<li key={`${recipe.id}-${index}`}>
									{[ingredient.quantity, ingredient.unit, ingredient.item].filter(Boolean).join(' ')}
								</li>
							))}
						</ul>
						<p>{recipe.instructions}</p>
					</article>
				))}
			</section>
		</div>
	);
}
