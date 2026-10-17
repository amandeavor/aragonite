import { test, expect } from '../../fixtures';
import { EditorPage } from '../../editor-page';

// A caret right after a `\n` is on the next line for every vertical move: a column landing in a
// block whose line starts after one, and the edge-line check at such a line start. Code blocks
// have their own rows (code-block-entry.spec.ts). Requirements:
// e2e/requirements/sticky-column/line-start-entry.md.

const PARAGRAPH = 'a'.repeat(30);
const BODY = 'b'.repeat(30);

test.describe('sticky column: a line that starts after a line break', () => {
	test('ArrowUp at column 0 into an HTML block lands at its last line’s start', async ({
		page
	}) => {
		const editor = new EditorPage(page);
		await editor.goto();
		await editor.setPresentationMode('source');
		const html = `<div>\n${BODY}\n</div>`;
		await editor.loadContent(`${PARAGRAPH}\n\n${html}\n\n${PARAGRAPH}\n`);
		await editor.getBlock(2).click();
		await page.keyboard.press('Home');

		await page.keyboard.press('ArrowUp');
		await editor.waitForRenderFlush();

		const landed = await editor.bridge.getSelectionPaths();
		expect(landed?.focus).toEqual({ path: [1], offset: html.length - '</div>'.length });
	});

	test('ArrowUp at the start of a paragraph’s second line stays in the paragraph', async ({
		page
	}) => {
		const editor = new EditorPage(page);
		await editor.goto();
		await editor.loadContent(`${PARAGRAPH}\n\nabc\nxyz\n`);
		await editor.focusBlockStart(1);
		await page.keyboard.press('ArrowDown');
		await page.keyboard.press('Home');
		expect((await editor.bridge.getSelectionPaths())?.focus).toEqual({ path: [1], offset: 4 });

		await page.keyboard.press('ArrowUp');
		await editor.waitForRenderFlush();

		expect((await editor.bridge.getSelectionPaths())?.focus).toEqual({ path: [1], offset: 0 });
	});
});
