import { Link } from 'react-router-dom';

export default function UpcomingList({ orders }) {
	const sortedOrders = [...orders].sort((a, b) => `${a.dueDate || ''}${a.dueTime || ''}`.localeCompare(`${b.dueDate || ''}${b.dueTime || ''}`));

	if (sortedOrders.length === 0) {
		return <p className="empty-state">No scheduled orders yet.</p>;
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
