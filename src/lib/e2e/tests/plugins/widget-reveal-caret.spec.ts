import { test, expect } from '../../fixtures';
import type { PresentationMode } from '../../../presentation-mode';
import { PluginsPage, capturedErrors } from './helpers';

/**
 * Typing a widget's opening byte in front of its body, for every widget kind that can show its
 * source: the caret stays one past the typed byte with the source shown, and a key that stops the
 * source reading as its widget writes at once (`#` then Space makes a heading while you watch).
 * Requirements: e2e/requirements/plugins/widget-reveal-caret.md.
 */

interface KindRow {
	kind: string;
	seed: string | undefined;
	doc: string;
	at: number;
	key: string;
	/** The source the typed byte completes, starting at `at`. */
	source: string;
}

// Every kind registered with `revealSource` and no content span; G4.211's scan holds this list
// to the registrations.
const KINDS: KindRow[] = [
	{
		kind: 'harness-tag',
		seed: 'tags',
		doc: 'few words here\n',
		at: 0,
		key: 'Shift+Digit3',
		source: '#few'
	},
	{
		kind: 'footnote-ref',
		seed: 'footnotes',
		doc: 'Ref ^a] here.\n\n[^a]: Body.\n',
		at: 4,
		key: 'BracketLeft',
		source: '[^a]'
	},
	{
		kind: 'harness-wikilink',
		seed: 'wikilinks',
		doc: 'See [Meeting notes]] today\n',
		at: 4,
		key: 'BracketLeft',
		source: '[[Meeting notes]]'
	},
	{
		kind: 'directiveText',
		seed: undefined,
		doc: 'see abbr[HTML] here\n',
		at: 4,
		key: 'Shift+Semicolon',
		source: ':abbr[HTML]'
	}
];

const MODES: PresentationMode[] = ['source', 'live'];

/** The caret as the editor reads it: the block path and the raw offset. */
async function caret(editor: PluginsPage) {
	await editor.waitForRenderFlush();
	return (await editor.bridge.getSelectionPaths())?.focus;
}

/** How many rendered widgets the top-level block at `index` holds; a shown source is not one. */
function widgetsIn(editor: PluginsPage, index: number): Promise<number> {
	return editor.page.evaluate(
		(i) => document.querySelectorAll(`[data-block-path='[${i}]'] [data-inline-widget]`).length,
		index
	);
}

async function open(
	editor: PluginsPage,
	seed: string | undefined,
	doc: string,
	mode: PresentationMode
) {
	await editor.gotoPlugins(seed);
	await editor.loadContent(doc);
	await editor.setPresentationMode(mode);
}

test.describe('a caret typed into a widget that can show its source', () => {
	for (const row of KINDS) {
		for (const mode of MODES) {
			test(`${row.kind} (${mode}): the opening byte keeps the caret one past it, source shown`, async ({
				page
			}) => {
				const editor = new PluginsPage(page);
				await open(editor, row.seed, row.doc, mode);
				await editor.focusBlock(0, row.at);
				await page.keyboard.press(row.key);

				expect(await caret(editor)).toEqual({ path: [0], offset: row.at + 1 });
				expect((await editor.bridge.getSource()).slice(row.at)).toMatch(
					new RegExp(`^${row.source.replace(/[[\]^]/g, '\\$&')}`)
				);
				// Read again after things settle: a source that closes itself shows only for a moment.
				await editor.waitForRenderFlush();
				expect(await widgetsIn(editor, 0)).toBe(0);
				await expect(page.locator("[data-block-path='[0]'] [contenteditable]")).toContainText(
					row.source
				);
				expect(await capturedErrors(page)).toEqual([]);
			});
		}
	}

	test('tags: Backspace that turns a heading back into a tag keeps the caret inside it', async ({
		page
	}) => {
		const editor = new PluginsPage(page);
		await open(editor, 'tags', '# few words here\n\nOther\n', 'source');
		await editor.focusBlock(0, 2);
		await page.keyboard.press('Backspace');

		expect(await editor.bridge.getSource()).toBe('#few words here\n\nOther\n');
		expect(await editor.bridge.getBlockKind(0)).toBe('paragraph');
		expect(await caret(editor)).toEqual({ path: [0], offset: 1 });
		await editor.waitForRenderFlush();
		expect(await widgetsIn(editor, 0)).toBe(0);
		expect(await capturedErrors(page)).toEqual([]);
	});

	test('tags in a table cell: # keeps the caret one past it, source shown', async ({ page }) => {
		const editor = new PluginsPage(page);
		await open(editor, 'tags', '| A | B |\n| --- | --- |\n| few | ok |\n', 'source');
		await editor.focusBlockAtPath([0, 1, 0], 0);
		await page.keyboard.press('Shift+Digit3');
		expect((await caret(editor))?.offset).toBe(1);
		expect(await widgetsIn(editor, 0)).toBe(0);
		expect(await capturedErrors(page)).toEqual([]);
	});
});
