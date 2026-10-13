/**
 * When DecorationOverlay and SelectionOverlay measure again: on mount, on scroll, when the block's
 * box resizes, when text inside it moves without a resize (`text-moves.ts`), and when a windowed
 * table's mounted rows change, since a raw scroll fires before those rows mount.
 */

import { untrack } from 'svelte';
import type { BlockComponent } from '../../block-component';
import {
	firstScrollableDescendant,
	nearestScrollContainer
} from '../../windowing/scroll-ancestors';
import { observeResize } from '../../windowing/observe-resize';
import type { TextMoves } from './text-moves';

export function wireOverlayRemeasure(opts: {
	el: HTMLElement;
	editorRoot: HTMLElement | null;
	blockRef: BlockComponent | undefined;
	measure: () => void;
	/** Run the setup measure untracked, so a `measure` that reads the document doesn't re-wire these
	 *  listeners on every keystroke. Only that call: the row-window read below must stay tracked. */
	untrackSetupMeasure?: boolean;
	/** Absent only for an overlay mounted without the editor, which has no services to read. */
	textMoves?: TextMoves;
}): () => void {
	const { el, editorRoot, blockRef, measure, textMoves } = opts;

	// Plain synchronous read so the enclosing $effect depends on the table's row-window
	// $derived; it must not be inside untrack().
	blockRef?.mountedRowWindow?.();

	if (opts.untrackSetupMeasure) untrack(measure);
	else measure();

	const scrollEl =
		firstScrollableDescendant(el) ?? (editorRoot ? nearestScrollContainer(el, editorRoot) : null);

	const disposers: Array<() => void> = [];

	if (scrollEl) {
		scrollEl.addEventListener('scroll', measure, { passive: true });
		disposers.push(() => scrollEl.removeEventListener('scroll', measure));
	}

	// The editor root's vertical scroll is distinct from a block's inner scroll container;
	// this covers the non-windowed repaint-on-scroll path.
	if (editorRoot && editorRoot !== scrollEl) {
		editorRoot.addEventListener('scroll', measure, { passive: true });
		disposers.push(() => editorRoot.removeEventListener('scroll', measure));
	}

	// The block's own box changing under a live range (a paragraph set to a heading) moves the
	// text the rects were measured against.
	disposers.push(observeResize(el, () => measure()));
	if (textMoves) disposers.push(textMoves.watch(el, measure));

	return () => disposers.forEach((dispose) => dispose());
}
