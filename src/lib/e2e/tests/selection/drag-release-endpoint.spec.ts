import { test, expect } from '../../fixtures';
import type { Page } from '@playwright/test';
import { EditorPage } from '../../editor-page';
import { multiClickHold } from '../../multi-click';
import { pointAtRaw, textRunCenter, type Point } from '../../text-runs';

// A fast drag ends where it was released, on every route that ends a pointer selection
// (`requirements/selection/drag-release-endpoint.md`).

const TABLE = '| A | B |\n| --- | --- |\n| 1 | 2 |\n| 3 | 4 |\n';
const HEAD_TABLE = `head\n\n${TABLE}`;

type Release = () => Promise<void>;

/** Moves the held drag to `via` and lets a frame resolve it there, then moves to `to` and releases
 *  in one frame, the way a fast hand lets go; an engine may send that last move after the release. */
async function flick(page: Page, via: Point, to: Point, release: Release): Promise<void> {
	await page.mouse.move(via.x, via.y, { steps: 4 });
	await page.evaluate(
		() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
	);
	await Promise.all([page.mouse.move(to.x, to.y), release()]);
}

async function pressAt(page: Page, at: Point): Promise<Release> {
	await page.mouse.move(at.x, at.y);
	await page.mouse.down();
	return () => page.mouse.up();
}

async function cellCentre(page: Page, index: number): Promise<Point> {
	const box = await page.locator('.table-cell').nth(index).boundingBox();
	if (!box) throw new Error(`no box for cell ${index}`);
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** A point in the editor's left margin, level with `at`, where a press starts the margin drag. */
async function marginBeside(page: Page, at: Point): Promise<Point> {
	const root = await page.locator('.editor').first().boundingBox();
	if (!root) throw new Error('no editor root box');
	return { x: root.x + 4, y: at.y };
}

function selection(page: Page): Promise<unknown> {
	return page.evaluate(() => (window as any).__test.getSelection());
}

const cell = (path: number[], offset: number) => ({ path, offset, cellCoordinate: true });
const char = (path: number[], offset: number) => ({ path, offset });

interface Row {
	name: string;
	doc: string;
	press(page: Page): Promise<Release>;
	via(page: Page): Promise<Point>;
	to(page: Page): Promise<Point>;
	expected: { anchor: unknown; focus: unknown };
}

const ROWS: Row[] = [
	{
		name: 'a press in text, released in a body cell',
		doc: HEAD_TABLE,
		press: async (page) => pressAt(page, await pointAtRaw(page, [0], 0)),
		via: (page) => cellCentre(page, 0),
		to: (page) => cellCentre(page, 3),
		expected: { anchor: char([0], 0), focus: cell([1], 3) }
	},
	{
		name: 'a press in the margin, released in a body cell',
		doc: HEAD_TABLE,
		press: async (page) => pressAt(page, await marginBeside(page, await pointAtRaw(page, [0], 0))),
		via: (page) => cellCentre(page, 0),
		to: (page) => cellCentre(page, 3),
		expected: { anchor: char([0], 0), focus: cell([1], 3) }
	},
	{
		name: 'a double-click drag from a word, released in a body cell',
		doc: HEAD_TABLE,
		press: async (page) =>
			(await multiClickHold(page, await textRunCenter(page, 'head'), 2)).release,
		via: (page) => cellCentre(page, 0),
		to: (page) => cellCentre(page, 3),
		expected: { anchor: char([0], 0), focus: cell([1], 3) }
	},
	{
		name: 'a press in a cell, released in another cell',
		doc: TABLE,
		press: async (page) => pressAt(page, await cellCentre(page, 0)),
		via: (page) => cellCentre(page, 1),
		to: (page) => cellCentre(page, 3),
		expected: { anchor: cell([0], 0), focus: cell([0], 3) }
	},
	{
		name: 'a press in a cell, released in the paragraph below',
		doc: `${TABLE}\ntail words here\n`,
		press: async (page) => pressAt(page, await cellCentre(page, 0)),
		via: (page) => cellCentre(page, 3),
		to: (page) => pointAtRaw(page, [1], 4),
		expected: { anchor: cell([0], 0), focus: char([1], 4) }
	},
	{
		name: 'a press in text, released in the next paragraph',
		doc: 'first line here\n\nsecond line here\n',
		press: async (page) => pressAt(page, await pointAtRaw(page, [0], 0)),
		via: (page) => pointAtRaw(page, [1], 2),
		to: (page) => pointAtRaw(page, [1], 9),
		expected: { anchor: char([0], 0), focus: char([1], 9) }
	},
	{
		name: 'a press in text, released past the middle of a divider',
		doc: 'head\n\n---\n\ntail\n',
		press: async (page) => pressAt(page, await pointAtRaw(page, [0], 0)),
		via: (page) => pointAtRaw(page, [0], 3),
		to: async (page) => {
			const box = await page.locator('[data-block-path="[1]"]').boundingBox();
			if (!box) throw new Error('no divider box');
			return { x: box.x + box.width / 2, y: box.y + box.height * 0.75 };
		},
		expected: { anchor: char([0], 0), focus: char([1], 3) }
	},
	{
		name: 'a press in text, released outside the editor',
		doc: 'alpha\n\nbeta words\n',
		press: async (page) => pressAt(page, await pointAtRaw(page, [0], 0)),
		via: (page) => pointAtRaw(page, [1], 2),
		to: async (page) => ({ x: 2, y: (await pointAtRaw(page, [1], 2)).y }),
		expected: { anchor: char([0], 0), focus: char([1], 0) }
	}
];

test.describe('selection: a fast drag ends where it was released', () => {
	let editor: EditorPage;

	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		await editor.goto();
	});

	for (const row of ROWS) {
		test(row.name, async ({ page }) => {
			await editor.loadContent(row.doc);
			const release = await row.press(page);
			await flick(page, await row.via(page), await row.to(page), release);
			await expect.poll(() => selection(page)).toEqual(row.expected);
		});
	}

	// The selection toolbar shows on release, below and right of the cell the range last reached,
	// which is where the pointer lets go: the release has to resolve before the bar is there.
	test('Ctrl+B after a fast drag into a body cell bolds through that row', async ({ page }) => {
		await editor.loadContent(HEAD_TABLE);
		const release = await pressAt(page, await pointAtRaw(page, [0], 0));
		await flick(page, await cellCentre(page, 0), await cellCentre(page, 3), release);
		await expect(page.getByRole('toolbar', { name: 'Selection formatting' })).toBeVisible();

		await page.keyboard.press('ControlOrMeta+b');
		await editor.bridge.waitForSourceEquals(
			'**head**\n\n| **A** | **B** |\n| --- | --- |\n| **1** | **2** |\n| 3 | 4 |\n',
			3000
		);
	});
});
