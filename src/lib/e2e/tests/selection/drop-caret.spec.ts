import { test, expect } from '../../fixtures';
import { EditorPage } from '../../editor-page';
import { blockCenter } from './multi-click-helpers';
import { textRunCenter, textRunStart, pointAtRaw } from '../../text-runs';
import { multiClick } from '../../multi-click';
import { holdSelectionDrag } from '../../selection-drag';
import { COPY_DRAG_MODIFIERS } from '../../platform-keys';
import { skipUnlessSupported } from '../../browser-engine';

// The caret shown while a dragged selection is held over the editor
// (`requirements/selection/drop-caret.md`). Aim points are a run's first glyph, whose
// character boundary no font metric moves.

const TWO = 'alpha beta gamma\n\nsecond para here\n';
const RULE_DOC = 'alpha beta gamma\n\n---\n\nsecond para here\n';
const SOFT_BREAK_DOC = 'alpha\nbeta gamma\n\nsecond para here\n';

type Point = { x: number; y: number };

/** A point above the editor's own box, the one side of it the page has room on: where a
 *  `dragleave` means the drag has left the editor rather than crossed a block inside it. */
async function outsideEditor(page: import('@playwright/test').Page): Promise<Point> {
	const at = await page.evaluate(() => {
		const box = document.querySelector('.editor')!.getBoundingClientRect();
		return box.top > 24 ? { x: box.left + box.width / 2, y: box.top - 16 } : null;
	});
	if (!at) throw new Error('the editor reaches the top of the viewport: no point above its box');
	return at;
}

function caretLeft(page: import('@playwright/test').Page): Promise<number> {
	return page.evaluate(() => {
		const el = document.querySelector('.drop-caret');
		if (!el) throw new Error('no drop caret is painted');
		return el.getBoundingClientRect().left;
	});
}

test.describe('the caret a held drag shows', () => {
	let editor: EditorPage;

	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		await editor.goto();
		await editor.loadContent(TWO);
	});

	async function doubleClickOn(needle: string): Promise<Point> {
		const at = await textRunCenter(editor.page, needle);
		await multiClick(editor.page, at, 2);
		return at;
	}

	test('stands at the offset the release then lands at', async ({ page }) => {
		// Measured before the drag: "para here" starts at offset 7, which is where the
		// released word turns out to land.
		const landing = await pointAtRaw(editor.page, [1], 7);
		const beta = await doubleClickOn('beta');
		const drag = await holdSelectionDrag(page, beta, await textRunStart(page, 'para here'));

		await expect(page.locator('.drop-caret')).toHaveCount(1);
		expect(Math.abs((await caretLeft(page)) - (landing.x - 1))).toBeLessThan(3);

		await drag.release();
		await editor.bridge.waitForSourceEquals('alpha  gamma\n\nsecond betapara here\n');
		await expect(page.locator('.drop-caret')).toHaveCount(0);
	});

	test('follows the hold to a newer offset', async ({ page }) => {
		const beta = await doubleClickOn('beta');
		const drag = await holdSelectionDrag(page, beta, await textRunStart(page, 'second para here'));
		const atBlockStart = await caretLeft(page);

		const later = await textRunStart(page, 'para here');
		await drag.moveTo(later, 6);
		await expect(page.locator('.drop-caret')).toHaveCount(1);
		expect(await caretLeft(page)).toBeGreaterThan(atBlockStart);

		await drag.release();
		await editor.bridge.waitForSourceEquals('alpha  gamma\n\nsecond betapara here\n');
	});

	test('is drawn over the text without taking a hold of its own', async ({ page }) => {
		const beta = await doubleClickOn('beta');
		const drag = await holdSelectionDrag(page, beta, await textRunStart(page, 'para here'));

		expect(
			await page.evaluate(() => {
				const el = document.querySelector('.drop-caret');
				return el ? getComputedStyle(el).pointerEvents : null;
			})
		).toBe('none');
		await drag.release();
	});

	test('a drop the editor would cancel shows none', async ({ page }) => {
		await editor.loadContent(RULE_DOC);
		const beta = await doubleClickOn('beta');
		const drag = await holdSelectionDrag(page, beta, await blockCenter(page, 1));

		await expect(page.locator('.drop-caret')).toHaveCount(0);

		await drag.release();
		await editor.waitForNoSourceMutation();
		expect(await page.evaluate(() => (window as any).__test.getSource())).toBe(RULE_DOC);
	});

	test('a hold carried out of the editor takes the caret away', async ({ page }) => {
		const beta = await doubleClickOn('beta');
		const drag = await holdSelectionDrag(page, beta, await textRunStart(page, 'para here'));
		await expect(page.locator('.drop-caret')).toHaveCount(1);

		const away = await outsideEditor(page);
		await drag.moveTo(away, 8);
		await expect(page.locator('.drop-caret')).toHaveCount(0);

		await drag.release();
		await editor.waitForNoSourceMutation();
		expect(await page.evaluate(() => (window as any).__test.getSource())).toBe(TWO);
	});

	test('a payload carrying a line break shows none', async ({ page }) => {
		await editor.loadContent(SOFT_BREAK_DOC);
		await editor.clickBlockAtPath([0], 0);
		// "alpha\nbet": the break makes it a payload this handler does not move. A count that
		// stopped short of the break would move the bytes and change the document below.
		for (let i = 0; i < 9; i++) await page.keyboard.press('Shift+ArrowRight');
		const drag = await holdSelectionDrag(
			page,
			await textRunCenter(page, 'bet'),
			await textRunCenter(page, 'gamma')
		);

		await expect(page.locator('.drop-caret')).toHaveCount(0);

		await drag.release();
		await editor.waitForNoSourceMutation();
		expect(await page.evaluate(() => (window as any).__test.getSource())).toBe(SOFT_BREAK_DOC);
	});

	test('a landing inside the dragged range shows none', async ({ page }) => {
		const alpha = await textRunCenter(page, 'alpha');
		await multiClick(page, alpha, 3);
		const drag = await holdSelectionDrag(page, alpha, await textRunCenter(page, 'gamma'));

		await expect(page.locator('.drop-caret')).toHaveCount(0);

		await drag.release();
		await editor.waitForNoSourceMutation();
		expect(await page.evaluate(() => (window as any).__test.getSource())).toBe(TWO);
	});

	// A copy leaves its source in place, so it can write inside the range a move could not.
	test('a copy held over a landing inside the dragged range shows one', async ({ page }) => {
		skipUnlessSupported(page, 'modifierDrop');
		await editor.clickBlockAtPath([0], 0);
		// "alpha beta", whose "beta" starts strictly inside it.
		for (let i = 0; i < 10; i++) await page.keyboard.press('Shift+ArrowRight');
		const drag = await holdSelectionDrag(
			page,
			await textRunCenter(page, 'alpha'),
			await textRunStart(page, 'beta'),
			{ copyWith: COPY_DRAG_MODIFIERS[0] }
		);

		await expect(page.locator('.drop-caret')).toHaveCount(1);

		await drag.release();
		await editor.bridge.waitForSourceEquals('alpha alpha betabeta gamma\n\nsecond para here\n');
		await expect(page.locator('.drop-caret')).toHaveCount(0);
	});
});
