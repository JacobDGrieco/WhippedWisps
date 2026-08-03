import { useEffect, useState } from 'react';
import * as api from '../api/client.js';

function emptyIngredient() {
	return { item: '', quantity: '', unit: '' };
}

export default function RecipeAttach({ orderId, orderRecipes, onChange }) {
	const [library, setLibrary] = useState([]);
	const [selectedRecipeId, setSelectedRecipeId] = useState('');

	useEffect(() => {
		api.fetchRecipes().then(setLibrary).catch(() => setLibrary([]));
	}, []);

	async function attachSelectedRecipe() {
		if (!selectedRecipeId) {
			return;
		}

		const attached = await api.attachRecipe(orderId, Number(selectedRecipeId));
		onChange([...orderRecipes, attached]);
		setSelectedRecipeId('');
	}

	async function updateAttachedRecipe(recipe, patch) {
		const updated = await api.updateOrderRecipe(orderId, recipe.id, { ...recipe, ...patch });
		onChange(orderRecipes.map((candidate) => (candidate.id === recipe.id ? updated : candidate)));
	}

	async function removeAttachedRecipe(recipeId) {
		await api.deleteOrderRecipe(orderId, recipeId);
		onChange(orderRecipes.filter((recipe) => recipe.id !== recipeId));
	}

	return (
		<section className="panel">
			<div className="section-heading">
				<h2>Recipes</h2>
			</div>
			<div className="inline-add">
				<select value={selectedRecipeId} onChange={(event) => setSelectedRecipeId(event.target.value)}>
					<option value="">Choose a template</option>
					{library.map((recipe) => (
						<option key={recipe.id} value={recipe.id}>{recipe.name}</option>
					))}
				</select>
				<button type="button" onClick={attachSelectedRecipe}>Attach</button>
			</div>
			<div className="recipe-stack">
				{orderRecipes.map((recipe) => (
					<article key={recipe.id} className="recipe-editor">
						<label className="field">
							<span>Recipe name</span>
							<input value={recipe.recipeName} onChange={(event) => updateAttachedRecipe(recipe, { recipeName: event.target.value })} />
						</label>
						<div className="ingredient-table">
							{recipe.ingredients.map((ingredient, index) => (
								<div key={`${recipe.id}-${index}`} className="ingredient-row">
									<input
										placeholder="Quantity"
										value={ingredient.quantity}
										onChange={(event) => {
											const ingredients = [...recipe.ingredients];
											ingredients[index] = { ...ingredient, quantity: event.target.value };
											updateAttachedRecipe(recipe, { ingredients });
										}}
									/>
									<input
										placeholder="Unit"
										value={ingredient.unit}
										onChange={(event) => {
											const ingredients = [...recipe.ingredients];
											ingredients[index] = { ...ingredient, unit: event.target.value };
											updateAttachedRecipe(recipe, { ingredients });
										}}
									/>
									<input
										placeholder="Item"
										value={ingredient.item}
										onChange={(event) => {
											const ingredients = [...recipe.ingredients];
											ingredients[index] = { ...ingredient, item: event.target.value };
											updateAttachedRecipe(recipe, { ingredients });
										}}
									/>
								</div>
							))}
						</div>
						<div className="button-row">
							<button
								type="button"
								onClick={() => updateAttachedRecipe(recipe, { ingredients: [...recipe.ingredients, emptyIngredient()] })}
							>
								Add Ingredient
							</button>
							<button type="button" className="text-danger" onClick={() => removeAttachedRecipe(recipe.id)}>Remove Recipe</button>
						</div>
						<label className="field">
							<span>Instructions</span>
							<textarea value={recipe.instructions || ''} onChange={(event) => updateAttachedRecipe(recipe, { instructions: event.target.value })} />
						</label>
					</article>
				))}
			</div>
		</section>
	);
}
