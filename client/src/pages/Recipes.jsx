import { useEffect, useRef, useState } from 'react';
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
	const [isCreating, setIsCreating] = useState(false);
	const modalRef = useRef(null);

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

	function removeIngredient(index) {
		setDraft((current) => {
			const ingredients = current.ingredients.filter((_, ingredientIndex) => ingredientIndex !== index);
			return { ...current, ingredients: ingredients.length ? ingredients : [emptyIngredient()] };
		});
	}

	async function createDraftRecipe(event) {
		event.preventDefault();
		const created = await api.createRecipe(draft);
		setRecipes((current) => [...current, created]);
		setDraft(EMPTY_RECIPE);
		setIsCreating(false);
	}

	useEffect(() => {
		if (!isCreating) {
			return undefined;
		}

		modalRef.current?.showModal();
		return () => modalRef.current?.close();
	}, [isCreating]);

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
				<button type="button" className="primary-action" onClick={() => setIsCreating(true)}>New Recipe</button>
			</section>
			{error ? <p className="alert">{error}</p> : null}
			<section className="panel">
					<div className="section-heading">
						<h2>Completed Recipes</h2>
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
			{isCreating ? (
				<dialog ref={modalRef} className="recipe-modal-dialog" aria-labelledby="new-recipe-title" onCancel={() => setIsCreating(false)} onClick={(event) => {
					if (event.target === event.currentTarget) {
						setIsCreating(false);
					}
				}}>
				<form className="panel form-grid single-column recipe-modal" onSubmit={createDraftRecipe}>
					<div className="section-heading full-span">
						<h2 id="new-recipe-title">New Recipe</h2>
						<button type="button" className="recipe-modal-close" aria-label="Close new recipe" onClick={() => setIsCreating(false)}>×</button>
					</div>
					<label className="field full-span">
						<span>Name</span>
						<input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
					</label>
					<div className="ingredient-table full-span">
						{draft.ingredients.map((ingredient, index) => (
							<div key={index} className="ingredient-row">
								<label className="field ingredient-field"><span>Quantity</span><input inputMode="decimal" value={ingredient.quantity} onChange={(event) => updateIngredient(index, 'quantity', event.target.value)} /></label>
								<label className="field ingredient-field"><span>Unit</span><input value={ingredient.unit} onChange={(event) => updateIngredient(index, 'unit', event.target.value)} /></label>
								<label className="field ingredient-field"><span>Item</span><input value={ingredient.item} onChange={(event) => updateIngredient(index, 'item', event.target.value)} /></label>
								{index > 0 ? (
									<button type="button" className="text-danger" onClick={() => removeIngredient(index)}>
										Remove
									</button>
								) : null}
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
				</dialog>
			) : null}
		</div>
	);
}
