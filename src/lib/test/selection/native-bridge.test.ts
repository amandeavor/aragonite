// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import {
	applyCollapsedCaret,
	applySingleBlockRange,
	holdsNativeRange,
	nativeRangeIn,
	rawSelectionIn,
	readCurrentSelection,
	readNativeSelection,
	applySelectionToDom
} from '../../selection/native-bridge';
import { createSelectionState } from '../../selection/selection-state.svelte';
import { parse } from '../../core/parser';
import { stubBlockComponent } from '../harness/editor-actions';
import { restoreTarget } from '../harness/restore-landing';
import { selectWidgetWhole } from '../../selection/place-caret';
import { testCaretWriter } from '#lib/test/harness/caret-writer.js';

describe('readCurrentSelection: unfocused editor', () => {
	it('returns null when no block reports a cursor (does not clamp to block 0 offset 0)', () => {
		const selectionState = createSelectionState();
		const blockRefs = [
			stubBlockComponent({ getCursorOffset: () => null }),
			stubBlockComponent({ getCursorOffset: () => null }),
			stubBlockComponent({ getCursorOffset: () => null })
		];

		const result = readCurrentSelection(selectionState, blockRefs);

		expect(result).toBeNull();
	});

	it('returns the focused block caret when exactly one block reports an offset', () => {
		const selectionState = createSelectionState();
		const blockRefs = [
			stubBlockComponent({ getCursorOffset: () => null }),
			stubBlockComponent({ getCursorOffset: () => 7 }),
			stubBlockComponent({ getCursorOffset: () => null })
		];
		const result = readCurrentSelection(selectionState, blockRefs);
		expect(result).toEqual({
			anchor: { path: [1], offset: 7 },
			focus: { path: [1], offset: 7 }
		});
	});
});

// Miss-analysis: only the undo capture was tested with a selected image, never the public read.
describe('readCurrentSelection: an image selected whole', () => {
	it("answers the image's edge, not the caret a block reports", () => {
		const imageEnd = { path: [0], offset: 41 };
		const blockRefs = [stubBlockComponent({ getCursorOffset: () => 0 })];
		const selection = createSelectionState({ widgetSpan: () => ({ start: 30, end: 41 }) });
		selectWidgetWhole(selection, testCaretWriter, {
			paragraphPath: [0],
			sourceStart: 30,
			preSelectOffset: 41
		});

		const result = readCurrentSelection(selection, blockRefs);

		expect(result).toEqual({ anchor: imageEnd, focus: imageEnd });
	});
});

describe('undo selection snapshots: cellCoordinate round-trip', () => {
	const TABLE_LAST = 'para\n\n| A | B |\n| --- | --- |\n| 1 | 2 |\n';

	it('readCurrentSelection preserves the flag on cross-block table endpoints', () => {
		const doc = parse(TABLE_LAST);
		const s = createSelectionState({ getDoc: () => doc });
		s.enterCrossBlock({ path: [0], offset: 1 }, { path: [1], offset: 2, cellCoordinate: true });

		const snap = readCurrentSelection(s, []);

		expect(snap?.focus).toEqual({ path: [1], offset: 2, cellCoordinate: true });
		expect(snap?.anchor).toEqual({ path: [0], offset: 1 });
	});

	it('applySelectionToDom restores a table endpoint that still row-snaps', () => {
		const doc = parse(TABLE_LAST);
		const s = createSelectionState({ getDoc: () => doc });
		s.enterCrossBlock({ path: [0], offset: 1 }, { path: [1], offset: 2, cellCoordinate: true });
		const snap = readCurrentSelection(s, [])!;

		const restored = createSelectionState({ getDoc: () => doc });
		applySelectionToDom(
			snap,
			restoreTarget(restored, () => null)
		);

		expect(restored.focus?.cellCoordinate).toBe(true);
		// The whole-row snap keys on the flag: the end endpoint snaps to the
		// row's last cell. A dropped flag skips the snap and leaves offset 2.
		expect(restored.end?.offset).toBe(3);
	});
});

