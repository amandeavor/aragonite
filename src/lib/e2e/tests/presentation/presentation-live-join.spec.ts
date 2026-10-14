import { test, expect } from '../../fixtures';
import { EditorPage } from '../../editor-page';
import type { Page } from '@playwright/test';
import { clickWordSettled, enterPresentationMode, extendTo, stepTo } from './helpers';

// What a destructive join writes in live mode: a run the cut went through closes on the half before
// it and reopens on the half after, the pair it brought back to back goes, and no delimiter shows.
// The source is the reference, because a hidden delimiter and an absent one look identical on screen.
// Requirements: e2e/requirements/presentation/presentation-live-join.md.

const DOC = [
	'Some **bold** and *italic* words',
	'',
	'Alpha **beta** gamma',
	'',
	'delta *epsilon* zeta',
	'',
	'plain words here'
].join('\n');

const MIXED = 0;
const ABOVE = 1;
const PLAIN = 3;

const enterMode = (page: Page, mode: 'live' | 'source') => enterPresentationMode(page, mode, DOC);

/** Caret after `bo` inside the bold run, then a real Shift-extend to just after `it` inside the
 *  italic: both endpoints strictly inside a construct, which is what strands the two runs. */
async function selectBoldIntoItalic(ep: EditorPage, page: Page): Promise<void> {
	await clickWordSettled(ep, page, 'Some');
	await stepTo(ep, page, 'ArrowRight', 9);
	await extendTo(ep, page, 'ArrowRight', [MIXED], 21);
}

test.describe('live mode: a selection out of one construct and into another', () => {
	test('Backspace joins the text and each half keeps its format', async ({ page }) => {
		const ep = await enterMode(page, 'live');
		await selectBoldIntoItalic(ep, page);

		await page.keyboard.press('Backspace');
		await ep.bridge.waitForSourceContains('Some **bo***alic* words');
		await expect(ep.getBlock(MIXED)).toHaveText('Some boalic words', { useInnerText: true });
		await expect(ep.getBlock(MIXED).locator('strong')).toHaveText('bo', { useInnerText: true });
		await expect(ep.getBlock(MIXED).locator('em')).toHaveText('alic', { useInnerText: true });
	});

	test('Mod+X leaves the same bytes and copies what the cut took, its runs closed', async ({
		page
	}) => {
		const ep = await enterMode(page, 'live');
		await selectBoldIntoItalic(ep, page);

		await page.keyboard.press('ControlOrMeta+x');
		await ep.bridge.waitForSourceContains('Some **bo***alic* words');
		expect(await ep.readClipboard()).toBe('**ld** and *it*');
	});

	// The clipboard carries what the cut took, and the paste lands it inside the runs it meets.
	test('Mod+X then Mod+V at the same caret gives the block back', async ({ page }) => {
		const ep = await enterMode(page, 'live');
		await selectBoldIntoItalic(ep, page);

		await page.keyboard.press('ControlOrMeta+x');
		await ep.bridge.waitForSourceContains('Some **bo***alic* words');
		await page.keyboard.press('ControlOrMeta+v');
		await ep.bridge.waitForSourceContains('Some **bold** and *italic* words');
		await expect(ep.getBlock(MIXED)).toHaveText('Some bold and italic words', {
			useInnerText: true
		});
	});

	test('typing over the selection lands the character inside the bold', async ({ page }) => {
		const ep = await enterMode(page, 'live');
		await selectBoldIntoItalic(ep, page);

		await page.keyboard.type('X');
		await ep.bridge.waitForSourceContains('Some **boX***alic* words');
	});

	test('one undo puts the original block back', async ({ page }) => {
		const ep = await enterMode(page, 'live');
		await selectBoldIntoItalic(ep, page);

		await page.keyboard.press('Backspace');
		await ep.bridge.waitForSourceContains('Some **bo***alic* words');
		await page.keyboard.press('ControlOrMeta+z');
		await ep.bridge.waitForSourceContains('Some **bold** and *italic* words');
	});
});

test.describe('live mode: the join across a block boundary', () => {
	/**
	 * Once the selection crosses a block boundary it extends whole blocks, so the far endpoint is a
	 * block start; the two-sided case is in the unit tests.
	 */
	async function selectAcrossBlocks(ep: EditorPage, page: Page): Promise<void> {
		await clickWordSettled(ep, page, 'Alpha');
		await stepTo(ep, page, 'ArrowRight', 10);
		await extendTo(ep, page, 'ArrowRight', [ABOVE + 1], 0);
	}

	test('two paragraphs join with the bold closed on the half that stays', async ({ page }) => {
		const ep = await enterMode(page, 'live');
		await selectAcrossBlocks(ep, page);

		await page.keyboard.press('Backspace');
		await ep.bridge.waitForSourceContains('Alpha **be**delta *epsilon* zeta');
	});

	// The cleanup happens in the delete half, and the pasted text lands at the caret it left,
	// inside the bold the cut closed.
	test('a paste at the join lands its text inside the closed bold', async ({ page }) => {
		const ep = await enterMode(page, 'live');
		await selectAcrossBlocks(ep, page);

		await ep.seedClipboard('JOINED');
		await ep.paste();
		await ep.bridge.waitForSourceContains('Alpha **beJOINED**delta *epsilon* zeta');
	});
});

test.describe('live mode: joins with nothing to clean', () => {
	test('a selection over plain text deletes exactly what it covered', async ({ page }) => {
		const ep = await enterMode(page, 'live');
		await clickWordSettled(ep, page, 'plain');
		await stepTo(ep, page, 'ArrowRight', 5);
		await extendTo(ep, page, 'ArrowRight', [PLAIN], 11);

		await page.keyboard.press('Backspace');
		await ep.bridge.waitForSourceContains('plain here');
		await expect(ep.getBlock(PLAIN)).toHaveText('plain here', { useInnerText: true });
	});

	// Both endpoints inside one construct: its opener and closer meet across the join, which is
	// what the user had, so the join keeps the pair rather than dropping it.
	test('a selection inside one construct keeps the construct', async ({ page }) => {
		const ep = await enterMode(page, 'live');
		await clickWordSettled(ep, page, 'Alpha');
		await stepTo(ep, page, 'ArrowRight', 10);
		await extendTo(ep, page, 'ArrowRight', [ABOVE], 11);

		await page.keyboard.press('Backspace');
		await ep.bridge.waitForSourceContains('Alpha **bea** gamma');
		await expect(ep.getBlock(ABOVE).locator('strong')).toHaveText('bea', { useInnerText: true });
	});
});

// Source paints every delimiter, so the byte the selection covered is the byte the user aimed at.
test.describe('source mode: the same gesture stays byte-literal', () => {
	test('the stranded runs survive the delete', async ({ page }) => {
		const ep = await enterMode(page, 'source');
		await clickWordSettled(ep, page, 'Some');
		await stepTo(ep, page, 'ArrowRight', 9);
		await extendTo(ep, page, 'ArrowRight', [MIXED], 21);

		await page.keyboard.press('Backspace');
		await ep.bridge.waitForSourceContains('Some **boalic* words');
	});
});
