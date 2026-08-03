import { useEffect, useState } from 'react';
import * as api from '../api/client.js';

export default function Settings() {
	const [status, setStatus] = useState(null);
	const [error, setError] = useState('');

	useEffect(() => {
		api.fetchCalendarStatus().then(setStatus).catch((err) => setError(err.message));
	}, []);

	async function connectCalendar() {
		try {
			const { url } = await api.fetchCalendarAuthUrl();
			window.location.href = url;
		} catch (err) {
			setError(err.message);
		}
	}

	return (
		<div className="page-grid">
			<section className="page-heading">
				<div>
					<p className="eyebrow">Settings</p>
					<h2>Google Calendar</h2>
				</div>
			</section>
			{error ? <p className="alert">{error}</p> : null}
			<section className="panel settings-panel">
				{!status ? <p>Checking connection...</p> : null}
				{status?.configured === false ? <p className="notice">Google Calendar environment variables are not configured.</p> : null}
				{status?.connected ? <p className="notice">Connected</p> : null}
				{status?.configured && !status.connected ? (
					<button type="button" className="primary-action" onClick={connectCalendar}>Connect Google Calendar</button>
				) : null}
			</section>
		</div>
	);
}
