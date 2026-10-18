// @vitest-environment jsdom
// Miss-analysis: every shown-text copy ran on Chromium, whose selection string is LF and leaves out an empty block's `<br>`.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { writeShownSelection } from '#lib/components/blocks/editable/clipboard-step.js';
import { makeSurface } from '#lib/test/harness/editable-surface.js';

/** Selects `[start, end)` of `container`'s children; `engineText` is what the browser's selection
 *  string reads, which jsdom can't produce for a `<br>`. */
function select(container: Node, start: number, end: number, engineText?: string): void {
	const range = document.createRange();
	range.setStart(container, start);
	range.setEnd(container, end);
	const selection = window.getSelection()!;
	selection.removeAllRanges();
	selection.addRange(range);
	if (engineText !== undefined) vi.spyOn(selection, 'toString').mockReturnValue(engineText);
}

function editable(html: string): HTMLElement {
	const el = document.createElement('div');
	el.setAttribute('contenteditable', 'true');
	el.innerHTML = html;
	document.body.append(el);
	return el;
}

// Each route that reads the shown selection, read the way its caller reads it.
const ROUTES: Record<string, () => string> = {
	'a copy of what the user sees': () => {
		const written = new Map<string, string>();
		const e = { clipboardData: { setData: (t: string, v: string) => written.set(t, v) } };
		writeShownSelection(e as unknown as ClipboardEvent);
		return written.get('text/plain') ?? '';
	},
	'a block’s getSelectedText': () => makeSurface().surface.surface.getSelectedText()
};

describe('the shown text of a selection', () => {
	afterEach(() => {
		vi.restoreAllMocks();
		document.body.replaceChildren();
	});

	for (const [route, read] of Object.entries(ROUTES)) {
		it(`${route} reads CRLF line breaks as LF`, () => {
			const el = editable('');
			el.append(document.createTextNode('```\r\n1\r\n```'));
			select(el, 0, 1);
			expect(read()).toBe('```\n1\n```');
		});

		it(`${route} reads an empty block’s placeholder break as nothing`, () => {
			const el = editable('<br>');
			select(el, 0, 1, '\r\n');
			expect(read()).toBe('');
		});

		it(`${route} keeps a break after text, which is no placeholder`, () => {
			const el = editable('a<br>');
			select(el, 0, 2, 'a\r\n');
			expect(read()).toBe('a\n');
		});
	}
});
