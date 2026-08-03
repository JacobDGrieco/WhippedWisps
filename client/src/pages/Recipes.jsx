import { useEffect, useState } from 'react';
import * as api from '../api/client.js';

function emptyIngredient() {
	return { item: '', quantity: '', unit: '' };
}

const EMPTY_RECIPE = {
	name: '',
	ingredients: [emptyIngredient()],
	instructions: ''
};

export default function Recipes() {
	const [recipes, setRecipes] = useState([]);
	const [draft, setDraft] = useState(EMPTY_RECIPE);
	const [error, setError] = useState('');

	useEffect(() => {
		api.fetchRecipes().then(setRecipes).catch((err) => setError(err.message));
	}, []);

	function updateIngredient(index, field, value) {
		setDraft((current) => {
			const ingredients = [...current.ingredients];
			ingredients[index] = { ...ingredients[index], [field]: value };
			return { ...current, ingredients };
		});
	}

	async function createDraftRecipe(event) {
		event.preventDefault();
		const created = await api.createRecipe(draft);
		setRecipes((current) => [...current, created]);
		setDraft(EMPTY_RECIPE);
	}

	async function removeRecipe(id) {
		await api.deleteRecipe(id);
		setRecipes((current) => current.filter((recipe) => recipe.id !== id));
	}

	return (
		<div className="page-grid recipes-page">
			<section className="page-heading">
				<div>
					<p className="eyebrow">Templates</p>
					<h2>Recipe Library</h2>
				</div>
			</section>
			{error ? <p className="alert">{error}</p> : null}
			<div className="two-column">
				<section className="panel">
					<div className="section-heading">
						<h2>Saved Recipes</h2>
					</div>
					<ul className="recipe-list">
						{recipes.map((recipe) => (
							<li key={recipe.id}>
								<strong>{recipe.name}</strong>
								<span>{recipe.ingredients.length} ingredients</span>
								<button type="button" className="text-danger" onClick={() => removeRecipe(recipe.id)}>Delete</button>
							</li>
						))}
					</ul>
				</section>
				<form className="panel form-grid single-column" onSubmit={createDraftRecipe}>
					<div className="section-heading full-span">
						<h2>New Recipe</h2>
					</div>
					<label className="field full-span">
						<span>Name</span>
						<input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
					</label>
					<div className="ingredient-table full-span">
						{draft.ingredients.map((ingredient, index) => (
							<div key={index} className="ingredient-row">
								<input placeholder="Quantity" value={ingredient.quantity} onChange={(event) => updateIngredient(index, 'quantity', event.target.value)} />
								<input placeholder="Unit" value={ingredient.unit} onChange={(event) => updateIngredient(index, 'unit', event.target.value)} />
								<input placeholder="Item" value={ingredient.item} onChange={(event) => updateIngredient(index, 'item', event.target.value)} />
							</div>
						))}
					</div>
					<button type="button" onClick={() => setDraft((current) => ({ ...current, ingredients: [...current.ingredients, emptyIngredient()] }))}>
						Add Ingredient
					</button>
					<label className="field full-span">
						<span>Instructions</span>
						<textarea value={draft.instructions} onChange={(event) => setDraft({ ...draft, instructions: event.target.value })} />
					</label>
					<button type="submit" className="primary-action">Save Recipe</button>
				</form>
			</div>
		</div>
	);
}
