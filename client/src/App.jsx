import { NavLink, Route, Routes } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import OrderForm from './pages/OrderForm.jsx';
import Archive from './pages/Archive.jsx';
import ArchiveDetail from './pages/ArchiveDetail.jsx';
import Recipes from './pages/Recipes.jsx';
import Settings from './pages/Settings.jsx';

export default function App() {
	return (
		<div className="app-shell">
			<header className="topbar">
				<div>
					<p className="eyebrow">Whipped Wisps</p>
					<h1>Cake Orders</h1>
				</div>
				<nav aria-label="Primary">
					<NavLink to="/">Schedule</NavLink>
					<NavLink to="/archive">Archive</NavLink>
					<NavLink to="/recipes">Recipes</NavLink>
					<NavLink to="/settings">Settings</NavLink>
				</nav>
			</header>
			<main>
				<Routes>
					<Route path="/" element={<Dashboard />} />
					<Route path="/orders/new" element={<OrderForm />} />
					<Route path="/orders/:id" element={<OrderForm />} />
					<Route path="/archive" element={<Archive />} />
					<Route path="/archive/:slug" element={<ArchiveDetail />} />
					<Route path="/recipes" element={<Recipes />} />
					<Route path="/settings" element={<Settings />} />
				</Routes>
			</main>
		</div>
	);
}
