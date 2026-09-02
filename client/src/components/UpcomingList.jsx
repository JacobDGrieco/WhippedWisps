import { Link } from 'react-router-dom';

function getTodayDateInputValue() {
	const today = new Date();
	const timezoneOffsetMs = today.getTimezoneOffset() * 60 * 1000;
	return new Date(today.getTime() - timezoneOffsetMs).toISOString().slice(0, 10);
}

export default function UpcomingList({ orders }) {
	const today = getTodayDateInputValue();
	const sortedOrders = orders
		.filter((order) => !order.dueDate || order.dueDate >= today)
		.sort((a, b) => `${a.dueDate || ''}${a.dueTime || ''}`.localeCompare(`${b.dueDate || ''}${b.dueTime || ''}`));

	if (sortedOrders.length === 0) {
		return <p className="empty-state">No upcoming orders.</p>;
	}

	return (
		<ul className="upcoming-list">
			{sortedOrders.map((order) => (
				<li key={order.id}>
					<Link to={`/orders/${order.id}`}>
						<span>{order.dueDate}{order.dueTime ? ` at ${order.dueTime}` : ''}</span>
						<strong>{order.theme || 'Untitled cake'}</strong>
						<small>{order.customerName}</small>
					</Link>
				</li>
			))}
		</ul>
	);
}
