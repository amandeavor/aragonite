import { test, expect } from '../../../fixtures';
import { EditorPage } from '../../../editor-page';
import { waitForFirstImageLoaded } from './helpers';

// A Shift key that grows the selection, pressed on a selected image, keeps the image in: the
// selection is anchored at the image's far edge and its moving end goes the key's way.
// Requirements: `e2e/requirements/blocks/image/selected-image-extend.md`.

const IMAGE = '![pic](/test-fixtures/sample.png)';
const DOC = `one\n\nbefore ${IMAGE} after\n\ntwo\n`;

interface ExtendRow {
	key: string;
	/** The source once a `Z` replaces the selection: the image gone, its far side kept. */
	typed: RegExp;
	/** Text on the image's near side the extend must take too; the page keys move by the browser's
	 *  page, which in Firefox is no move in a one-line block, so they leave it out. */
	taken?: string;
}

const ROWS: ExtendRow[] = [
	{ key: 'Shift+ArrowUp', typed: /Z after\n\ntwo\n$/, taken: 'before ' },
	{ key: 'Shift+PageUp', typed: /Z after\n\ntwo\n$/ },
	{ key: 'Shift+ArrowDown', typed: /^one\n\nbefore Z/, taken: ' after' },
	{ key: 'Shift+PageDown', typed: /^one\n\nbefore Z/ }
];

test.describe('a Shift key that extends from a selected image keeps the image', () => {
	for (const row of ROWS) {
		test(`${row.key} extends from the image's far edge`, async ({ page }) => {
			const editor = new EditorPage(page);
			await editor.goto();
			await editor.loadContent(DOC);
			await waitForFirstImageLoaded(page);
			await page.locator('[data-image-widget]').first().click();
			await expect(page.locator('[data-image-overlay]')).toBeVisible();
			await page.keyboard.press(row.key);
			// The image is a text range's now, so its toolbar goes.
			await expect(page.locator('[data-image-overlay]')).toHaveCount(0);
			await page.keyboard.press('Z');
			await editor.bridge.waitForSource((src) => src !== DOC);
			const src = await editor.bridge.getSource();
			expect(src).not.toContain('![pic]');
			expect(src).toMatch(row.typed);
			if (row.taken) expect(src).not.toContain(row.taken);
		});
	}
});
