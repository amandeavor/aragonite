// @vitest-environment jsdom
// Text typed right before an inline widget that ends the block is the block's own write, in a prose
// block and a table cell alike: Firefox fires the `beforeinput` there and then inserts nothing.
// Miss-analysis: typing beside a widget was tested only with keys Chromium types natively, and the
// e2e driver faked Firefox's input until it fired a real `beforeinput`.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
	destroyMountedEditors,
	installLayoutStubs,
	mountEditor,
	placeCaret,
	surfaceAt
} from '#lib/test/harness/mount-editor.svelte.js';
import { cellAt, installTableLayoutStubs } from '../table/mount-table';

let restoreTableLayout: () => void;
beforeAll(() => {
	installLayoutStubs();
	restoreTableLayout = installTableLayoutStubs();
	return () => restoreTableLayout();
});
afterEach(destroyMountedEditors);

function typeAt(el: HTMLElement, offset: number, data: string): InputEvent {
	placeCaret(el, offset);
	const event = new InputEvent('beforeinput', {
		inputType: 'insertText',
		data,
		bubbles: true,
		cancelable: true
	});
	el.dispatchEvent(event);
	return event;
}

describe.each([
	['a prose block', 'Left<br>\n', 'LeftQ<br>\n'],
	['a table cell', '| H |\n| :- |\n| Left<br> |\n', '| H |\n| :- |\n| LeftQ<br> |\n']
])('%s', (_, source, typed) => {
	const surface = (editor: ReturnType<typeof mountEditor>) =>
		source.startsWith('|') ? cellAt(editor, 1, 0) : surfaceAt(editor, [0]);

	it('writes text typed before the widget that ends it', async () => {
		const editor = mountEditor({ source });
		const event = typeAt(surface(editor), 4, 'Q');
		await editor.settle();

		expect(event.defaultPrevented).toBe(true);
		expect(editor.source()).toBe(typed);
	});

	it('leaves text typed elsewhere to the browser', async () => {
		const editor = mountEditor({ source });
		const event = typeAt(surface(editor), 2, 'Q');
		await editor.settle();

		expect(event.defaultPrevented).toBe(false);
	});
});