// Miss-analysis: GH #111; the clamp sat at one caller, and no test observed `applyCollapsedCaret`.
describe('applyCollapsedCaret: the reachable clamp lives in the one writer', () => {
	afterEach(() => document.body.replaceChildren());

	function mountBlock(mode?: string): { block: HTMLElement; marker: HTMLElement; content: Text } {
		const root = document.createElement('div');
		if (mode) root.setAttribute('data-presentation', mode);
		const block = document.createElement('div');
		block.setAttribute('contenteditable', 'true');
		const marker = document.createElement('span');
		marker.className = 'md-marker';
		marker.textContent = '**';
		const content = document.createTextNode('bold tail');
		block.append(marker, content);
		root.appendChild(block);
		document.body.appendChild(root);
		return { block, marker, content };
	}

	it('a collapsed caret at raw 0 lands beside a hidden leading run, never behind it', () => {
		const { block, content } = mountBlock('live');
		applyCollapsedCaret(testCaretWriter, block, { path: [0], offset: 0 });

		const sel = window.getSelection()!;
		expect(sel.anchorNode).toBe(content);
		expect(sel.anchorOffset).toBe(0);
	});

	it('source mode is identity: the same offset stays on the painted marker', () => {
		const { marker } = mountBlock(undefined);
		applyCollapsedCaret(testCaretWriter, marker.parentElement as HTMLElement, {
			path: [0],
			offset: 0
		});

		expect(window.getSelection()!.anchorNode).toBe(marker.firstChild);
		expect(window.getSelection()!.anchorOffset).toBe(0);
	});
});

describe('applySelectionToDom: restore routing', () => {
	const TABLE_ONLY = '| A | B |\n| --- | --- |\n| 1 | 2 |\n';

	it('single-block-range restore fires one onChange and never enters cross-block', () => {
		const doc = parse('paragraph one\n');
		let onChangeCount = 0;
		let sawCrossBlock = false;
		const s = createSelectionState({
			getDoc: () => doc,
			onChange: () => {
				onChangeCount++;
				if (s.isCrossBlock) sawCrossBlock = true;
			}
		});

		applySelectionToDom(
			{ anchor: { path: [0], offset: 0 }, focus: { path: [0], offset: 5 } },
			restoreTarget(s, () => null)
		);

		expect(onChangeCount).toBe(1);
		expect(sawCrossBlock).toBe(false);
		expect(s.isCrossBlock).toBe(false);
	});

	// A backward snapshot keeps its direction on restore; a range built from its two ends in
	// order would collapse to a caret at the focus.
	it('restores a backward single-block range with the anchor after the focus', () => {
		const doc = parse('paragraph one\n');
		const s = createSelectionState({ getDoc: () => doc });
		const block = document.createElement('div');
		block.setAttribute('contenteditable', 'true');
		const content = document.createTextNode('paragraph one');
		block.appendChild(content);
		document.body.appendChild(block);
		// Focused first: jsdom's focus() on an editing host resets the selection, which a browser
		// only does when the selection sits outside the host.
		block.focus();

		const placed = applySelectionToDom(
			{ anchor: { path: [0], offset: 9 }, focus: { path: [0], offset: 3 } },
			restoreTarget(s, () => block)
		);

		const sel = window.getSelection()!;
		expect(placed).toBe(true);
		expect(sel.anchorNode).toBe(content);
		expect(sel.anchorOffset).toBe(9);
		expect(sel.focusNode).toBe(content);
		expect(sel.focusOffset).toBe(3);
		document.body.replaceChildren();
	});

	// Miss-analysis: the backward case above had no marker span, so none began at raw 0 behind one.
	it('keeps a backward range backward when it starts at raw 0 behind a marker span', () => {
		const block = document.createElement('div');
		block.setAttribute('contenteditable', 'true');
		const marker = document.createElement('span');
		marker.className = 'md-marker';
		marker.setAttribute('contenteditable', 'false');
		marker.textContent = '- ';
		const content = document.createTextNode('before pic after');
		block.append(marker, content);
		document.body.appendChild(block);
		block.focus();

		applySingleBlockRange(testCaretWriter, block, 10, 0);

		const sel = window.getSelection()!;
		expect(sel.anchorNode === content && sel.focusNode === content).toBe(true);
		expect({ anchor: sel.anchorOffset, focus: sel.focusOffset }).toEqual({ anchor: 10, focus: 0 });
		document.body.replaceChildren();
	});

	it('puts the caret the restore caret in the focus cell for an intra-table rect', () => {
		const doc = parse(TABLE_ONLY);
		const s = createSelectionState({ getDoc: () => doc });
		const requested: number[][] = [];

		applySelectionToDom(
			// A bare focus on the table path, cell index 3, which the state flags as it stores it.
			{ anchor: { path: [0], offset: 0, cellCoordinate: true }, focus: { path: [0], offset: 3 } },
			restoreTarget(s, (p) => {
				requested.push(p);
				return document.createElement('div');
			})
		);

		// Cell index 3 in a 2-column table is row 1, col 1: the caret goes in that cell, not at a
		// character offset on the table wrapper path [0].
		expect(requested).toEqual([[0, 1, 1]]);
	});

	// Miss-analysis: table restores were only tested cross-block, never as a collapsed cell caret.
	it('lands a collapsed cell selection in the cell, not at a char offset on the table', () => {
		const doc = parse(TABLE_ONLY);
		const s = createSelectionState({ getDoc: () => doc });
		const requested: number[][] = [];
		// What `getSelection()` reports for a caret in the last cell, and what a consumer replays
		// through `setSelection`.
		const stored = { path: [0], offset: 3, cellCoordinate: true as const };

		applySelectionToDom(
			{ anchor: stored, focus: { ...stored } },
			restoreTarget(s, (p) => {
				requested.push(p);
				return document.createElement('div');
			})
		);

		expect(requested).toEqual([[0, 1, 1]]);
		expect(s.isCrossBlock).toBe(false);
	});
});

