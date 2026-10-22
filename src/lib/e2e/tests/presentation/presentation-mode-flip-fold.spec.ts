import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures';
import { capturedErrors } from '../plugins/helpers';
import { MathRevealPage } from '../plugins/latex-reveal-helpers';
import type { PresentationMode } from '../../../presentation-mode';

// A mode change counts as a blur, so a block showing a widget's source closes it on every switch.
// Keys typed into the source were written as they landed, so the switch moves no byte.
// Requirements: e2e/requirements/presentation/presentation-mode-flip-fold.md.

const DOC = 'above\n\n$x^2$\n';
const EDITED = 'above\n\n$x^2q$\n';

test.describe('mode flips: an open reveal closes', () => {
	let editor: MathRevealPage;

	test.beforeEach(async ({ page }) => {
		editor = new MathRevealPage(page);
		await editor.gotoPlugins('math');
		await page.evaluate(() => (window as any).__test.startErrorCapture());
		await editor.loadContent(DOC);
	});

	async function flipTo(mode: PresentationMode): Promise<void> {
		await editor.setPresentationMode(mode);
		await editor.waitForRenderFlush();
	}

	/** How many shown sources carry the tint, read off the CSS highlight the block paints. */
	function washedRanges(page: Page): Promise<number> {
		return page.evaluate(() => CSS.highlights.get('md-inline-reveal')?.size ?? 0);
	}

	/** Show the source and type one byte into the formula, which the document holds at once. */
	async function revealAndEdit(page: Page): Promise<void> {
		await editor.revealFromTrailingEdge(1);
		await page.keyboard.press('ArrowLeft');
		await page.keyboard.type('q');
		await expect(editor.getBlock(1)).toHaveText('$x^2q$');
		expect(await editor.bridge.getSource(), 'the typed byte is written as it lands').toBe(EDITED);
	}

	test('the flip to reading closes the source and keeps the edit', async ({ page }) => {
		await revealAndEdit(page);
		await flipTo('reading');
		expect(await editor.bridge.getSource()).toBe(EDITED);
		await expect(editor.mathWidget).toHaveCount(1);
		expect(await washedRanges(page)).toBe(0);
		expect(await capturedErrors(page)).toEqual([]);
	});

	// The flip carries the caret across, and a caret restored inside a formula opens its source
	// there, as any restore does; reading mode shows no source, so there it stays closed.
	test('the flip to live keeps the edit and reopens the source at the carried caret', async ({
		page
	}) => {
		await revealAndEdit(page);
		await flipTo('live');
		expect(await editor.bridge.getSource()).toBe(EDITED);
		await expect(editor.mathWidget).toHaveCount(0);
		expect(await washedRanges(page)).toBe(1);
		expect((await editor.bridge.getSelectionPaths())?.focus).toEqual({ path: [1], offset: 5 });
		expect(await capturedErrors(page)).toEqual([]);
	});

	// The other half of the same rule: a source shown but not typed into moves no byte either.
	test('a reveal opened but not edited writes nothing across the flip', async ({ page }) => {
		await editor.revealFromTrailingEdge(1);
		await flipTo('live');
		expect(await editor.bridge.getSource()).toBe(DOC);
		await expect(editor.mathWidget).toHaveCount(1);
		expect(await capturedErrors(page)).toEqual([]);
	});
});
