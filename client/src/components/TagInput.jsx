import { useMemo, useState } from 'react';

function normalizeTagName(name) {
	return String(name || '').trim().replace(/\s+/g, ' ');
}

function tagKey(name) {
	return normalizeTagName(name).toLowerCase();
}

function canonicalTagName(name, suggestions) {
	const normalizedName = normalizeTagName(name);
	const savedName = (suggestions || []).find((suggestion) => tagKey(suggestion) === tagKey(normalizedName));

	return savedName || normalizedName;
}

function dedupeTags(tags, suggestions) {
	const seen = new Set();

	return (tags || []).reduce((nextTags, tag) => {
		const canonicalTag = canonicalTagName(tag, suggestions);
		const key = tagKey(canonicalTag);
		if (!canonicalTag || seen.has(key)) {
			return nextTags;
		}

		seen.add(key);
		return [...nextTags, canonicalTag];
	}, []);
}

function withoutLockedTags(tags, lockedTags) {
	const lockedKeys = new Set((lockedTags || []).map(tagKey));
	return (tags || []).filter((tag) => !lockedKeys.has(tagKey(tag)));
}

export default function TagInput({ tags, lockedTags = [], suggestions = [], onChange }) {
	const [draft, setDraft] = useState('');
	const automaticTags = useMemo(() => dedupeTags(lockedTags, suggestions), [lockedTags, suggestions]);
	const editableTags = useMemo(
		() => dedupeTags(withoutLockedTags(tags, automaticTags), suggestions),
		[automaticTags, suggestions, tags]
	);
	const hasTags = useMemo(
		() => Boolean(dedupeTags([...automaticTags, ...editableTags], suggestions).length),
		[automaticTags, editableTags, suggestions]
	);

	function addTag(name, { canonicalize = true } = {}) {
		const nextTag = canonicalize ? canonicalTagName(name, suggestions) : normalizeTagName(name);
		if (!nextTag) {
			return;
		}

		onChange(dedupeTags([...editableTags, nextTag], suggestions));
		setDraft('');
	}

	function commitDraft() {
		addTag(draft);
	}

	function removeTag(name) {
		const keyToRemove = tagKey(name);
		onChange(editableTags.filter((tag) => tagKey(tag) !== keyToRemove));
	}

	function handleDraftKeyDown(event) {
		if (event.key === 'Backspace' && !draft && editableTags.length) {
			removeTag(editableTags[editableTags.length - 1]);
			return;
		}

		if (!['Enter', ',', ';'].includes(event.key)) {
			return;
		}

		event.preventDefault();
		commitDraft();
	}

	return (
		<div className="field tag-picker">
			<span>Tags</span>
			<div className="tag-chip-input">
				{automaticTags.map((tag) => (
					<span key={tag} className="tag-token is-locked" title="Added from order items">
						<span>{tag}</span>
						<span aria-hidden="true">Auto</span>
					</span>
				))}
				{editableTags.map((tag) => (
					<button type="button" key={tag} className="tag-token" onClick={() => removeTag(tag)} aria-label={`Remove ${tag}`}>
						<span>{tag}</span>
						<span aria-hidden="true">x</span>
					</button>
				))}
				<input
					aria-label="Add tag"
					value={draft}
					onBlur={commitDraft}
					onChange={(event) => setDraft(event.target.value)}
					onKeyDown={handleDraftKeyDown}
					placeholder={hasTags ? '' : 'Add tags'}
				/>
			</div>
		</div>
	);
}
