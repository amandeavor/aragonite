// @vitest-environment jsdom
// Miss-analysis: no route decided a collapsed delete at `beforeinput`, so nothing pinned which ones
// the editor writes and which it hands back to the browser.
import { describe, expect, it } from 'vitest';
import {
	decideCollapsedDelete,
	type CollapsedDeleteReads
} from '#lib/components/blocks/editable/collapsed-delete.js';
import { checkDeleteDecided } from '#lib/invariants/collapsed-delete.js';
import type { DeleteIntent } from '#lib/caret/delete-extent.js';

function input(inputType: string, init: Partial<InputEventInit> = {}): InputEvent {
	return new InputEvent('beforeinput', { inputType, cancelable: true, ...init });
}

function reads(overrides: Partial<CollapsedDeleteReads> = {}) {
	const calls: [number, DeleteIntent][] = [];
	const base: CollapsedDeleteReads = {
		composing: () => false,
		caret: () => 3,
		hasRange: () => false,
		text: () => 'abc',
		targetRange: () => null,
		deleteAtCaret: (caret, intent) => {
			calls.push([caret, intent]);
			return 'taken';
		},
		...overrides
	};
	return { base, calls };
}

describe('decideCollapsedDelete: which deletes the editor writes itself', () => {
	it('decides every delete with a side and a unit, and keeps the browser out', () => {
		for (const [type, unit, direction] of [
			['deleteContentBackward', 'character', 'backward'],
			['deleteContentForward', 'character', 'forward'],
			['deleteWordBackward', 'word', 'backward'],
			['deleteSoftLineForward', 'soft-line', 'forward'],
			['deleteHardLineBackward', 'hard-line', 'backward']
		] as const) {
			const { base, calls } = reads();
			const e = input(type);
			expect(decideCollapsedDelete(e, 'Backspace', base)).toEqual({ decided: true });
			expect(e.defaultPrevented).toBe(true);
			expect(calls).toEqual([[3, { unit, direction }]]);
		}
	});

	it('is no verdict at all for an input it never decides', () => {
		for (const type of ['insertText', 'deleteEntireSoftLine', 'deleteByCut', 'deleteContent']) {
			expect(decideCollapsedDelete(input(type), 'Backspace', reads().base)).toBeNull();
		}
	});

	const declines: [string, InputEvent, Partial<CollapsedDeleteReads>, string | null][] = [
		['composing', input('deleteContentBackward', { isComposing: true }), {}, 'Backspace'],
		['composing', input('deleteContentBackward'), { composing: () => true }, 'Backspace'],
		['not-cancelable', input('deleteContentBackward', { cancelable: false }), {}, 'Backspace'],
		['range', input('deleteContentBackward'), { hasRange: () => true }, 'Backspace'],
		['no-caret', input('deleteContentBackward'), { caret: () => null }, 'Backspace'],
		// A soft keyboard deleting an autocorrected word: the keyboard's own edit.
		[
			'wide-keyless',
			input('deleteContentBackward'),
			{ targetRange: () => ({ start: 0, end: 3 }) },
			null
		],
		['surface', input('deleteContentBackward'), { deleteAtCaret: () => 'declined' }, 'Backspace'],
		['surface', input('deleteContentBackward'), { deleteAtCaret: undefined }, 'Backspace']
	];
	for (const [decline, e, overrides, keyed] of declines) {
		it(`declines to the browser: ${decline}`, () => {
			const { base, calls } = reads(overrides);
			expect(decideCollapsedDelete(e, keyed, base)).toEqual({ decided: false, decline });
			expect(e.defaultPrevented).toBe(false);
			if (decline !== 'surface') expect(calls).toHaveLength(0);
		});
	}

	// A word names its own reach, so a soft keyboard's word delete is the editor's whatever its range.
	it('takes a keyless word delete whatever the browser says it would take', () => {
		const { base } = reads({ targetRange: () => ({ start: 0, end: 3 }) });
		expect(decideCollapsedDelete(input('deleteWordBackward'), null, base)).toEqual({
			decided: true
		});
	});

	// Miss-analysis: every edge row pressed the plain key, whose binding runs at keydown, so no row
	// saw a word, line or Shift chord at the edge do nothing.
	describe('at the edge, every delete runs what the plain key binds', () => {
		const atEdge = (keyChord: string | null, inputType: string) => {
			const ran: string[] = [];
			const { base } = reads({
				deleteAtCaret: () => 'at-edge',
				runPlainKey: (key) => void ran.push(key)
			});
			const e = input(inputType);
			expect(decideCollapsedDelete(e, keyChord, base)).toEqual({ decided: true });
			expect(e.defaultPrevented).toBe(true);
			return ran;
		};

		it('a soft keyboard, any unit, either side', () => {
			expect(atEdge(null, 'deleteContentBackward')).toEqual(['Backspace']);
			expect(atEdge(null, 'deleteWordForward')).toEqual(['Delete']);
		});

		it('a chord the keymap left alone: word, line, Shift', () => {
			expect(atEdge('Mod+Backspace', 'deleteWordBackward')).toEqual(['Backspace']);
			expect(atEdge('Alt+Backspace', 'deleteWordBackward')).toEqual(['Backspace']);
			expect(atEdge('Mod+Backspace', 'deleteSoftLineBackward')).toEqual(['Backspace']);
			expect(atEdge('Shift+Backspace', 'deleteContentBackward')).toEqual(['Backspace']);
			expect(atEdge('Mod+Delete', 'deleteWordForward')).toEqual(['Delete']);
			expect(atEdge('Alt+Delete', 'deleteSoftLineForward')).toEqual(['Delete']);
		});

		// Its binding ran at the keydown and declined; a second run would answer it twice.
		it('not the plain key itself', () => {
			expect(atEdge('Backspace', 'deleteContentBackward')).toEqual([]);
			expect(atEdge('Delete', 'deleteContentForward')).toEqual([]);
		});

		it('nothing inside the line, where the delete takes text', () => {
			const ran: string[] = [];
			const { base } = reads({ runPlainKey: (key) => void ran.push(key) });
			decideCollapsedDelete(input('deleteSoftLineBackward'), 'Mod+Backspace', base);
			expect(ran).toEqual([]);
		});
	});

	it('takes a keyed delete whatever the browser says it would take', () => {
		const { base } = reads({ targetRange: () => ({ start: 0, end: 3 }) });
		expect(decideCollapsedDelete(input('deleteContentBackward'), 'Backspace', base)).toEqual({
			decided: true
		});
	});

	it('takes a keyless delete the browser names one character for', () => {
		const { base } = reads({ targetRange: () => ({ start: 2, end: 3 }) });
		expect(decideCollapsedDelete(input('deleteContentBackward'), null, base)).toEqual({
			decided: true
		});
	});
});

describe('G1.132 checkDeleteDecided: no delete the editor decides reaches input undecided', () => {
	it('passes a declined delete and any input the editor never decides', () => {
		const declined = { decided: false, decline: 'composing' } as const;
		expect(checkDeleteDecided('deleteContentBackward', declined)).toBeNull();
		expect(checkDeleteDecided('insertText', null)).toBeNull();
		expect(checkDeleteDecided('deleteEntireSoftLine', null)).toBeNull();
	});

	it('fails a delete no delete step saw, and one the browser ran after the editor wrote it', () => {
		expect(checkDeleteDecided('deleteContentBackward', null)?.code).toBe('delete-never-decided');
		expect(checkDeleteDecided('deleteContentForward', { decided: true })?.code).toBe(
			'delete-not-prevented'
		);
	});
});
