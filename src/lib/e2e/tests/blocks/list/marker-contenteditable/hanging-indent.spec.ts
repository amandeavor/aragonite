import { test, expect } from '../../../../fixtures';
import { EditorPage } from '../../../../editor-page';

// How the indent lines wrapped text up under the first line is `marker-column.spec.ts`.

test.describe('list marker, hanging indent', () => {
	let editor: EditorPage;

	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		await editor.goto();
	});

	// Source mode shows the bytes, so the indent a to-do reserves has to cover the `- [X] ` drawn
	// there, or the text starts on top of the marker.
	test('a to-do reserves an indent as wide as source mode draws its marker', async () => {
		await editor.loadContent('- [X] note\n');
		// The glyphs' own extent: the marker's box is the indent whatever they measure.
		const glyphs = await editor.page.evaluate(() => {
			const marker = document.querySelector('.list-item-block .md-marker[contenteditable="false"]');
			const range = document.createRange();
			range.selectNodeContents(marker!);
			return range.getBoundingClientRect().width;
		});
		const paddingLeft = await editor.page.evaluate(() => {
			const el = document.querySelector('.list-item-block [contenteditable="true"]');
			return parseFloat(getComputedStyle(el as HTMLElement).paddingLeft);
		});

		expect(paddingLeft).toBeGreaterThanOrEqual(glyphs);
	});

	test('non-first paragraph in a loose list item has no hanging indent', async () => {
		await editor.loadContent('- first\n\n  second\n');
		const blocks = editor.page.locator('.list-item-block .text-editable-block');
		const indents = await blocks.evaluateAll((els) =>
			els.map((el) => parseFloat(getComputedStyle(el).paddingLeft))
		);

		expect(indents[0]).toBeGreaterThan(0);
		expect(indents[1]).toBe(0);
	});
});
