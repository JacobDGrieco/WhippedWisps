import { useId, useMemo, useState } from 'react';

function normalizeThemeName(name) {
	return String(name || '').trim().replace(/\s+/g, ' ');
}

function themeKey(name) {
	return normalizeThemeName(name).toLowerCase();
}

function canonicalThemeName(name, suggestions) {
	const normalizedName = normalizeThemeName(name);
	const savedName = (suggestions || []).find((suggestion) => themeKey(suggestion) === themeKey(normalizedName));

	return savedName || normalizedName;
}

function optionsWithCurrent(options, value) {
	const normalizedValue = normalizeThemeName(value);
	if (!normalizedValue || options.some((option) => themeKey(option) === themeKey(normalizedValue))) {
		return options;
	}

	return [normalizedValue, ...options];
}

function RequiredLabel({ children, required = false }) {
	return (
		<span>
			{children}
			{required ? <span className="required-mark" aria-hidden="true">*</span> : null}
		</span>
	);
}

export default function ThemeInput({
	label = 'Theme',
	value,
	suggestions = [],
	required = false,
	className = '',
	placeholder = 'Choose theme',
	onChange
}) {
	const listId = useId();
	const [draft, setDraft] = useState('');
	const currentTheme = normalizeThemeName(value);
	const themeOptions = useMemo(
		() => optionsWithCurrent(suggestions, currentTheme),
		[currentTheme, suggestions]
	);

	function commitDraft() {
		const nextTheme = canonicalThemeName(draft, themeOptions);
		if (!nextTheme) {
			return;
		}

		onChange(nextTheme);
		setDraft('');
	}

	function clearTheme() {
		onChange('');
		setDraft('');
	}

	function handleDraftKeyDown(event) {
		if (event.key === 'Backspace' && !draft && currentTheme) {
			clearTheme();
			return;
		}

		if (!['Enter', ',', ';'].includes(event.key)) {
			return;
		}

		event.preventDefault();
		commitDraft();
	}

	return (
		<div className={`field theme-picker ${className}`.trim()}>
			<RequiredLabel required={required}>{label}</RequiredLabel>
			<div className="tag-chip-input theme-chip-input">
				{currentTheme ? (
					<button type="button" className="tag-token" onClick={clearTheme} aria-label={`Clear ${label.toLowerCase()} ${currentTheme}`}>
						<span>{currentTheme}</span>
						<span aria-hidden="true">x</span>
					</button>
				) : null}
				<input
					aria-label={currentTheme ? `Replace ${label.toLowerCase()}` : label}
					list={listId}
					required={required && !currentTheme}
					value={draft}
					onBlur={commitDraft}
					onChange={(event) => setDraft(event.target.value)}
					onKeyDown={handleDraftKeyDown}
					placeholder={currentTheme ? 'Replace' : placeholder}
				/>
				<datalist id={listId}>
					{themeOptions.map((theme) => <option key={theme} value={theme} />)}
				</datalist>
			</div>
		</div>
	);
}
