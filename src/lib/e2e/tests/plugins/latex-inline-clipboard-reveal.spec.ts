import { test, expect } from '../../fixtures';
import { PluginsPage } from './helpers';
import { dispatchPaste } from '../../clipboard-arm';

/**
 * A clipboard edit while an inline formula's source is open: a paste closes the source first and
 * keeps both the typed edit and the typing after it; a copy closes nothing.
 * Requirements: e2e/requirements/plugins/latex-inline-clipboard-reveal.md.
 */

class MathClipboardPage extends PluginsPage {
	get mathWidget() {
		return this.page.locator('.math-inline-widget');
	}

	async gotoMath(): Promise<void> {
		await this.gotoPlugins('math');
		await expect(this.mathWidget).toHaveCount(1);
	}

	/** Open `$x^2$` at its trailing edge: click the block, End, then ArrowLeft through the 6
	 *  characters of " after" to reach raw offset 12, then one more ArrowLeft to enter. */
	async revealAtTrailingEdge(): Promise<void> {
		await this.getBlock(0).click();
		await this.page.keyboard.press('End');
		for (let i = 0; i < 6; i++) await this.page.keyboard.press('ArrowLeft');
		await this.page.keyboard.press('ArrowLeft');
		await expect(this.mathWidget).toHaveCount(0);
	}

	/** Fire a real paste event carrying `text` at the focused block. */
	async pastePlainText(text: string): Promise<void> {
		await dispatchPaste(this.page, { entries: { 'text/plain': text } });
	}
}

test.describe('inline math: clipboard during an active source reveal', () => {
	let editor: MathClipboardPage;

	test.beforeEach(async ({ page }) => {
		editor = new MathClipboardPage(page);
		await editor.gotoMath();
	});

	test('paste closes the source first, keeping the typed edit and later typing', async ({
		page
	}) => {
		await editor.revealAtTrailingEdge();

		await page.keyboard.type('QQ');

		await editor.pastePlainText('P');

		await editor.bridge.waitForSourceContains('QQ');

		await page.keyboard.type('Z');
		await editor.bridge.waitForSourceContains('Z');

		const source = await editor.bridge.getSource();
		expect(source).toContain('QQ');
		expect(source).toContain('P');
		expect(source).toContain('Z');
		// Nothing was spliced at a wrong offset: the math delimiters survive intact.
		expect(source).toContain('$x^2$');
	});

	test('copy reads the edit in the shown source and keeps the source open', async ({ page }) => {
		await editor.revealAtTrailingEdge();

		await page.keyboard.type('QQ');

		// Select the edit; both endpoints stay inside the source node, so the copy never closes it.
		await page.keyboard.press('Shift+ArrowLeft');
		await page.keyboard.press('Shift+ArrowLeft');

		await page.keyboard.press('ControlOrMeta+c');
		await editor.waitForClipboardWrite();

		const clip = await editor.readClipboard();
		expect(clip).toBe('QQ');

		// Copy never edits: the source stays open, and the document holds what was typed.
		await expect(editor.mathWidget).toHaveCount(0);
		expect(await editor.bridge.getSource()).toContain('$x^2$QQ');
	});
});
