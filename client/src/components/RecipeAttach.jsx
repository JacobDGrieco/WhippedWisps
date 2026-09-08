import { useEffect, useRef, useState } from 'react';
import * as api from '../api/client.js';

function emptyIngredient() {
	return { item: '', quantity: '', unit: '' };
}

function PlusIcon() {
	return (
		<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
			<path d="M12 5v14M5 12h14" />
		</svg>
	);
}

function TrashIcon() {
	return (
		<svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
			<path d="M3 6h18M8 6V4h8v2M10 11v6M14 11v6M6 6l1 14h10l1-14" />
		</svg>
	);
}

const EMPTY_NEW_RECIPE = {
	name: '',
	ingredients: [emptyIngredient()],
	instructionSteps: ['']
};

export default function RecipeAttach({
	orderId,
	orderRecipes,
	pendingRecipeIds = [],
	onChange,
	onPendingRecipeIdsChange,
	embedded = false
}) {
	const [library, setLibrary] = useState([]);
	const [selectedRecipeId, setSelectedRecipeId] = useState('');
	const [newRecipe, setNewRecipe] = useState(EMPTY_NEW_RECIPE);
	const [isCreatingRecipe, setIsCreatingRecipe] = useState(false);
	const modalRef = useRef(null);

	useEffect(() => {
		api.fetchRecipes().then(setLibrary).catch(() => setLibrary([]));
	}, []);

	useEffect(() => {
		if (!isCreatingRecipe) {
			return undefined;
		}

		modalRef.current?.showModal();
		return () => modalRef.current?.close();
	}, [isCreatingRecipe]);

	function getLibraryRecipe(recipeId) {
		return library.find((recipe) => String(recipe.id) === String(recipeId));
	}

	async function attachRecipeId(recipeId) {
		if (!recipeId) {
			return;
		}

		if (!orderId) {
			const nextRecipeIds = [...new Set([...pendingRecipeIds.map(String), String(recipeId)])];
			onPendingRecipeIdsChange?.(nextRecipeIds);
			return;
		}

		const attached = await api.attachRecipe(orderId, Number(recipeId));
		onChange([...orderRecipes, attached]);
	}

	async function attachSelectedRecipe() {
		await attachRecipeId(selectedRecipeId);
		setSelectedRecipeId('');
	}

	async function createAndAttachRecipe() {
		if (!newRecipe.name.trim()) {
			return;
		}

		const created = await api.createRecipe({
			name: newRecipe.name.trim(),
			ingredients: newRecipe.ingredients.filter((ingredient) => (
				ingredient.quantity.trim() || ingredient.unit.trim() || ingredient.item.trim()
			)),
			instructions: newRecipe.instructionSteps.map((step) => step.trim()).filter(Boolean).join('\n') || null
		});
		setLibrary((current) => [...current, created].sort((first, second) => first.name.localeCompare(second.name)));
		await attachRecipeId(created.id);
		setNewRecipe(EMPTY_NEW_RECIPE);
		setIsCreatingRecipe(false);
	}

	async function updateAttachedRecipe(recipe, patch) {
		const updated = await api.updateOrderRecipe(orderId, recipe.id, { ...recipe, ...patch });
		onChange(orderRecipes.map((candidate) => (candidate.id === recipe.id ? updated : candidate)));
	}

	async function removeAttachedRecipe(recipeId) {
		await api.deleteOrderRecipe(orderId, recipeId);
		onChange(orderRecipes.filter((recipe) => recipe.id !== recipeId));
	}

	function removePendingRecipe(recipeId) {
		onPendingRecipeIdsChange?.(pendingRecipeIds.filter((id) => String(id) !== String(recipeId)));
	}

	function updateNewRecipeIngredient(index, field, value) {
		setNewRecipe((current) => ({
			...current,
			ingredients: current.ingredients.map((ingredient, ingredientIndex) => (
				ingredientIndex === index ? { ...ingredient, [field]: value } : ingredient
			))
		}));
	}

	function addNewRecipeIngredient() {
		setNewRecipe((current) => ({
			...current,
			ingredients: [...current.ingredients, emptyIngredient()]
		}));
	}

	function removeNewRecipeIngredient(index) {
		setNewRecipe((current) => {
			const ingredients = current.ingredients.filter((_, ingredientIndex) => ingredientIndex !== index);
			return { ...current, ingredients: ingredients.length ? ingredients : [emptyIngredient()] };
		});
	}

	function updateNewRecipeInstruction(index, value) {
		setNewRecipe((current) => ({
			...current,
			instructionSteps: current.instructionSteps.map((step, stepIndex) => (
				stepIndex === index ? value : step
			))
		}));
	}

	function addNewRecipeInstruction() {
		setNewRecipe((current) => ({
			...current,
			instructionSteps: [...current.instructionSteps, '']
		}));
	}

	function removeNewRecipeInstruction(index) {
		setNewRecipe((current) => {
			const instructionSteps = current.instructionSteps.filter((_, stepIndex) => stepIndex !== index);
			return { ...current, instructionSteps: instructionSteps.length ? instructionSteps : [''] };
		});
	}

	return (
		<section className={embedded ? 'embedded-panel embedded-panel-wide' : 'panel'}>
			<div className="section-heading">
				<h2>Recipes</h2>
			</div>
			<div className="recipe-link-grid">
				<div className="inline-add">
					<select value={selectedRecipeId} onChange={(event) => setSelectedRecipeId(event.target.value)}>
						<option value="">Choose a saved recipe</option>
						{library.map((recipe) => (
							<option key={recipe.id} value={recipe.id}>{recipe.name}</option>
						))}
					</select>
					<button type="button" onClick={attachSelectedRecipe}>Link</button>
					<button type="button" className="primary-action" onClick={() => setIsCreatingRecipe(true)}>New Recipe</button>
				</div>
			</div>
			{isCreatingRecipe ? (
				<dialog ref={modalRef} className="recipe-modal-dialog" aria-labelledby="production-new-recipe-title" onCancel={() => setIsCreatingRecipe(false)} onClick={(event) => {
					if (event.target === event.currentTarget) {
						setIsCreatingRecipe(false);
					}
				}}>
					<div className="panel form-grid single-column recipe-modal" onKeyDown={(event) => {
						if (event.key === 'Enter' && event.target instanceof HTMLInputElement) {
							event.preventDefault();
						}
					}}>
						<div className="section-heading full-span">
							<h2 id="production-new-recipe-title">New Recipe</h2>
							<button type="button" className="recipe-modal-close" aria-label="Close new recipe" onClick={() => setIsCreatingRecipe(false)}>x</button>
						</div>
						<label className="field full-span">
							<span>Name</span>
							<input required value={newRecipe.name} onChange={(event) => setNewRecipe((current) => ({ ...current, name: event.target.value }))} />
						</label>
						<div className="recipe-modal-section full-span">
							<div className="section-heading">
								<h3>Ingredients</h3>
								<button type="button" className="icon-button" onClick={addNewRecipeIngredient} aria-label="Add ingredient line">
									<PlusIcon />
								</button>
							</div>
							<div className="ingredient-table">
								{newRecipe.ingredients.map((ingredient, index) => (
									<div key={index} className="ingredient-row">
										<label className="field ingredient-field">
											<span>Count</span>
											<input inputMode="decimal" value={ingredient.quantity} onChange={(event) => updateNewRecipeIngredient(index, 'quantity', event.target.value)} />
										</label>
										<label className="field ingredient-field">
											<span>Measurement</span>
											<input value={ingredient.unit} onChange={(event) => updateNewRecipeIngredient(index, 'unit', event.target.value)} />
										</label>
										<label className="field ingredient-field">
											<span>Item</span>
											<input value={ingredient.item} onChange={(event) => updateNewRecipeIngredient(index, 'item', event.target.value)} />
										</label>
										<button type="button" className="icon-button text-danger" onClick={() => removeNewRecipeIngredient(index)} aria-label={`Delete ingredient line ${index + 1}`}>
											<TrashIcon />
										</button>
									</div>
								))}
							</div>
						</div>
						<div className="recipe-modal-section full-span">
							<div className="section-heading">
								<h3>Instructions</h3>
								<button type="button" className="icon-button" onClick={addNewRecipeInstruction} aria-label="Add instruction line">
									<PlusIcon />
								</button>
							</div>
							<div className="instruction-list">
								{newRecipe.instructionSteps.map((step, index) => (
									<div key={index} className="instruction-row">
										<label className="field">
											<span>Step {index + 1}</span>
											<input value={step} onChange={(event) => updateNewRecipeInstruction(index, event.target.value)} />
										</label>
										<button type="button" className="icon-button text-danger" onClick={() => removeNewRecipeInstruction(index)} aria-label={`Delete instruction line ${index + 1}`}>
											<TrashIcon />
										</button>
									</div>
								))}
							</div>
						</div>
						<div className="button-row recipe-modal-actions full-span">
							<button type="button" onClick={() => setIsCreatingRecipe(false)}>Cancel</button>
							<button type="button" className="primary-action" onClick={createAndAttachRecipe} disabled={!newRecipe.name.trim()}>Create and Link</button>
						</div>
					</div>
				</dialog>
			) : null}
			{pendingRecipeIds.length ? (
				<div className="pending-recipe-list">
					{pendingRecipeIds.map((recipeId) => {
						const recipe = getLibraryRecipe(recipeId);
						return (
							<span key={recipeId} className="tag-token">
								{recipe?.name || `Recipe ${recipeId}`}
								<button type="button" onClick={() => removePendingRecipe(recipeId)} aria-label={`Remove ${recipe?.name || 'recipe'}`}>x</button>
							</span>
						);
					})}
				</div>
			) : null}
			{orderId ? (
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
										<label className="field ingredient-field"><span>Quantity</span><input
											inputMode="decimal"
											value={ingredient.quantity}
											onChange={(event) => {
												const ingredients = [...recipe.ingredients];
												ingredients[index] = { ...ingredient, quantity: event.target.value };
												updateAttachedRecipe(recipe, { ingredients });
											}}
										/></label>
										<label className="field ingredient-field"><span>Unit</span><input
											value={ingredient.unit}
											onChange={(event) => {
												const ingredients = [...recipe.ingredients];
												ingredients[index] = { ...ingredient, unit: event.target.value };
												updateAttachedRecipe(recipe, { ingredients });
											}}
										/></label>
										<label className="field ingredient-field"><span>Item</span><input
											value={ingredient.item}
											onChange={(event) => {
												const ingredients = [...recipe.ingredients];
												ingredients[index] = { ...ingredient, item: event.target.value };
												updateAttachedRecipe(recipe, { ingredients });
											}}
										/></label>
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
			) : null}
		</section>
	);
}
