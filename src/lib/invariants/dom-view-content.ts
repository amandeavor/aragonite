/**
 * G1.136: a DOM block view fills the element the editor made for it, in place under the block's
 * host and never `display: contents`, since rects and the drag handle measure it as the block. A
 * leaf's text element sits inside it and holds no element of its own: the editor owns its text.
 */

import type { InvariantViolation } from '../assert';
import { BLOCK_CONTENT_SELECTOR } from '../caret/block-content-selector';

const violation = (message: string): InvariantViolation => ({ code: 'dom-view-content', message });

/** The text element alone, as `attach` receives it: the editor owns its one text node. */
export function checkAttachedLeaf(leafEl: HTMLElement | null): InvariantViolation | null {
	if (leafEl?.firstElementChild) {
		return violation(
			`a DOM leaf view attached a <${leafEl.tagName.toLowerCase()}> holding elements; the editor ` +
				'owns its text, so put the view’s own elements beside it'
		);
	}
	return null;
}

/** The mounted view: `target` in its place under the block host, and the leaf's element in it. */
export function checkDomViewContent(
	target: HTMLElement,
	leafEl: HTMLElement | null
): InvariantViolation | null {
	const host = target.parentElement;
	if (host?.querySelector(BLOCK_CONTENT_SELECTOR) !== target) {
		return violation('a DOM block view moved the element it was given out of its block');
	}
	if (getComputedStyle(target).display === 'contents') {
		return violation(
			'a DOM block view set `display: contents` on the element it was given, which measures as nothing'
		);
	}
	if (!leafEl) return null;
	if (!target.contains(leafEl)) {
		return violation('a DOM leaf view attached an element outside the one it was given');
	}
	return checkAttachedLeaf(leafEl);
}
