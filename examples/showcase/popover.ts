/**
 * How the showcase bar's popovers close: Escape (focus goes back to the trigger), a press outside
 * the anchor, or focus moving out of it. `anchor` holds both the trigger and the popover.
 */
export function dismissPopover(anchor: HTMLElement, close: () => void): () => void {
	const releaseEscape = closeOnEscape(anchor, close);
	const onPointerDown = (event: PointerEvent) => {
		if (!anchor.contains(event.target as Node)) close();
	};
	const onFocusOut = (event: FocusEvent) => {
		const next = event.relatedTarget as Node | null;
		if (next && !anchor.contains(next)) close();
	};
	document.addEventListener('pointerdown', onPointerDown, true);
	anchor.addEventListener('focusout', onFocusOut);
	return () => {
		releaseEscape();
		document.removeEventListener('pointerdown', onPointerDown, true);
		anchor.removeEventListener('focusout', onFocusOut);
	};
}

/** Escape closes the popover and refocuses its trigger, unless focus sits outside the anchor. */
export function closeOnEscape(anchor: HTMLElement, close: () => void): () => void {
	const onKeyDown = (event: KeyboardEvent) => {
		if (event.key !== 'Escape') return;
		// Focus on nothing counts as inside, since some browsers leave a mouse-pressed trigger
		// unfocused; focus elsewhere, in the editor say, keeps its own Escape.
		const focused = document.activeElement;
		if (focused && focused !== document.body && !anchor.contains(focused)) return;
		close();
		anchor.querySelector<HTMLElement>('[aria-expanded]')?.focus();
	};
	// On the document, so a press of Escape reaches it with focus on nothing.
	document.addEventListener('keydown', onKeyDown);
	return () => document.removeEventListener('keydown', onKeyDown);
}
