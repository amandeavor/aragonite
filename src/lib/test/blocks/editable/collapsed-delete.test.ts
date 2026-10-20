// @vitest-environment jsdom
// Miss-analysis: no route decided a collapsed delete at `beforeinput`, so nothing pinned which ones
// the editor writes and which it hands back to the browser.
import { describe, expect, it } from 'vitest';
import {
	decideCollapsedDelete,
	type CollapsedDeleteReads
} from '#lib/components/blocks/editable/collapsed-delete.js';
import { checkDeleteDecided } from '#lib/invariants/collapsed-delete.js';
import type { DeleteDirection } from '#lib/caret/delete-extent.js';

function input(inputType: string, init: Partial<InputEventInit> = {}): InputEvent {
	return new InputEvent('beforeinput', { inputType, cancelable: true, ...init });
}

function reads(overrides: Partial<CollapsedDeleteReads> = {}) {
	const calls: [number, DeleteDirection][] = [];
	const base: CollapsedDeleteReads = {
		composing: () => false,
		caret: () => 3,
		hasRange: () => false,
		text: () => 'abc',
		targetRange: () => null,
		deleteAtCaret: (caret, direction) => {
			calls.push([caret, direction]);
			return true;
		},
		...overrides
	};
	return { base, calls };
}

describe('decideCollapsedDelete: which deletes the editor writes itself', () => {
	it('decides Backspace and Delete at a caret, and keeps the browser out', () => {
		for (const [type, direction] of [
			['deleteContentBackward', 'backward'],
			['deleteContentForward', 'forward']
		] as const) {
			const { base, calls } = reads();
			const e = input(type);
			expect(decideCollapsedDelete(e, true, base)).toEqual({ decided: true });
			expect(e.defaultPrevented).toBe(true);
			expect(calls).toEqual([[3, direction]]);
		}
	});

	it('is no verdict at all for an input it never decides', () => {
		for (const type of ['insertText', 'deleteWordBackward', 'deleteByCut', 'deleteContent']) {
			expect(decideCollapsedDelete(input(type), true, reads().base)).toBeNull();
		}
	});

	const declines: [string, InputEvent, Partial<CollapsedDeleteReads>, boolean][] = [
		['composing', input('deleteContentBackward', { isComposing: true }), {}, true],
		['composing', input('deleteContentBackward'), { composing: () => true }, true],
		['not-cancelable', input('deleteContentBackward', { cancelable: false }), {}, true],
		['range', input('deleteContentBackward'), { hasRange: () => true }, true],
		['no-caret', input('deleteContentBackward'), { caret: () => null }, true],
		// A soft keyboard deleting an autocorrected word: the keyboard's own edit.
		[
			'wide-keyless',
			input('deleteContentBackward'),
			{ targetRange: () => ({ start: 0, end: 3 }) },
			false
		],
		['surface', input('deleteContentBackward'), { deleteAtCaret: () => false }, true],
		['surface', input('deleteContentBackward'), { deleteAtCaret: undefined }, true]
	];
	for (const [decline, e, overrides, keyed] of declines) {
		it(`declines to the browser: ${decline}`, () => {
			const { base, calls } = reads(overrides);
			expect(decideCollapsedDelete(e, keyed, base)).toEqual({ decided: false, decline });
			expect(e.defaultPrevented).toBe(false);
			if (decline !== 'surface') expect(calls).toHaveLength(0);
		});
	}

	it('takes a keyed delete whatever the browser says it would take', () => {
		const { base } = reads({ targetRange: () => ({ start: 0, end: 3 }) });
		expect(decideCollapsedDelete(input('deleteContentBackward'), true, base)).toEqual({
			decided: true
		});
	});

	it('takes a keyless delete the browser names one character for', () => {
		const { base } = reads({ targetRange: () => ({ start: 2, end: 3 }) });
		expect(decideCollapsedDelete(input('deleteContentBackward'), false, base)).toEqual({
			decided: true
		});
	});
});

describe('G1.132 checkDeleteDecided: no delete the editor decides reaches input undecided', () => {
	it('passes a declined delete and any input the editor never decides', () => {
		const declined = { decided: false, decline: 'composing' } as const;
		expect(checkDeleteDecided('deleteContentBackward', declined)).toBeNull();
		expect(checkDeleteDecided('insertText', null)).toBeNull();
		expect(checkDeleteDecided('deleteWordBackward', null)).toBeNull();
	});

	it('fails a delete no delete step saw, and one the browser ran after the editor wrote it', () => {
		expect(checkDeleteDecided('deleteContentBackward', null)?.code).toBe('delete-never-decided');
		expect(checkDeleteDecided('deleteContentForward', { decided: true })?.code).toBe(
			'delete-not-prevented'
		);
	});
});
