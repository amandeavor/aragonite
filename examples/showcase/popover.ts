/**
 * How the showcase bar's popovers close: Escape (focus goes back to the trigger), a press outside
 * the anchor, or focus moving out of it. `anchor` holds both the trigger and the popover.
 */
export function dismissPopover(anchor: HTMLElement, close: () => void): () => void {
	const onPointerDown = (event: PointerEvent) => {
		if (!anchor.contains(event.target as Node)) close();
	};
	const onKeyDown = (event: KeyboardEvent) => {
		if (event.key !== 'Escape') return;
		close();
		anchor.querySelector<HTMLElement>('[aria-expanded]')?.focus();
	};
	const onFocusOut = (event: FocusEvent) => {
		const next = event.relatedTarget as Node | null;
		if (next && !anchor.contains(next)) close();
	};
	document.addEventListener('pointerdown', onPointerDown, true);
	// On the document: a trigger pressed with the mouse keeps no focus in every browser.
	document.addEventListener('keydown', onKeyDown);
	anchor.addEventListener('focusout', onFocusOut);
	return () => {
		document.removeEventListener('pointerdown', onPointerDown, true);
		document.removeEventListener('keydown', onKeyDown);
		anchor.removeEventListener('focusout', onFocusOut);
	};
}
