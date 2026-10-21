import { test, expect } from '../../fixtures';
import type { Page } from '@playwright/test';
import { focusWalkReachesLinks } from '../../browser-engine';
import { showInPlace } from '../../click-in-place';
import { textRunCenter, type Point } from '../../text-runs';
import { capturedErrors, dragBetweenPoints } from './helpers';
import { addHostButtons, focusName, holdsCaret } from '../../reading-focus-probes';
import { block, blockStops, controlsFrom, loadKinds, walkOut } from './reading-kinds';

// A reading-mode press beside a block's text (requirements/plugins/reading-press-focus.md) focuses
// the block a click there puts the caret in while editing, so Tab carries on from it.

type Side = 'left' | 'bottom' | 'right';

/** A point 2px inside the edge `side` of the block at `path`, level with its middle. */
async function edgeOf(page: Page, path: number[], side: Side): Promise<Point> {
	const el = block(page, path).first();
	await showInPlace(el);
	const box = (await el.boundingBox())!;
	if (side === 'bottom') return { x: box.x + box.width / 2, y: box.y + box.height - 2 };
	return { x: side === 'left' ? box.x + 2 : box.x + box.width - 3, y: box.y + box.height / 2 };
}

/** A point in the editor's own left gutter, level with the block at `path`. */
async function gutterBy(page: Page, path: number[]): Promise<Point> {
	const at = await edgeOf(page, path, 'left');
	const editor = (await page.locator('.editor').boundingBox())!;
	return { x: editor.x + 3, y: at.y };
}

/** A point just below the last block, on the editor's own padding. */
async function belowLast(page: Page): Promise<Point> {
	const at = await edgeOf(page, [13], 'bottom');
	return { x: at.x, y: at.y + 8 };
}

interface Press {
	name: string;
	at(page: Page): Promise<Point>;
	/** The block the press focuses, as its `data-block-path`. */
	focuses: string;
}

const PRESSES: Press[] = [
	{ name: "a quote's bar", at: (page) => edgeOf(page, [4], 'left'), focuses: '[4,0]' },
	{
		name: "a list item's marker cell",
		at: (page) => edgeOf(page, [3], 'left'),
		focuses: '[3,0,0]'
	},
	{
		name: "a list's bottom padding",
		at: (page) => edgeOf(page, [3], 'bottom'),
		focuses: '[3,1,0]'
	},
	{ name: "a details block's side", at: (page) => edgeOf(page, [8], 'left'), focuses: '[8,0]' },
	{
		name: "an admonition's bottom padding",
		at: (page) => edgeOf(page, [9], 'bottom'),
		focuses: '[9,1]'
	},
	{
		name: "a footnote definition's side",
		at: (page) => edgeOf(page, [13], 'left'),
		focuses: '[13,0]'
	},
	{
		name: "a code block's bottom padding",
		at: (page) => edgeOf(page, [5], 'bottom'),
		focuses: '[5]'
	},
	{ name: "the editor's gutter", at: (page) => gutterBy(page, [2]), focuses: '[2]' },
	{ name: 'below the last block', at: belowLast, focuses: '[13,0]' }
];

// A block with no line of text takes only a press on its content, in every mode.
const DECLINED: Omit<Press, 'focuses'>[] = [
	{ name: "beside a table's cells", at: (page) => edgeOf(page, [6], 'right') },
	{ name: "a diagram's bottom padding", at: (page) => edgeOf(page, [10], 'bottom') }
];

async function pressAt(page: Page, at: Point): Promise<void> {
	await page.mouse.click(at.x, at.y);
}

test.describe('reading mode: a press beside the text focuses its block', () => {
	for (const press of PRESSES) {
		test(`${press.name} makes ${press.focuses} the stop, with no caret`, async ({ page }) => {
			await loadKinds(page);

			await pressAt(page, await press.at(page));

			expect(await focusName(page)).toContain(press.focuses);
			expect(await blockStops(page)).toEqual([press.focuses]);
			expect(await holdsCaret(page)).toBe(false);
			expect(await capturedErrors(page)).toEqual([]);
		});
	}

	for (const press of DECLINED) {
		test(`${press.name} focuses nothing, as in editing, and the stop stays`, async ({ page }) => {
			await loadKinds(page);
			await pressAt(page, await textRunCenter(page, 'plain', { path: [2] }));

			await pressAt(page, await press.at(page));

			expect(await blockStops(page)).toEqual(['[2]']);
			expect(await capturedErrors(page)).toEqual([]);
		});
	}

	test("Tab after a press on an admonition's padding walks on from the admonition", async ({
		page
	}) => {
		const links = await focusWalkReachesLinks(page);
		await loadKinds(page);
		await addHostButtons(page);

		await pressAt(page, await edgeOf(page, [9], 'bottom'));
		expect(await focusName(page)).toContain('[9,1]');
		const expected = await controlsFrom(page, false, links);

		expect(await walkOut(page, false)).toEqual(expected);
	});

	test("a drag from a quote's bar across its text keeps the selection", async ({ page }) => {
		await loadKinds(page);

		await dragBetweenPoints(
			page,
			await edgeOf(page, [4], 'left'),
			await textRunCenter(page, 'quoted', { path: [4, 0] })
		);

		expect(await page.evaluate(() => getSelection()?.toString())).toMatch(/quo/);
		expect(await holdsCaret(page)).toBe(false);
	});

	test("leaving reading after a press on a quote's bar types into the quote's line", async ({
		page
	}) => {
		const editor = await loadKinds(page);

		await pressAt(page, await edgeOf(page, [4], 'left'));
		await editor.setPresentationMode('live');
		await page.keyboard.type('Z');

		await editor.bridge.waitForSourceContains('> Za quoted line');
	});
});