describe('the live selection readers', () => {
	beforeEach(() => window.getSelection()?.removeAllRanges());
	afterEach(() => {
		window.getSelection()?.removeAllRanges();
		document.body.replaceChildren();
	});

	/** Two blocks of text: `ab` in the first, `cd` in the second. */
	function twoBlocks(): { first: HTMLElement; second: HTMLElement; a: Text; c: Text } {
		const first = document.createElement('div');
		const second = document.createElement('div');
		first.textContent = 'ab';
		second.textContent = 'cd';
		document.body.append(first, second);
		return { first, second, a: first.firstChild as Text, c: second.firstChild as Text };
	}

	function select(anchor: Node, anchorOffset: number, focus: Node, focusOffset: number): void {
		window.getSelection()!.setBaseAndExtent(anchor, anchorOffset, focus, focusOffset);
	}

	it('read null when the browser holds no range', () => {
		const { first } = twoBlocks();
		expect(readNativeSelection()).toBeNull();
		expect(rawSelectionIn(first)).toBeNull();
		expect(holdsNativeRange()).toBe(false);
		expect(nativeRangeIn(first)).toBe(false);
	});

	it('reads an end outside the element as null, not as no selection', () => {
		const { first, second, a, c } = twoBlocks();
		select(c, 1, c, 1);
		expect(rawSelectionIn(first)).toEqual({ start: null, end: null, collapsed: true });
		select(a, 1, c, 1);
		expect(rawSelectionIn(first)).toEqual({ start: 1, end: null, collapsed: false });
		expect(rawSelectionIn(second)).toEqual({ start: null, end: 1, collapsed: false });
	});

	it('reads a backward range in document order, as the range runs', () => {
		const { first, a } = twoBlocks();
		select(a, 2, a, 0);
		expect(rawSelectionIn(first)).toEqual({ start: 0, end: 2, collapsed: false });
		expect(readNativeSelection()).toMatchObject({
			anchor: { node: a, offset: 2 },
			focus: { node: a, offset: 0 },
			collapsed: false
		});
	});

	it('reads ends held at element offsets as the text around them', () => {
		const { first, second } = twoBlocks();
		select(first, 0, first, 1);
		expect(rawSelectionIn(first)).toEqual({ start: 0, end: 2, collapsed: false });
		select(first, 1, second, 0);
		expect(rawSelectionIn(second)).toEqual({ start: null, end: 0, collapsed: false });
	});

	it('reads a caret as one offset at both ends', () => {
		const { first, a } = twoBlocks();
		select(a, 1, a, 1);
		expect(rawSelectionIn(first)).toEqual({ start: 1, end: 1, collapsed: true });
		expect(holdsNativeRange()).toBe(false);
	});

	it('scopes a held range by where its anchor sits, and holds one anywhere in the document', () => {
		const { first, second, a, c } = twoBlocks();
		select(a, 1, c, 1);
		expect(holdsNativeRange()).toBe(true);
		expect(nativeRangeIn(first)).toBe(true);
		expect(nativeRangeIn(second)).toBe(false);
	});
});
