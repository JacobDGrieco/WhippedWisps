async function request(path, options = {}) {
	const headers = options.body instanceof FormData
		? options.headers
		: { 'Content-Type': 'application/json', ...options.headers };
	const response = await fetch(path, { ...options, headers });

	if (!response.ok) {
		const body = await response.json().catch(() => ({}));
		throw new Error(body.message || `Request failed with ${response.status}`);
	}

	if (response.status === 204) {
		return null;
	}

	return response.json();
}

export function fetchOrders(status) {
	const params = status ? `?status=${encodeURIComponent(status)}` : '';
	return request(`/api/orders${params}`);
}

export function searchArchive(query) {
	return request(`/api/orders/search?q=${encodeURIComponent(query)}`);
}

export function fetchOrder(id) {
	return request(`/api/orders/${id}`);
}

export function fetchOrderBySlug(slug) {
	return request(`/api/orders/slug/${encodeURIComponent(slug)}`);
}

export function createOrder(order) {
	return request('/api/orders', {
		method: 'POST',
		body: JSON.stringify(order)
	});
}

export function updateOrder(id, order) {
	return request(`/api/orders/${id}`, {
		method: 'PATCH',
		body: JSON.stringify(order)
	});
}

export function archiveOrder(id) {
	return request(`/api/orders/${id}/archive`, { method: 'POST' });
}

export function deleteOrder(id) {
	return request(`/api/orders/${id}`, { method: 'DELETE' });
}

export function resyncCalendar(id) {
	return request(`/api/orders/${id}/resync-calendar`, { method: 'POST' });
}

export function createNeededItem(orderId, item) {
	return request(`/api/orders/${orderId}/needed-items`, {
		method: 'POST',
		body: JSON.stringify(item)
	});
}

export function updateNeededItem(orderId, itemId, item) {
	return request(`/api/orders/${orderId}/needed-items/${itemId}`, {
		method: 'PATCH',
		body: JSON.stringify(item)
	});
}

export function deleteNeededItem(orderId, itemId) {
	return request(`/api/orders/${orderId}/needed-items/${itemId}`, { method: 'DELETE' });
}

export function uploadPhoto(orderId, file) {
	const formData = new FormData();
	formData.append('photo', file);
	return request(`/api/orders/${orderId}/photos`, {
		method: 'POST',
		body: formData
	});
}

export function deletePhoto(orderId, photoId) {
	return request(`/api/orders/${orderId}/photos/${photoId}`, { method: 'DELETE' });
}

export function fetchRecipes() {
	return request('/api/recipes');
}

export function createRecipe(recipe) {
	return request('/api/recipes', {
		method: 'POST',
		body: JSON.stringify(recipe)
	});
}

export function updateRecipe(id, recipe) {
	return request(`/api/recipes/${id}`, {
		method: 'PATCH',
		body: JSON.stringify(recipe)
	});
}

export function deleteRecipe(id) {
	return request(`/api/recipes/${id}`, { method: 'DELETE' });
}

export function attachRecipe(orderId, recipeId) {
	return request(`/api/orders/${orderId}/order-recipes`, {
		method: 'POST',
		body: JSON.stringify({ recipeId })
	});
}

export function updateOrderRecipe(orderId, orderRecipeId, orderRecipe) {
	return request(`/api/orders/${orderId}/order-recipes/${orderRecipeId}`, {
		method: 'PATCH',
		body: JSON.stringify(orderRecipe)
	});
}

export function deleteOrderRecipe(orderId, orderRecipeId) {
	return request(`/api/orders/${orderId}/order-recipes/${orderRecipeId}`, { method: 'DELETE' });
}

export function fetchCalendarStatus() {
	return request('/api/settings/calendar/status');
}

export function fetchCalendarAuthUrl() {
	return request('/api/settings/calendar/auth-url');
}

export function fetchTags() {
	return request('/api/tags');
}
