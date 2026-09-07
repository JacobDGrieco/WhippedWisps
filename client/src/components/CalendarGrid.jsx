import { displayLabel } from '../utils/displayText.js';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function daysInMonth(year, month) {
	return new Date(year, month + 1, 0).getDate();
}

function localDateParts(dateText) {
	const [year, month, day] = dateText.split('-').map(Number);
	return { year, monthIndex: month - 1, day };
}

function dateInputValue(year, monthIndex, day) {
	return [
		year,
		String(monthIndex + 1).padStart(2, '0'),
		String(day).padStart(2, '0')
	].join('-');
}

export default function CalendarGrid({ orders, month, selectedDate, onDateSelect, onMonthChange }) {
	const year = month.getFullYear();
	const monthIndex = month.getMonth();
	const today = new Date();
	const isCurrentMonth = today.getFullYear() === year && today.getMonth() === monthIndex;
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
					const cellDate = day ? dateInputValue(year, monthIndex, day) : '';
					const isSelected = selectedDate === cellDate;
					const cellClassName = `calendar-cell${isToday ? ' is-today' : ''}${isSelected ? ' is-selected' : ''}${day ? '' : ' is-empty'}`;

					if (!day) {
						return <div key={`blank-${index}`} className={cellClassName} aria-hidden="true" />;
					}

					return (
						<button
							key={cellDate}
							type="button"
							className={cellClassName}
							onClick={() => onDateSelect(cellDate)}
							aria-label={`${month.toLocaleString(undefined, { month: 'long' })} ${day}, ${year}${dayOrders.length ? `, ${dayOrders.length} order${dayOrders.length === 1 ? '' : 's'}` : ', no orders'}`}
							aria-pressed={isSelected}
						>
							<span className="calendar-cell-top">
								<span className="day-number">{day}</span>
								{dayOrders.length ? <span className="calendar-order-count" aria-hidden="true">{dayOrders.length}</span> : null}
							</span>
							{dayOrders.map((order) => (
								<span key={order.id} className="calendar-order">
									{order.theme ? displayLabel(order.theme) : order.customerName}
								</span>
							))}
						</button>
					);
				})}
			</div>
		</section>
	);
}
