import { test, expect } from '../../fixtures';
import type { Page } from '@playwright/test';
import { EditorPage } from '../../editor-page';
import { PluginsPage } from '../plugins/helpers';
import { addReplaceIsland } from '../../decoration-sources';
import { edgeKey } from '../../platform-keys';

/**
 * A span the caret can't stop inside is crossed in one press, both ways, with and without Shift
 * (`requirements/caret/unit-step.md`). One row per kind of span and per surface that draws one;
 * each starts at the span's near edge and reads the selection after every press.
 */

interface SpanCase {
	name: string;
	open(page: Page): Promise<EditorPage>;
	/** The block the caret is placed in; a table takes its first cell. */
	path: number[];
	start: number;
	end: number;
}

async function editorWith(page: Page, source: string): Promise<EditorPage> {
	const editor = new EditorPage(page);
	await editor.goto();
	await editor.loadContent(source);
	return editor;
}

const CASES: SpanCase[] = [
	{
		name: 'a decoded entity',
		open: (page) => editorWith(page, 'a&copy;b\n'),
		path: [0],
		start: 1,
		end: 7
	},
	{
		name: 'a plugin emoji',
		open: async (page) => {
			const editor = new PluginsPage(page);
			await editor.gotoPlugins('emoji');
			return editor;
		},
		// `Mood :smile: today`
		path: [0],
		start: 5,
		end: 12
	},
	{
		name: 'a replace decoration',
		open: async (page) => {
			const editor = await editorWith(page, 'abHIDDENcd\n');
			await addReplaceIsland(page, [0], 2, 8);
			await expect(page.locator('[data-decoration-island]')).toHaveCount(1);
			return editor;
		},
		path: [0],
		start: 2,
		end: 8
	},
	{
		name: 'an entity in a table cell',
		open: (page) => editorWith(page, '| a&copy;b |\n| --- |\n'),
		path: [0],
		start: 1,
		end: 7
	},
	{
		name: 'a CRLF pair in a paragraph',
		open: (page) => editorWith(page, 'abc\r\nAfter\r\n'),
		path: [0],
		start: 3,
		end: 5
	},
	{
		name: 'a CRLF pair in a code body',
		open: (page) => editorWith(page, '```\r\nabc\r\nxyz\r\n```\r\n'),
		path: [0],
		start: 8,
		end: 10
	}
];

for (const span of CASES) {
	test.describe(`one press crosses ${span.name}`, () => {
		let editor: EditorPage;
		let source: string;

		/** Anchor and focus offsets, after checking both sit in the block the case started in. */
		async function ends(): Promise<[number, number]> {
			const paths = await editor.bridge.getSelectionPaths();
			expect(paths?.anchor.path).toEqual(paths?.focus.path);
			return [paths!.anchor.offset, paths!.focus.offset];
		}

		test.beforeEach(async ({ page }) => {
			editor = await span.open(page);
			source = await editor.bridge.getSource();
			await editor.focusBlockAtPath(span.path, span.start);
			expect(await ends()).toEqual([span.start, span.start]);
		});

		test.afterEach(async () => {
			expect(await editor.bridge.getSource()).toBe(source);
		});

		test('ArrowRight lands at the far edge, ArrowLeft back, and the next step is one character', async ({
			page
		}) => {
			await page.keyboard.press('ArrowRight');
			expect(await ends()).toEqual([span.end, span.end]);
			await page.keyboard.press('ArrowLeft');
			expect(await ends()).toEqual([span.start, span.start]);
			await page.keyboard.press('ArrowRight');
			await page.keyboard.press('ArrowRight');
			expect(await ends()).toEqual([span.end + 1, span.end + 1]);
		});

		test('Shift+ArrowRight extends across it and Shift+ArrowLeft takes it back', async ({
			page
		}) => {
			await page.keyboard.press('Shift+ArrowRight');
			expect(await ends()).toEqual([span.start, span.end]);
			await page.keyboard.press('Shift+ArrowLeft');
			expect(await ends()).toEqual([span.start, span.start]);
		});

		test('Shift+ArrowLeft from the far edge extends back across it', async ({ page }) => {
			await page.keyboard.press('ArrowRight');
			await page.keyboard.press('Shift+ArrowLeft');
			expect(await ends()).toEqual([span.end, span.start]);
		});
	});
}

test.describe('one press crosses a CRLF pair from a caret the browser parked', () => {
	test('End, then Shift+ArrowRight, selects the pair from the line end', async ({ page }) => {
		const editor = await editorWith(page, 'abc\r\nAfter\r\n');
		await editor.focusBlockAtPath([0], 0);
		// WebKit and Firefox park the caret between the `\r` and the `\n` here.
		await page.keyboard.press(edgeKey('lineEnd'));
		await page.keyboard.press('Shift+ArrowRight');
		const paths = await editor.bridge.getSelectionPaths();
		expect([paths?.anchor.offset, paths?.focus.offset]).toEqual([3, 5]);
		await page.keyboard.press('ArrowLeft');
		await page.keyboard.press(edgeKey('lineEnd'));
		await page.keyboard.press('ArrowRight');
		expect((await editor.bridge.getSelectionPaths())?.focus.offset).toBe(5);
	});
});
