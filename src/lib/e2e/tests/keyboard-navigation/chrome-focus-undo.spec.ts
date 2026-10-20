import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../fixtures';
import { PluginsPage } from '../plugins/helpers';
import { clickEnd } from '../presentation/helpers';
import { waitForFirstImageLoaded } from '../blocks/image/helpers';

// With keyboard focus on a button in the editor's own chrome, Mod+Z and Mod+Shift+Z still step the
// editor's history, one entry per press, on every engine.
// Requirements: `requirements/keyboard-navigation/chrome-focus-undo.md`.

interface ChromeKind {
	name: string;
	/** Opens on the line `one`, which the spec types into. */
	doc: string;
	/** The rail draws in the writing modes only. */
	live?: true;
	/** The button, once whatever shows it is up. */
	reach(page: Page): Promise<Locator>;
}

const KINDS: ChromeKind[] = [
	{
		name: 'the trailing insert row',
		doc: 'one\n\ntwo\n',
		reach: async (page) => page.locator('.editor-tail-row')
	},
	{
		name: "a selected image's toolbar",
		doc: 'one\n\n![cat|200x200](/test-fixtures/sample.png)\n',
		reach: async (page) => {
			await waitForFirstImageLoaded(page);
			await page.locator('[data-image-widget]').first().click();
			return page.locator('.md-image-properties').getByRole('button', { name: 'Crop image' });
		}
	},
	{
		name: "a code block's rail",
		doc: 'one\n\n```js\nlet x;\n```\n',
		live: true,
		reach: async (page) => page.locator('.code-lang-button')
	},
	{
		name: "a table's add-row button",
		doc: 'one\n\n| a | b |\n| - | - |\n| c | d |\n',
		reach: async (page) => page.locator('.table-add-row').first()
	},
	{
		name: "a details block's toggle",
		doc: 'one\n\n<details open>\n<summary>Sum</summary>\n\nbody\n\n</details>\n',
		reach: async (page) => page.locator('.details-toggle').first()
	}
];

for (const kind of KINDS) {
	test(`${kind.name}: Mod+Z and Mod+Shift+Z step one edit each with a chrome button focused`, async ({
		page
	}) => {
		const editor = new PluginsPage(page);
		await editor.gotoPlugins();
		await editor.loadContent(kind.doc);
		if (kind.live) await editor.setPresentationMode('live');
		// Two edits, so an undo that ran twice shows.
		await clickEnd(editor, page, 'one');
		await page.keyboard.type('A');
		await editor.bridge.waitForSourceMatches(/^oneA\n/);
		await page.keyboard.press('Enter');
		await editor.bridge.waitForSourceMatches(/^oneA\n\n\n/);
		const twoEdits = await editor.bridge.getSource();
		const button = await kind.reach(page);
		// Where a Tab walk would leave focus; how one gets there differs per kind and per engine.
		await button.focus();
		await expect(button).toBeFocused();
		await editor.undo();
		await editor.bridge.waitForSourceMatches(/^oneA\n/);
		expect(await editor.bridge.getSource()).toBe(kind.doc.replace(/^one/, 'oneA'));
		await editor.redo();
		await editor.bridge.waitForSourceEquals(twoEdits);
	});
}
