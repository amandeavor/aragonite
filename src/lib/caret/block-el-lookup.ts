/**
 * A block's elements by path: its box, which geometry measures as the block, and its content
 * element, which takes focus and holds the caret offsets. They differ only for a DOM leaf view,
 * whose text sits inside its box. Table cells carry no `data-block-path`, so a deep cell path
 * resolves the table wrapper and descends into the cell DOM.
 */

import {
	BLOCK_CONTENT_SELECTOR,
	TABLE_CELL_SELECTOR,
	VIEW_TEXT_ATTR,
	VIEW_TEXT_HOST_ATTR
} from './block-content-selector';
import { widgetElByStart } from '../core/inline/inline-widgets';

/** A block's content element by its path, or null when that block isn't mounted. */
export type BlockElLookup = (path: number[]) => HTMLElement | null;

export function blockContentElAt(root: HTMLElement, path: number[]): HTMLElement | null {
	const box = blockBoxElAt(root, path);
	if (!box?.hasAttribute(VIEW_TEXT_HOST_ATTR)) return box;
	return box.querySelector<HTMLElement>(`[${VIEW_TEXT_ATTR}]`) ?? box;
}

/** The element a block's rect and scroll placement measure, chrome and all. */
export function blockBoxElAt(root: HTMLElement, path: number[]): HTMLElement | null {
	const wrapper = root.querySelector(`[data-block-path='${JSON.stringify(path)}']`);
	if (wrapper) return wrapper.querySelector<HTMLElement>(BLOCK_CONTENT_SELECTOR);
	if (path.length < 3) return null;
	const tablePath = path.slice(0, -2);
	const rowIdx = path[path.length - 2];
	const colIdx = path[path.length - 1];
	const tableWrapper = root.querySelector(`[data-block-path='${JSON.stringify(tablePath)}']`);
	if (!tableWrapper) return null;
	const tableEl = tableWrapper.querySelector(':scope > [role="table"]');
	if (!tableEl) return null;
	const rowEl = tableEl.querySelector(`:scope > [data-table-row-idx='${rowIdx}']`);
	if (!rowEl) return null;
	const cells = rowEl.querySelectorAll(`:scope > ${TABLE_CELL_SELECTOR}`);
	return (cells[colIdx] as HTMLElement | undefined) ?? null;
}

/** The inline widget whose source starts at `start` in the block at `path`, or null when either
 *  isn't mounted. */
export function widgetElAt(root: HTMLElement, path: number[], start: number): HTMLElement | null {
	const block = blockContentElAt(root, path);
	return block ? widgetElByStart(block, start) : null;
}
