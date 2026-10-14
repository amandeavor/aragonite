// @vitest-environment jsdom
// Miss-analysis: every hook test installed its hook at mount and never swapped it, so the blocks'
// copy taken at their own mount went unseen.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { flushSync } from 'svelte';
import {
	destroyMountedEditors,
	installLayoutStubs,
	mountEditor,
	placeCaret,
	surfaceAt,
	type MountedEditor
} from '#lib/test/harness/mount-editor.svelte.js';
import { CODE_MENU_LABEL, CODE_RUN_LABEL } from '#lib/a11y-strings.js';
import type { CodeMenuItem, PasteImageHook } from '#lib/editor-keys.js';

installLayoutStubs();
afterEach(destroyMountedEditors);

const FENCE = '```js\nx\n```\n';

function railButton(editor: MountedEditor, label: string): HTMLButtonElement | null {
	return editor.target.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
}

/** A paste carrying one image file, sent to `el`; jsdom has no DataTransfer. */
function pasteImage(el: HTMLElement): void {
	const e = new Event('paste', { bubbles: true, cancelable: true });
	const files = [new File([new Uint8Array([137, 80])], 'shot.png', { type: 'image/png' })];
	const clipboardData = { types: ['Files'], files, items: [], getData: () => '' };
	Object.defineProperty(e, 'clipboardData', { value: clipboardData });
	el.dispatchEvent(e);
}

async function swap(editor: MountedEditor, write: () => void): Promise<void> {
	write();
	flushSync();
	await editor.settle();
}

describe('a host hook swapped after mount', () => {
	it('runs the newest onRunCode in a code block built before the swap', async () => {
		const first = vi.fn();
		const newest = vi.fn();
		const editor = mountEditor({ source: FENCE, presentationMode: 'live', onRunCode: first });
		await editor.settle();

		await swap(editor, () => (editor.props.onRunCode = newest));
		railButton(editor, CODE_RUN_LABEL)!.click();
		flushSync();

		expect([first.mock.calls.length, newest.mock.calls.length]).toEqual([0, 1]);
	});

	it('asks the newest codeMenuItems when a built block opens its menu', async () => {
		const items: CodeMenuItem[] = [{ id: 'a', label: 'A', run: () => {} }];
		const first = vi.fn(() => items);
		const newest = vi.fn(() => items);
		const editor = mountEditor({ source: FENCE, presentationMode: 'live', codeMenuItems: first });
		await editor.settle();

		await swap(editor, () => (editor.props.codeMenuItems = newest));
		railButton(editor, CODE_MENU_LABEL)!.click();
		flushSync();

		expect([first.mock.calls.length, newest.mock.calls.length]).toEqual([0, 1]);
	});

	it.each([
		{ block: 'a paragraph', source: 'hello\n', path: [0] },
		{ block: 'a code block', source: FENCE, path: [0] },
		{ block: 'a table cell', source: '| a |\n| - |\n| b |\n', path: [0] }
	])('hands an image paste in $block to the newest onPasteImage', async ({ source, path }) => {
		const first = vi.fn<PasteImageHook>(async () => null);
		const newest = vi.fn<PasteImageHook>(async () => null);
		const editor = mountEditor({ source, onPasteImage: first });
		await editor.settle();

		await swap(editor, () => (editor.props.onPasteImage = newest));
		const el = surfaceAt(editor, path);
		placeCaret(el, 0);
		pasteImage(el);
		await editor.settle();

		expect([first.mock.calls.length, newest.mock.calls.length]).toEqual([0, 1]);
	});

	it('hands an image paste over a range across blocks to the newest onPasteImage', async () => {
		const first = vi.fn<PasteImageHook>(async () => null);
		const newest = vi.fn<PasteImageHook>(async () => null);
		const editor = mountEditor({ source: 'hello\n\nworld\n', onPasteImage: first });
		await editor.settle();

		await swap(editor, () => (editor.props.onPasteImage = newest));
		await editor.instance.setSelection({
			anchor: { path: [0], offset: 1 },
			focus: { path: [1], offset: 2 }
		});
		pasteImage(editor.target.querySelector<HTMLElement>('.editor')!);
		await editor.settle();

		expect([first.mock.calls.length, newest.mock.calls.length]).toEqual([0, 1]);
	});
});

describe('a host hook added or removed after mount', () => {
	it('shows and hides the run button on a code block built before the change', async () => {
		const editor = mountEditor({ source: FENCE, presentationMode: 'live' });
		await editor.settle();
		expect(railButton(editor, CODE_RUN_LABEL)).toBeNull();

		await swap(editor, () => (editor.props.onRunCode = () => {}));
		expect(railButton(editor, CODE_RUN_LABEL)).not.toBeNull();

		await swap(editor, () => (editor.props.onRunCode = undefined));
		expect(railButton(editor, CODE_RUN_LABEL)).toBeNull();
	});
});
