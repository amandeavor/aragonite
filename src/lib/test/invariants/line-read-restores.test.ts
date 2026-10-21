// @vitest-environment jsdom
// G1.141: asking the browser which line a caret at a soft wrap shows on leaves the focus where it was.
// Miss-analysis: no read of the caret's line moved the selection before, so nothing checked one did not.
import { describe, it, expect, afterEach } from 'vitest';
import { checkLineReadRestored } from '../../invariants/line-read-restores';
import { testCaretWriter } from '../harness/caret-writer';
import { takeDevWarns } from '../support/warn-gate';

/** The browser's line motion as jsdom can't run it: each call moves the focus by `steps` in turn. */
function stubModify(sel: Selection, text: Text, steps: number[]): void {
	let call = 0;
	Object.assign(sel, {
		modify: () => {
			const offset = sel.focusOffset + steps[call++];
			sel.collapse(text, offset);
		}
	});
}

describe('G1.141 the line read puts the focus back', () => {
	afterEach(() => {
		document.body.replaceChildren();
		delete (window.getSelection() as unknown as { modify?: unknown }).modify;
	});

	it('names a focus left elsewhere, passes one put back', () => {
		const text = document.createTextNode('hello world');
		expect(checkLineReadRestored({ node: text, offset: 6 }, { node: text, offset: 6 })).toBeNull();
		expect(checkLineReadRestored({ node: text, offset: 6 }, { node: text, offset: 0 })?.code).toBe(
			'line-read-restores-focus'
		);
	});

	it('fires from the caret writer, and the focus still ends where it was', () => {
		const el = document.createElement('div');
		el.textContent = 'hello world';
		document.body.appendChild(el);
		const text = el.firstChild as Text;
		const sel = window.getSelection()!;
		sel.collapse(text, 6);
		// To the line's end, then back short of where the caret was.
		stubModify(sel, text, [5, -6]);
		takeDevWarns();
		expect(testCaretWriter.focusEndsLine()).toBe(false);
		expect(takeDevWarns().map((w) => w.tag)).toContain('invariant:line-read-restores-focus');
		expect([sel.focusNode, sel.focusOffset, sel.isCollapsed]).toEqual([text, 6, true]);
	});

	it('a held range is not asked, and the browser never moves it', () => {
		const el = document.createElement('div');
		el.textContent = 'hello world';
		document.body.appendChild(el);
		const text = el.firstChild as Text;
		const sel = window.getSelection()!;
		sel.setBaseAndExtent(text, 2, text, 6);
		stubModify(sel, text, [5, -5]);
		expect(testCaretWriter.focusEndsLine()).toBeNull();
		expect([sel.anchorOffset, sel.focusOffset]).toEqual([2, 6]);
	});

	it('a read that comes back to the caret fires nothing', () => {
		const el = document.createElement('div');
		el.textContent = 'hello world';
		document.body.appendChild(el);
		const text = el.firstChild as Text;
		const sel = window.getSelection()!;
		sel.collapse(text, 6);
		stubModify(sel, text, [5, -5]);
		takeDevWarns();
		expect(testCaretWriter.focusEndsLine()).toBe(false);
		expect(takeDevWarns()).toEqual([]);
	});
});
