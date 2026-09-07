import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { displayLabel } from '../utils/displayText.js';

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
	const today = new Date();
	const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIndex;
	const firstWeekday = new Date(year, monthIndex, 1).getDay();
	const totalDays = daysInMonth(year, monthIndex);
	const ordersByDay = new Map();
	const [selectedDay, setSelectedDay] = useState(null);

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
	const selectedOrders = selectedDay ? (ordersByDay.get(selectedDay) || []) : [];

	useEffect(() => {
		setSelectedDay(null);
	}, [year, monthIndex]);

	return (
		<section className="calendar-panel" aria-label="Monthly schedule">
			<div className="calendar-header">
				<button type="button" className="icon-button" onClick={() => onMonthChange(new Date(year, monthIndex - 1, 1))} aria-label="Previous month">
					{'<'}
				</button>
				<strong>{month.toLocaleString(undefined, { month: 'long', year: 'numeric' })}</strong>
				<button type="button" className="icon-button" onClick={() => onMonthChange(new Date(year, monthIndex + 1, 1))} aria-label="Next month">
					{'>'}
				</button>
			</div>
			<div className="weekday-row">
				{WEEKDAYS.map((weekday) => (
					<span key={weekday}>{weekday}</span>
				))}
			</div>
			<div className="calendar-cells">
				{cells.map((day, index) => {
					const isToday = isCurrentMonth && day === today.getDate();
					const dayOrders = day ? (ordersByDay.get(day) || []) : [];
					return (
						<div key={`${day || 'blank'}-${index}`} className={`calendar-cell${isToday ? ' is-today' : ''}${selectedDay === day ? ' is-selected' : ''}`}>
							{day ? (
								<button
									type="button"
									className="calendar-day-button"
									onClick={() => setSelectedDay(day)}
									aria-label={`${month.toLocaleString(undefined, { month: 'long' })} ${day}, ${year}${dayOrders.length ? `, ${dayOrders.length} order${dayOrders.length === 1 ? '' : 's'}` : ', no orders'}`}
									aria-pressed={selectedDay === day}
								>
									<span className="day-number">{day}</span>
									{dayOrders.length ? <span className="calendar-order-count" aria-hidden="true">{dayOrders.length}</span> : null}
								</button>
							) : null}
							{day
								? dayOrders.map((order) => (
									<Link key={order.id} to={`/orders/${order.id}`} className="calendar-order">
										{order.theme ? displayLabel(order.theme) : order.customerName}
									</Link>
								))
								: null}
						</div>
					);
				})}
			</div>
			<div className="calendar-day-agenda" aria-live="polite">
				{selectedDay ? (
					<>
						<strong>{month.toLocaleString(undefined, { month: 'long' })} {selectedDay}</strong>
						{selectedOrders.length ? (
							<ul>
								{selectedOrders.map((order) => (
									<li key={order.id}>
										<Link to={`/orders/${order.id}`}>
											<strong>{order.theme ? displayLabel(order.theme) : order.customerName}</strong>
											<span>{order.customerName}{order.dueTime ? ` · ${order.dueTime}` : ''}</span>
										</Link>
									</li>
								))}
							</ul>
						) : <p>No orders due.</p>}
					</>
				) : <p>Select a date to see its orders.</p>}
			</div>
		</section>
	);
}
