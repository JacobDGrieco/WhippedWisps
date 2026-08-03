import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import * as api from '../api/client.js';
import NeededItemsChecklist from '../components/NeededItemsChecklist.jsx';
import PhotoUploader from '../components/PhotoUploader.jsx';
import RecipeAttach from '../components/RecipeAttach.jsx';
import TagInput from '../components/TagInput.jsx';

const ITEM_TYPES = ['cake', 'tiered cake', 'cupcakes', 'cake pops', 'cookies', 'other'];
const COUNTED_ITEM_TYPES = new Set(['cupcakes', 'cake pops', 'cookies']);
const COMMON_DIMENSIONS = ['4"', '6"', '8"', '10"', '12"', '1/4 sheet', '1/2 sheet', 'full sheet'];
const COMMON_FLAVORS = ['vanilla', 'chocolate', 'red velvet', 'funfetti', 'strawberry', 'lemon', 'marble', 'carrot', 'cookies and cream', 'almond', 'coconut', 'spice'];
const MINUTES_PER_DAY = 1440;
const DEFAULT_REMINDER_DAYS = 2;
const DEFAULT_REMINDER_OFFSETS = [DEFAULT_REMINDER_DAYS * MINUTES_PER_DAY];

function optionsWithCurrent(options, value) {
	return value && !options.includes(value) ? [value, ...options] : options;
}

function titleCaseOption(value) {
	return value
		.split(' ')
		.map((word) => (word ? `${word.charAt(0).toUpperCase()}${word.slice(1)}` : word))
		.join(' ');
}

function SelectField({ label, placeholder, value, options, onChange, className = '' }) {
	return (
		<label className={`field ${className}`.trim()}>
			<span>{label}</span>
			<select value={value || ''} onChange={(event) => onChange(event.target.value)}>
				<option value="">{placeholder}</option>
				{optionsWithCurrent(options, value).map((option) => (
					<option key={option} value={option}>{titleCaseOption(option)}</option>
				))}
			</select>
		</label>
	);
}

function createBlankTier() {
	return {
		dimensions: '',
		flavors: ''
	};
}

function createBlankOrderItem() {
	return {
		type: 'cake',
		theme: '',
		dimensions: '',
		servings: '',
		flavors: '',
		count: '',
		notes: '',
		tierCount: '',
		tierDetails: [],
		price: ''
	};
}

function normalizeTiers(tierDetails, tierCount) {
	const count = Number(tierCount) || tierDetails?.length || 0;
	return Array.from({ length: count }, (_, index) => ({
		...createBlankTier(),
		...(tierDetails?.[index] || {})
	}));
}

const EMPTY_ORDER = {
	customerName: '',
	customerContact: '',
	orderDate: '',
	dueDate: '',
	dueTime: '',
	deliveryType: 'pickup',
	deliveryAddress: '',
	deliveryWindowStart: '',
	deliveryWindowEnd: '',
	theme: '',
	description: '',
	dimensions: '',
	servings: '',
	flavors: '',
	price: '',
	orderItems: [createBlankOrderItem()],
	notes: '',
	reminderOffsets: DEFAULT_REMINDER_OFFSETS,
	tags: [],
	neededItems: [],
	photos: [],
	orderRecipes: []
};

function normalizeOrderItems(order) {
	if (Array.isArray(order.orderItems) && order.orderItems.length) {
		return order.orderItems.map((item) => ({
			...createBlankOrderItem(),
			...item,
			price: item.price ?? '',
			count: item.count ?? '',
			tierCount: item.tierCount ?? '',
			tierDetails: normalizeTiers(item.tierDetails, item.tierCount)
		}));
	}

	if (order.dimensions || order.servings || order.flavors || order.price || order.price === 0) {
		return [{
			type: 'cake',
			theme: '',
			dimensions: order.dimensions || '',
			servings: order.servings || '',
			flavors: order.flavors || '',
			price: order.price ?? ''
		}];
	}

	return [createBlankOrderItem()];
}

function reminderOffsetsToDays(reminderOffsets) {
	const [firstOffset] = Array.isArray(reminderOffsets) && reminderOffsets.length
		? reminderOffsets
		: DEFAULT_REMINDER_OFFSETS;
	const minutes = Number(firstOffset);

	return Number.isFinite(minutes) ? Math.max(0, Math.round(minutes / MINUTES_PER_DAY)) : DEFAULT_REMINDER_DAYS;
}

