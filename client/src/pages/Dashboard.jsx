import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api/client.js';
import CalendarGrid from '../components/CalendarGrid.jsx';
import UpcomingList from '../components/UpcomingList.jsx';

export default function Dashboard() {
	const [orders, setOrders] = useState([]);
	const [month, setMonth] = useState(() => new Date());
	const [error, setError] = useState('');

	useEffect(() => {
		api.fetchOrders('scheduled').then(setOrders).catch((err) => setError(err.message));
	}, []);

	return (
		<div className="page-grid">
			<section className="page-heading">
				<div>
					<p className="eyebrow">Schedule</p>
					<h2>Upcoming Cakes</h2>
				</div>
				<Link className="primary-action" to="/orders/new">New Order</Link>
			</section>
			{error ? <p className="alert">{error}</p> : null}
			<div className="dashboard-grid">
				<CalendarGrid orders={orders} month={month} onMonthChange={setMonth} />
				<section className="panel">
					<div className="section-heading">
						<h2>Upcoming</h2>
					</div>
					<UpcomingList orders={orders} />
				</section>
			</div>
		</div>
	);
}
