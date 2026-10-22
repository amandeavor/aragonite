import { test, expect } from '../../fixtures';
import type { Page } from '@playwright/test';
import { EditorPage } from '../../editor-page';
import { textRunCenter, textRunStart } from '../../text-runs';
import { multiClick } from '../../multi-click';
import { dragSelection } from '../../selection-drag';
import { edgeKey, extendKey } from '../../platform-keys';

// Erasing a setext heading's title takes its underline with it: an underline under nothing would
// show up as a block of its own (`requirements/text-editing/erase-setext-title.md`).

async function open(page: Page, mode: 'source' | 'live', doc: string): Promise<EditorPage> {
	const ep = new EditorPage(page);
	await ep.goto(mode === 'live' ? '?presentationMode=live' : '');
	await ep.loadContent(doc);
	return ep;
}

// Polled rather than waited on, so a red prints the bytes the editor wrote.
const expectSource = (ep: EditorPage, expected: string) =>
	expect.poll(() => ep.bridge.getSource(), { timeout: 5000 }).toBe(expected);

async function kinds(ep: EditorPage): Promise<string[]> {
	const count = await ep.bridge.getBlockCount();
	return Promise.all(Array.from({ length: count }, (_, i) => ep.bridge.getBlockKind(i)));
}

async function caret(ep: EditorPage) {
	const focus = (await ep.bridge.getSelectionPaths())?.focus;
	return focus && { path: focus.path, offset: focus.offset };
}

async function backspace(page: Page, times: number): Promise<void> {
	for (let i = 0; i < times; i++) await page.keyboard.press('Backspace');
}

/** Every write that can empty the title, each reaching the source by its own route. */
const ERASES: {
	name: string;
	erase: (ep: EditorPage, page: Page) => Promise<void>;
	source: string;
	kinds: string[];
	caretPath?: number[];
	caretOffset: number;
}[] = [
	{
		name: 'Backspace from the title end',
		erase: async (_ep, page) => {
			await page.keyboard.press(edgeKey('lineEnd'));
			await backspace(page, 4);
		},
		source: '\nnext\n',
		kinds: ['paragraph', 'paragraph'],
		caretOffset: 0
	},
	{
		name: 'a range from the title start into the next block, then Backspace',
		erase: async (ep, page) => {
			await page.keyboard.press(edgeKey('lineStart'));
			await ep.shiftClickBlock([1], 4);
			await page.keyboard.press('Backspace');
		},
		source: '\n',
		kinds: ['paragraph'],
		caretOffset: 0
	},
	{
		name: 'Ctrl+X over the whole title',
		erase: async (_ep, page) => {
			await page.keyboard.press(edgeKey('lineEnd'));
			await page.keyboard.press(extendKey('lineStart'));
			await page.keyboard.press('ControlOrMeta+x');
		},
		source: '\nnext\n',
		kinds: ['paragraph', 'paragraph'],
		caretOffset: 0
	},
	{
		name: 'a space pasted over the whole title',
		erase: async (ep, page) => {
			await ep.seedClipboard(' ');
			await page.keyboard.press(edgeKey('lineEnd'));
			await page.keyboard.press(extendKey('lineStart'));
			await ep.paste();
		},
		source: ' \nnext\n',
		kinds: ['paragraph', 'paragraph'],
		caretOffset: 1
	},
	{
		name: 'the whole title dragged to the start of the next line',
		erase: async (_ep, page) => {
			const title = await textRunCenter(page, 'Plan');
			await multiClick(page, title, 2);
			await dragSelection(page, title, await textRunStart(page, 'next'));
		},
		source: '\nPlannext\n',
		kinds: ['paragraph', 'paragraph'],
		caretPath: [1],
		caretOffset: 4
	}
];

for (const mode of ['source', 'live'] as const) {
	test.describe(`${mode} mode: erasing a setext title`, () => {
		for (const { name, erase, source, kinds: left, caretPath, caretOffset } of ERASES) {
			test(`${name} leaves no divider, and one undo restores the title`, async ({ page }) => {
				const ep = await open(page, mode, 'Plan\n---\n\nnext\n');
				await ep.clickBlockAtPath([0], 1);
				await erase(ep, page);

				await expect.poll(() => kinds(ep)).toEqual(left);
				await expectSource(ep, source);
				expect(await caret(ep)).toEqual({ path: caretPath ?? [0], offset: caretOffset });

				await ep.undo();
				await expectSource(ep, 'Plan\n---\n\nnext\n');
				expect(await ep.bridge.getBlockKind(0)).toBe('setextHeading');
			});
		}

		test('the last line of a two-line title leaves a paragraph and no rule', async ({ page }) => {
			const ep = await open(page, mode, 'Plan\nmore\n---\n');
			await ep.clickBlockAtPath([0], 7);
			await page.keyboard.press(edgeKey('lineEnd'));
			await backspace(page, 4);

			await expect.poll(() => kinds(ep)).toEqual(['paragraph']);
			await expectSource(ep, 'Plan\n\n');
		});
	});
}