function reminderDaysToOffsets(value) {
	const days = Number(value);

	return Number.isFinite(days) && days >= 0
		? [Math.trunc(days) * MINUTES_PER_DAY]
		: DEFAULT_REMINDER_OFFSETS;
}

function mergeTagSuggestions(currentSuggestions, nextTags) {
	const seen = new Set();
	return [...(currentSuggestions || []), ...(nextTags || [])]
		.map((tag) => String(tag || '').trim().replace(/\s+/g, ' '))
		.filter(Boolean)
		.filter((tag) => {
			const key = tag.toLowerCase();
			if (seen.has(key)) {
				return false;
			}

			seen.add(key);
			return true;
		});
}

function getAutomaticOrderTags(order) {
	const itemTags = (order.orderItems || []).flatMap((item) => [
		item.type ? titleCaseOption(item.type) : '',
		item.flavors ? titleCaseOption(item.flavors) : '',
		item.dimensions ? titleCaseOption(item.dimensions) : '',
		...(item.tierDetails || []).flatMap((tier) => [
			tier.flavors ? titleCaseOption(tier.flavors) : '',
			tier.dimensions ? titleCaseOption(tier.dimensions) : ''
		])
	]);

	return mergeTagSuggestions([], itemTags);
}

function removeLockedTags(tags, lockedTags) {
	const lockedKeys = new Set((lockedTags || []).map((tag) => tag.toLowerCase()));
	return (tags || []).filter((tag) => !lockedKeys.has(String(tag || '').toLowerCase()));
}

