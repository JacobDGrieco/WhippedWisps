import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as api from '../api/client.js';
import CalendarGrid from '../components/CalendarGrid.jsx';
import UpcomingList from '../components/UpcomingList.jsx';

export default function Dashboard() {
	const [orders, setOrders] = useState([]);
	const [month, setMonth] = useState(() => new Date());
	const [selectedDate, setSelectedDate] = useState('');
	const [error, setError] = useState('');

	useEffect(() => {
		api.fetchOrders('scheduled').then(setOrders).catch((err) => setError(err.message));
	}, []);

	function formatSelectedDate(dateText) {
		const [year, monthValue, day] = dateText.split('-').map(Number);
		return new Date(year, monthValue - 1, day).toLocaleDateString(undefined, {
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		});
	}

	function handleMonthChange(nextMonth) {
		setMonth(nextMonth);
		setSelectedDate('');
	}

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
				<section className="panel upcoming-panel">
					<div className="section-heading">
						<div>
							<h2>Upcoming Orders</h2>
							{selectedDate ? <p className="section-subtitle">Filtered to {formatSelectedDate(selectedDate)}</p> : null}
						</div>
						{selectedDate ? (
							<button type="button" className="filter-clear-button" onClick={() => setSelectedDate('')}>
								Clear
							</button>
						) : null}
					</div>
					<UpcomingList orders={orders} filterDate={selectedDate} />
				</section>
				<CalendarGrid
					orders={orders}
					month={month}
					selectedDate={selectedDate}
					onDateSelect={setSelectedDate}
					onMonthChange={handleMonthChange}
				/>
			</div>
		</div>
	);
}
