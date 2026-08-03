import { Link } from 'react-router-dom';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function daysInMonth(year, month) {
	return new Date(year, month + 1, 0).getDate();
}

function localDateParts(dateText) {
	const [year, month, day] = dateText.split('-').map(Number);
	return { year, monthIndex: month - 1, day };
}

export default function CalendarGrid({ orders, month, onMonthChange }) {
	const year = month.getFullYear();
	const monthIndex = month.getMonth();
	const firstWeekday = new Date(year, monthIndex, 1).getDay();
	const totalDays = daysInMonth(year, monthIndex);
	const ordersByDay = new Map();

	for (const order of orders) {
		if (!order.dueDate) {
			continue;
		}

		const due = localDateParts(order.dueDate);
		if (due.year === year && due.monthIndex === monthIndex) {
			ordersByDay.set(due.day, [...(ordersByDay.get(due.day) || []), order]);
		}
	}

	const cells = [
		...Array.from({ length: firstWeekday }, () => null),
		...Array.from({ length: totalDays }, (_, index) => index + 1)
	];

	return (
		<section className="calendar-panel" aria-label="Monthly schedule">
			<div className="calendar-header">
				<button type="button" className="icon-button" onClick={() => onMonthChange(new Date(year, monthIndex - 1, 1))} aria-label="Previous month">
					‹
				</button>
				<strong>{month.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</strong>
				<button type="button" className="icon-button" onClick={() => onMonthChange(new Date(year, monthIndex + 1, 1))} aria-label="Next month">
					›
				</button>
			</div>
			<div className="weekday-row">
				{WEEKDAYS.map((weekday) => (
					<span key={weekday}>{weekday}</span>
				))}
			</div>
			<div className="calendar-cells">
				{cells.map((day, index) => (
					<div key={`${day || 'blank'}-${index}`} className="calendar-cell">
						{day ? <span className="day-number">{day}</span> : null}
						{day
							? (ordersByDay.get(day) || []).map((order) => (
								<Link key={order.id} to={`/orders/${order.id}`} className="calendar-order">
									{order.theme || order.customerName}
								</Link>
							))
							: null}
					</div>
				))}
			</div>
		</section>
	);
}
