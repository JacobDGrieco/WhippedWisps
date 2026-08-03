import { useState } from 'react';
import * as api from '../api/client.js';

export default function NeededItemsChecklist({ orderId, items, onChange }) {
	const [label, setLabel] = useState('');

	async function addItem() {
		if (!label.trim()) {
			return;
		}

		const created = await api.createNeededItem(orderId, { label: label.trim() });
		onChange([...items, created]);
		setLabel('');
	}

	async function updateItem(item, patch) {
		const updated = await api.updateNeededItem(orderId, item.id, { ...item, ...patch });
		onChange(items.map((candidate) => (candidate.id === item.id ? updated : candidate)));
	}

	async function removeItem(itemId) {
		await api.deleteNeededItem(orderId, itemId);
		onChange(items.filter((item) => item.id !== itemId));
	}

	return (
		<section className="panel">
			<div className="section-heading">
				<h2>Needed Items</h2>
			</div>
			<div className="inline-add">
				<input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Board, box, topper..." />
				<button type="button" onClick={addItem}>Add</button>
			</div>
			<ul className="checklist">
				{items.map((item) => (
					<li key={item.id}>
						<input
							type="checkbox"
							checked={item.done}
							onChange={(event) => updateItem(item, { done: event.target.checked })}
							aria-label={`Mark ${item.label} done`}
						/>
						<input value={item.label} onChange={(event) => updateItem(item, { label: event.target.value })} />
						<button type="button" className="text-danger" onClick={() => removeItem(item.id)}>Remove</button>
					</li>
				))}
			</ul>
		</section>
	);
}