export default function OrderForm() {
	const { id } = useParams();
	const navigate = useNavigate();
	const isNew = !id;
	const [order, setOrder] = useState(EMPTY_ORDER);
	const [error, setError] = useState('');
	const [notice, setNotice] = useState('');
	const [isSaving, setIsSaving] = useState(false);
	const [tagSuggestions, setTagSuggestions] = useState([]);
	const lockedTags = useMemo(() => getAutomaticOrderTags(order), [order]);
	const availableTagSuggestions = useMemo(
		() => mergeTagSuggestions(tagSuggestions, lockedTags),
		[lockedTags, tagSuggestions]
	);

	useEffect(() => {
		if (isNew) {
			setOrder({ ...EMPTY_ORDER, orderItems: [createBlankOrderItem()] });
			return;
		}

		api.fetchOrder(id)
			.then((data) => setOrder({ ...EMPTY_ORDER, ...data, orderItems: normalizeOrderItems(data) }))
			.catch((err) => setError(err.message));
	}, [id, isNew]);

	useEffect(() => {
		api.fetchTags()
			.then((tags) => setTagSuggestions(mergeTagSuggestions([], tags)))
			.catch(() => setTagSuggestions([]));
	}, []);

	function updateField(field, value) {
		setOrder((current) => ({ ...current, [field]: value }));
	}

	function updateTags(tags) {
		setTagSuggestions((current) => mergeTagSuggestions(current, tags));
		updateField('tags', removeLockedTags(tags, lockedTags));
	}

	function updateDeliveryType(deliveryType) {
		setOrder((current) => ({
			...current,
			deliveryType,
			...(deliveryType === 'pickup'
				? {
					deliveryAddress: '',
					deliveryWindowStart: '',
					deliveryWindowEnd: ''
				}
				: {})
		}));
	}

	function updateOrderItem(index, field, value) {
		setOrder((current) => ({
			...current,
			orderItems: (current.orderItems || []).map((item, itemIndex) => (
				itemIndex === index ? { ...item, [field]: value } : item
			))
		}));
	}

	function updateOrderItemType(index, type) {
		setOrder((current) => ({
			...current,
			orderItems: (current.orderItems || []).map((item, itemIndex) => {
				if (itemIndex !== index) {
					return item;
				}

				return {
					...createBlankOrderItem(),
					theme: item.theme || '',
					price: item.price ?? '',
					type,
					tierCount: type === 'tiered cake' ? item.tierCount || 2 : '',
					tierDetails: type === 'tiered cake' ? normalizeTiers(item.tierDetails, item.tierCount || 2) : []
				};
			})
		}));
	}

	function updateTierCount(index, value) {
		const parsedCount = Number(value);
		const tierCount = value === '' || !Number.isFinite(parsedCount) ? '' : Math.max(0, parsedCount);
		setOrder((current) => ({
			...current,
			orderItems: (current.orderItems || []).map((item, itemIndex) => (
				itemIndex === index
					? { ...item, tierCount, tierDetails: normalizeTiers(item.tierDetails, tierCount) }
					: item
			))
		}));
	}

	function updateTierDetail(itemIndex, tierIndex, field, value) {
		setOrder((current) => ({
			...current,
			orderItems: (current.orderItems || []).map((item, index) => {
				if (index !== itemIndex) {
					return item;
				}

				return {
					...item,
					tierDetails: (item.tierDetails || []).map((tier, currentTierIndex) => (
						currentTierIndex === tierIndex ? { ...tier, [field]: value } : tier
					))
				};
			})
		}));
	}

	function addOrderItem() {
		setOrder((current) => ({
			...current,
			orderItems: [...(current.orderItems || []), createBlankOrderItem()]
		}));
	}

	function removeOrderItem(index) {
		setOrder((current) => {
			const nextItems = (current.orderItems || []).filter((_, itemIndex) => itemIndex !== index);
			return {
				...current,
				orderItems: nextItems.length ? nextItems : [createBlankOrderItem()]
			};
		});
	}

	async function handleSubmit(event) {
		event.preventDefault();
		setIsSaving(true);
		setError('');
		setNotice('');

		try {
			const orderItems = (order.orderItems || []).map((item, index) => ({
				...item,
				dimensions: item.type === 'tiered cake' ? '' : item.dimensions,
				flavors: item.type === 'tiered cake' ? '' : item.flavors,
				price: item.price === '' ? null : Number(item.price),
				sortOrder: index
			}));
			const firstItem = orderItems[0] || {};
			const payload = {
				customerName: order.customerName,
				customerContact: order.customerContact,
				orderDate: order.orderDate,
				dueDate: order.dueDate,
				dueTime: order.dueTime,
				deliveryType: order.deliveryType,
				deliveryAddress: order.deliveryAddress,
				deliveryWindowStart: order.deliveryWindowStart,
				deliveryWindowEnd: order.deliveryWindowEnd,
				theme: order.theme,
				description: order.description,
				orderItems,
				dimensions: firstItem.dimensions || '',
				servings: firstItem.servings || '',
				flavors: firstItem.flavors || '',
				price: firstItem.price ?? null,
				notes: order.notes,
				reminderOffsets: order.reminderOffsets,
				tags: mergeTagSuggestions(order.tags, lockedTags)
			};
			const saved = isNew ? await api.createOrder(payload) : await api.updateOrder(id, payload);
			if (saved.calendarSyncError) {
				setNotice(saved.calendarSyncError);
			}

			setTagSuggestions((current) => mergeTagSuggestions(current, saved.tags));
			setOrder({ ...EMPTY_ORDER, ...saved, orderItems: normalizeOrderItems(saved) });
			if (isNew) {
				navigate(`/orders/${saved.id}`, { replace: true });
			}
		} catch (err) {
			setError(err.message);
		} finally {
			setIsSaving(false);
		}
	}

	async function handleArchive() {
		const archived = await api.archiveOrder(id);
		setOrder({ ...EMPTY_ORDER, ...archived });
		navigate(`/archive/${archived.slug}`);
	}

	async function handleDelete() {
		await api.deleteOrder(id);
		navigate('/');
	}

	async function handleResync() {
		const synced = await api.resyncCalendar(id);
		setNotice(synced.calendarSyncError || 'Calendar sync requested.');
	}

	return (
		<form className="order-form page-grid" onSubmit={handleSubmit}>
			<section className="page-heading">
				<div>
					<p className="eyebrow">{isNew ? 'New order' : order.status}</p>
					<h2>{isNew ? 'Create Order' : order.theme || 'Order Detail'}</h2>
				</div>
				<div className="button-row">
					<Link className="secondary-action" to="/">Back</Link>
					<button type="submit" className="primary-action" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</button>
				</div>
			</section>

			{error ? <p className="alert">{error}</p> : null}
			{notice ? <p className="notice">{notice}</p> : null}

			<section className="panel order-details-panel">
				<div className="section-heading">
					<h2>Order Details</h2>
				</div>
				<div className="form-row two-fields">
					<label className="field">
						<span>Customer Name</span>
						<input required value={order.customerName || ''} onChange={(event) => updateField('customerName', event.target.value)} />
					</label>
					<label className="field">
						<span>Customer Contact</span>
						<input value={order.customerContact || ''} onChange={(event) => updateField('customerContact', event.target.value)} />
					</label>
				</div>
				<div className="form-row two-fields">
					<label className="field">
						<span>Order Date</span>
						<input type="date" value={order.orderDate || ''} onChange={(event) => updateField('orderDate', event.target.value)} />
					</label>
					<label className="field">
						<span>Due Date</span>
						<input required type="date" value={order.dueDate || ''} onChange={(event) => updateField('dueDate', event.target.value)} />
					</label>
				</div>
				<div className="form-row two-fields">
					<label className="field">
						<span>Theme</span>
						<input value={order.theme || ''} onChange={(event) => updateField('theme', event.target.value)} />
					</label>
					<label className="field">
						<span>Due Time</span>
						<input type="time" value={order.dueTime || ''} onChange={(event) => updateField('dueTime', event.target.value)} />
					</label>
				</div>
				<div className="form-row fulfillment-row">
					<div className="fulfillment-group">
						<span>Fulfillment</span>
						<div className="split-button" role="group" aria-label="Fulfillment type">
							<button
								type="button"
								className={order.deliveryType !== 'delivery' ? 'active' : ''}
								aria-pressed={order.deliveryType !== 'delivery'}
								onClick={() => updateDeliveryType('pickup')}
							>
								Pickup
							</button>
							<button
								type="button"
								className={order.deliveryType === 'delivery' ? 'active' : ''}
								aria-pressed={order.deliveryType === 'delivery'}
								onClick={() => updateDeliveryType('delivery')}
							>
								Delivery
							</button>
						</div>
					</div>
					{order.deliveryType === 'delivery' ? (
						<>
							<label className="field">
								<span>Delivery Address</span>
								<input value={order.deliveryAddress || ''} onChange={(event) => updateField('deliveryAddress', event.target.value)} />
							</label>
							<label className="field">
								<span>Window Start</span>
								<input type="time" value={order.deliveryWindowStart || ''} onChange={(event) => updateField('deliveryWindowStart', event.target.value)} />
							</label>
						</>
					) : null}
				</div>
			</section>

			<section className="panel order-items-panel">
				<div className="section-heading">
					<h2>Order Items</h2>
					<button type="button" onClick={addOrderItem}>Add Item</button>
				</div>
				<div className="order-item-list">
					{(order.orderItems || []).map((item, index) => (
						<article key={item.id || index} className="order-item-card">
							<div className="order-item-card-header">
								<label className="field">
									<span>Type</span>
									<select value={item.type || ''} onChange={(event) => updateOrderItemType(index, event.target.value)}>
										<option value="" disabled>- Type -</option>
										{ITEM_TYPES.map((type) => <option key={type} value={type}>{titleCaseOption(type)}</option>)}
									</select>
								</label>
								<button type="button" className="text-danger" onClick={() => removeOrderItem(index)}>Remove</button>
							</div>
							<div className="order-item-fields">
								{item.type === 'tiered cake' ? (
									<label className="field tiers-field">
										<span>Tiers</span>
										<input type="number" min="0" step="1" value={item.tierCount ?? ''} onChange={(event) => updateTierCount(index, event.target.value)} />
									</label>
								) : null}
								{item.type !== 'other' && item.type !== 'tiered cake' ? (
									<SelectField
										label="Flavor"
										placeholder="- Flavor -"
										value={item.flavors || ''}
										options={COMMON_FLAVORS}
										className="flavor-field"
										onChange={(value) => updateOrderItem(index, 'flavors', value)}
									/>
								) : null}
								{item.type === 'cake' ? (
									<SelectField
										label="Dimensions"
										placeholder="- Dims -"
										value={item.dimensions || ''}
										options={COMMON_DIMENSIONS}
										className="dimension-field"
										onChange={(value) => updateOrderItem(index, 'dimensions', value)}
									/>
								) : null}
								{['cake', 'tiered cake'].includes(item.type) ? (
									<>
										<label className="field servings-field">
											<span>Servings</span>
											<input
												type="number"
												min="0"
												step="1"
												inputMode="numeric"
												value={item.servings || ''}
												onChange={(event) => updateOrderItem(index, 'servings', event.target.value)}
											/>
										</label>
									</>
								) : null}
								{COUNTED_ITEM_TYPES.has(item.type) ? (
									<label className="field servings-field">
										<span>Count</span>
										<input type="number" min="0" step="1" value={item.count ?? ''} onChange={(event) => updateOrderItem(index, 'count', event.target.value)} />
									</label>
								) : null}
								{item.type !== 'other' ? (
									<label className="field theme-field">
										<span>Theme</span>
										<input value={item.theme || ''} onChange={(event) => updateOrderItem(index, 'theme', event.target.value)} />
									</label>
								) : null}
								{item.type === 'other' ? (
									<label className="field wide-field">
										<span>Notes</span>
										<input value={item.notes || ''} onChange={(event) => updateOrderItem(index, 'notes', event.target.value)} />
									</label>
								) : null}
								<label className="field price-field">
									<span>Price</span>
									<input type="number" min="0" step="0.01" inputMode="decimal" value={item.price ?? ''} onChange={(event) => updateOrderItem(index, 'price', event.target.value)} />
								</label>
							</div>
							{item.type === 'tiered cake' && (item.tierDetails || []).length ? (
								<div className="tier-list">
									{item.tierDetails.map((tier, tierIndex) => (
										<div key={tierIndex} className="tier-row">
											<strong>Tier {tierIndex + 1}</strong>
											<SelectField
												label="Flavor"
												placeholder="- Flavor -"
												value={tier.flavors || ''}
												options={COMMON_FLAVORS}
												className="flavor-field"
												onChange={(value) => updateTierDetail(index, tierIndex, 'flavors', value)}
											/>
											<SelectField
												label="Dimensions"
												placeholder="- Dims -"
												value={tier.dimensions || ''}
												options={COMMON_DIMENSIONS}
												className="dimension-field"
												onChange={(value) => updateTierDetail(index, tierIndex, 'dimensions', value)}
											/>
										</div>
									))}
								</div>
							) : null}
						</article>
					))}
				</div>
			</section>

			<section className="panel order-notes-panel">
				<div className="section-heading">
					<h2>Order Notes</h2>
				</div>
				<div className="order-notes-grid">
					<label className="field full-span">
						<span>Description</span>
						<textarea value={order.description || ''} onChange={(event) => updateField('description', event.target.value)} />
					</label>
					<label className="field full-span">
						<span>Notes</span>
						<textarea value={order.notes || ''} onChange={(event) => updateField('notes', event.target.value)} />
					</label>
					<TagInput tags={order.tags || []} lockedTags={lockedTags} suggestions={availableTagSuggestions} onChange={updateTags} />
					<label className="field reminder-days-field">
						<span>Reminder Days</span>
						<input
							type="number"
							min="0"
							step="1"
							inputMode="numeric"
							value={reminderOffsetsToDays(order.reminderOffsets)}
							onChange={(event) => updateField('reminderOffsets', reminderDaysToOffsets(event.target.value))}
						/>
					</label>
				</div>
			</section>

			{!isNew ? (
				<>
					<div className="management-grid">
						<NeededItemsChecklist
							orderId={id}
							items={order.neededItems || []}
							onChange={(neededItems) => updateField('neededItems', neededItems)}
						/>
						<PhotoUploader
							orderId={id}
							photos={order.photos || []}
							onChange={(photos) => updateField('photos', photos)}
						/>
					</div>
					<RecipeAttach
						orderId={id}
						orderRecipes={order.orderRecipes || []}
						onChange={(orderRecipes) => updateField('orderRecipes', orderRecipes)}
					/>
					<section className="danger-zone">
						<div className="button-row">
							{order.status !== 'archived' ? <button type="button" onClick={handleArchive}>Mark Complete and Archive</button> : null}
							<button type="button" onClick={handleResync}>Resync Calendar</button>
							<button type="button" className="text-danger" onClick={handleDelete}>Delete Order</button>
						</div>
					</section>
				</>
			) : null}
		</form>
	);
}
