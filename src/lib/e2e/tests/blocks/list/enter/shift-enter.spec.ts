import { test, expect } from '../../../../fixtures';
import { EditorPage } from '../../../../editor-page';

// Shift+Enter inside a list item is a hard break, not a new item: the bytes gain the `\`
// line break and the item paints a second line the next keys land on.
// Requirements: `e2e/requirements/blocks/list/enter/shift-enter.md`.

/** How many lines the element's text paints on: boxes starting within half a line of each other
 *  share one, since the marker's box starts at its line's top and the text's a little below. */
async function paintedLines(editor: EditorPage, selector: string): Promise<number> {
	return editor.page
		.locator(selector)
		.first()
		.evaluate((el) => {
			const range = document.createRange();
			range.selectNodeContents(el);
			const half = parseFloat(getComputedStyle(el).lineHeight) / 2;
			const tops = Array.from(range.getClientRects(), (r) => r.top).sort((a, b) => a - b);
			return tops.filter((top, i) => i === 0 || top - tops[i - 1] >= half).length;
		});
}

test.describe('list item: Shift+Enter', () => {
	let editor: EditorPage;

	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		await editor.goto();
	});

	test('paints a real new line inside the item, and the next keys type on it', async ({ page }) => {
		await editor.loadContent('- item\n');
		await editor.focusBlockAtPath([0, 0, 0], 4);
		await page.keyboard.press('Shift+Enter');
		await page.keyboard.type('more');
		await editor.bridge.waitForSourceContains('more');

		const src = await editor.bridge.getSource();
		expect(src).toMatch(/^- item\\\n\s*more\n$/);
		expect(await editor.bridge.getBlockCount()).toBe(1);
		expect(await paintedLines(editor, '.list-item-block .paragraph-block')).toBe(2);
	});
});
