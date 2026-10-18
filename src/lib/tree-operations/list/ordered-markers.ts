/** List marker bookkeeping: reads, renumbering, and matching item style to a list. */

import type { CstNode } from '../../core/nodes';
import type { NodeView } from '../../core/node-views';
import { metadataOf } from '../../core/nodes';
import type { SharingState } from '../sharing';
import { rebuildListItemRaw } from '../../schema/container-rebuilders';
import { ensureUnsharedChild } from '../unshare';

// ── Marker reads ─────────────────────────────────────────────────────────────

/** Read an item's marker as an integer base, defaulting to 1 for non-numeric markers. */
export function orderedBaseOf(item: NodeView | undefined): number {
	if (!item) return 1;
	const marker = metadataOf(item, 'listItem')?.marker ?? '';
	const n = parseInt(marker, 10);
	return Number.isFinite(n) && n > 0 ? n : 1;
}

/** The punctuation suffix (`. ` or `) `) from a list's first item; defaults to `. `. */
export function readOrderedSuffix(list: NodeView): string {
	const first = list.children?.[0];
	if (!first) return '. ';
	const marker = metadataOf(first, 'listItem')?.marker ?? '1. ';
	return marker.replace(/^\d+/, '') || '. ';
}

/** Whether GFM reads `lower` as continuing `upper`'s list once nothing parts the two items: the
 *  same bullet character, or the same ordered delimiter. A task item is a bullet item. */
export function itemsShareList(upper: NodeView | undefined, lower: NodeView | undefined): boolean {
	const a = markerOf(upper);
	const b = markerOf(lower);
	const ordered = (marker: string) => /^\d/.test(marker);
	return a !== '' && b !== '' && ordered(a) === ordered(b) && a.at(-1) === b.at(-1);
}

const markerOf = (item: NodeView | undefined): string =>
	item ? (metadataOf(item, 'listItem')?.marker ?? '').trimEnd() : '';

// ── Renumbering ──────────────────────────────────────────────────────────────

/** Increment an ordered marker's numeric prefix, preserving its suffix. */
export function bumpOrderedMarker(marker: string): string {
	return marker.replace(/^(\d+)/, (_, n) => String(Number(n) + 1));
}

/** Renumber an ordered list's items from `fromIndex` on. The first item keeps its number, the
 *  list's start; an edit that moves, removes or creates it calls `renumberOrderedListFrom`. */
export function renumberOrderedList(list: CstNode, fromIndex: number, sharing: SharingState): void {
	if (!list.children) return;
	if (!metadataOf(list, 'list')?.ordered) return;
	// Each item's metadata and raw is written, so `ensureUnsharedChild` copies it out of the undo
	// snapshot first.
	for (let j = Math.max(fromIndex, 1); j < list.children.length; j++) {
		const item = ensureUnsharedChild(list, j, sharing);
		const prevNum = parseInt(metadataOf(list.children[j - 1], 'listItem').marker, 10) || 0;
		const meta = metadataOf(item, 'listItem');
		const suffix = meta.marker.replace(/^\d+/, '');
		meta.marker = String(prevNum + 1) + suffix;
		rebuildListItemRaw(item);
	}
}

/** Renumber a whole ordered list from `start`, keeping marker suffixes. A caller reads `start`
 *  before its edit when that edit moves or removes the first item. */
export function renumberOrderedListFrom(list: CstNode, start: number, sharing: SharingState): void {
	if (!metadataOf(list, 'list')?.ordered) return;
	if (!list.children || list.children.length === 0) return;
	const first = ensureUnsharedChild(list, 0, sharing);
	const meta = metadataOf(first, 'listItem');
	meta.marker = String(start) + (meta.marker.replace(/^\d+/, '') || '. ');
	rebuildListItemRaw(first);
	renumberOrderedList(list, 1, sharing);
}

/** Reads an ordered list's numbering before items are removed from it, and returns the renumber
 *  to run after: from the first item the removal shifted, a new first item taking the start. */
export function holdOrderedNumbering(list: CstNode): (sharing: SharingState) => void {
	// A plugin container's metadata can carry its own `ordered` field.
	if (list.kind !== 'list' || !metadataOf(list, 'list')?.ordered || !list.children) {
		return keepNumbering;
	}
	const before = list.children.slice();
	const start = orderedBaseOf(before[0]);
	return (sharing) => {
		const after = list.children ?? [];
		if (after.length >= before.length) return;
		let shifted = 0;
		while (shifted < after.length && after[shifted] === before[shifted]) shifted++;
		if (shifted === after.length) return;
		if (shifted === 0) renumberOrderedListFrom(list, start, sharing);
		else renumberOrderedList(list, shifted, sharing);
	};
}

const keepNumbering = (): void => {};

// ── Style templating ─────────────────────────────────────────────────────────

/**
 * Rewrite `item`'s marker glyph and suffix to match `parentList`'s first item; the number is left
 * to the caller's renumber pass.
 */
export function normalizeItemMarkerToList(item: CstNode, parentList: CstNode): void {
	const parentOrdered = metadataOf(parentList, 'list')?.ordered ?? false;
	const meta = metadataOf(item, 'listItem');
	const itemOrdered = /^\d/.test(meta.marker);

	const siblings = parentList.children ?? [];
	const templateMarker =
		siblings.length > 0 ? metadataOf(siblings[0], 'listItem').marker : undefined;

	let target: string;
	if (parentOrdered) {
		const suffix = templateMarker?.replace(/^\d+/, '');
		target = itemOrdered
			? meta.marker.replace(/\D.*$/, '') + (suffix || '. ')
			: '1' + (suffix ?? '. ');
	} else {
		target = templateMarker ?? '- ';
	}
	target = keepingWidth(target, meta.marker);
	if (meta.marker === target) return;
	meta.marker = target;
	rebuildListItemRaw(item);
}

/** `target`, keeping `current`'s run of spaces when it is the wider one: those spaces are the
 *  item's own bytes, which a reload reads into its marker. */
function keepingWidth(target: string, current: string): string {
	const own = / *$/.exec(current)![0];
	const theirs = / *$/.exec(target)![0];
	return own.length > theirs.length ? target.slice(0, target.length - theirs.length) + own : target;
}

/**
 * Rewrite pasted items' markers to the enclosing list's style before the splice, since `$state`
 * wraps entries lazily and a marker written to an item already spliced would bypass reactivity.
 */
export function templatePastedItemMarkers(
	items: CstNode[],
	outer: CstNode,
	firstIndex: number
): void {
	if (outer.kind !== 'list') return;
	if (metadataOf(outer, 'list')?.ordered) {
		const suffix = readOrderedSuffix(outer);
		const base = orderedBaseOf(outer.children?.[0]);
		items.forEach((item, i) => {
			const meta = metadataOf(item, 'listItem');
			if (!meta) return;
			meta.marker = keepingWidth(String(base + firstIndex + i) + suffix, meta.marker);
			rebuildListItemRaw(item);
		});
	} else {
		for (const item of items) normalizeItemMarkerToList(item, outer);
	}
}
