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

function getOrderItemDetails(item) {
	const details = [
		item.theme ? { label: 'Theme', value: item.theme } : null,
		item.dimensions ? { label: 'Dimensions', value: item.dimensions } : null,
		item.servings ? { label: 'Servings', value: item.servings } : null,
		item.count || item.count === 0 ? { label: 'Count', value: item.count } : null,
		item.flavors ? { label: 'Flavors', value: item.flavors } : null,
		item.notes ? { label: 'Notes', value: item.notes } : null,
		item.price || item.price === 0 ? { label: 'Price', value: `$${Number(item.price).toFixed(2)}` } : null
	];
	const tiers = (item.tierDetails || []).flatMap((tier, index) => {
		const tierDetails = [
			tier.dimensions ? { label: `Tier ${index + 1} Dimensions`, value: tier.dimensions } : null,
			tier.flavors ? { label: `Tier ${index + 1} Flavors`, value: tier.flavors } : null
		];

		return tierDetails;
	});

	return [...details, ...tiers].filter(Boolean);
}

function OrderItemDetails({ item }) {
	const details = getOrderItemDetails(item);

	if (!details.length) {
		return <span className="item-detail-empty">No details set</span>;
	}

	return (
		<dl className="item-detail-grid">
			{details.map((detail) => (
				<div key={`${detail.label}-${detail.value}`} className="item-detail-chip">
					<dt>{detail.label}</dt>
					<dd>{detail.value}</dd>
				</div>
			))}
		</dl>
	);
}

function formatIngredient(ingredient) {
	return [ingredient.quantity, ingredient.unit, ingredient.item].filter(Boolean).join(' ');
}

function getCoverPhoto(photos = []) {
	return photos.find((photo) => photo.isCover) || photos[0];
}

function getInstructionSteps(instructions) {
	return String(instructions || '')
		.split(/\r?\n/)
		.map((step) => step.trim())
		.filter(Boolean);
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

	const coverPhoto = getCoverPhoto(order.photos);

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
					<p><strong>Description</strong><span>{order.description || 'No description'}</span></p>
					<div className="tag-row">
						{(order.tags || []).map((tag) => <span key={tag} className="tag-chip">{tag}</span>)}
					</div>
				</aside>
			</section>
			<section className="archive-items-panel">
				<div className="section-heading">
					<h2>Items</h2>
				</div>
				<div className="archive-items">
					{(order.orderItems || []).length ? (
						order.orderItems.map((item, index) => (
							<div key={item.id || index} className="archive-item">
								<span>{item.type}</span>
								<OrderItemDetails item={item} />
							</div>
						))
					) : (
						<span>Not set</span>
					)}
				</div>
			</section>
			<section className="archive-recipes">
				{(order.orderRecipes || []).map((recipe) => {
					const instructionSteps = getInstructionSteps(recipe.instructions);
					return (
						<article key={recipe.id} className="recipe-card">
							<div className="recipe-card-top">
								<div className="recipe-card-photo">
									{coverPhoto ? (
										<img src={`/uploads/${coverPhoto.filePath}`} alt="" />
									) : (
										<div className="photo-placeholder">No photo</div>
									)}
								</div>
								<div className="recipe-card-details">
									<p className="eyebrow">Special Recipe</p>
									<h3>{recipe.recipeName}</h3>
									<dl>
										<div>
											<dt>Customer</dt>
											<dd>{order.customerName}</dd>
										</div>
										<div>
											<dt>Due Date</dt>
											<dd>{order.dueDate}</dd>
										</div>
										<div>
											<dt>Theme</dt>
											<dd>{order.theme || 'Not set'}</dd>
										</div>
									</dl>
								</div>
							</div>
							<div className="recipe-card-body">
								<section className="recipe-card-section recipe-card-items">
									<h4>Items</h4>
									<div className="recipe-item-list">
										{(order.orderItems || []).length ? order.orderItems.map((item, index) => (
											<div key={item.id || index} className="recipe-item-row">
												<strong>{item.type || 'Item'}</strong>
												<OrderItemDetails item={item} />
											</div>
										)) : (
											<div className="recipe-item-row">
												<strong>Not set</strong>
												<span>No order items set</span>
											</div>
										)}
									</div>
								</section>
								<section className="recipe-card-section">
									<h4>Ingredients</h4>
									<ul className="recipe-ingredient-list">
										{recipe.ingredients.length ? recipe.ingredients.map((ingredient, index) => (
											<li key={`${recipe.id}-${index}`}>{formatIngredient(ingredient) || 'Ingredient'}</li>
										)) : (
											<li>No ingredients set</li>
										)}
									</ul>
								</section>
								<section className="recipe-card-section">
									<h4>Directions</h4>
									<ol className="recipe-direction-list">
										{instructionSteps.length ? instructionSteps.map((step, index) => (
											<li key={`${recipe.id}-step-${index}`}>{step}</li>
										)) : (
											<li>No directions set</li>
										)}
									</ol>
								</section>
							</div>
						</article>
					);
				})}
			</section>
		</div>
	);
}
