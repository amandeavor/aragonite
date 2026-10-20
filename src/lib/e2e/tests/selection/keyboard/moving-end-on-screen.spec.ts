import { test, expect } from '../../../fixtures';
import type { Page } from '@playwright/test';
import { EditorPage } from '../../../editor-page';
import { extendKey } from '../../../platform-keys';

// Whatever key moves a selection's moving end, and whatever shape the range takes, the end lands on
// screen. Requirements: `e2e/requirements/selection/keyboard/moving-end-on-screen.md`.

const para = (i: number) => `paragraph ${i} with a few words in it`;
const paragraphs = (count: number) =>
	Array.from({ length: count }, (_, i) => para(i)).join('\n\n') + '\n';
const SIXTY = paragraphs(60);
// One column: a header row and sixty body rows, so a row's cell index is its row index.
const TABLE =
	'intro\n\n| H |\n| - |\n' +
	Array.from({ length: 60 }, (_, i) => `| cell ${i} |`).join('\n') +
	'\n\nafter\n';
const LAST_ROW = 60;

interface Point {
	path: number[];
	offset: number;
}

interface MovingEnd {
	anchor: Point;
	focus: Point;
	crossBlock: boolean;
	/** The moving end's line sits inside the editor's viewport. */
	onScreen: boolean;
}

/** Where the selection's ends are, and whether the moving end's line shows in the editor. */
function movingEnd(page: Page): Promise<MovingEnd> {
	return page.evaluate(() => {
		const t = (window as any).__test;
		const sel = t.getSelectionPaths();
		const { path, offset } = sel.focus;
		const painted = (start: number, end: number) =>
			(t.rects.rangeRects(path, start, end) as DOMRect[]).filter((r) => r.width > 0);
		const box =
			(offset > 0 ? painted(offset - 1, offset).at(-1) : undefined) ??
			painted(offset, offset + 1)[0] ??
			t.rects.blockRect(path);
		const port = document.querySelector('.editor')!.getBoundingClientRect();
		const top = Math.max(0, port.top);
		const bottom = Math.min(window.innerHeight, port.bottom);
		return {
			anchor: sel.anchor,
			focus: sel.focus,
			crossBlock: t.isCrossBlockSelection(),
			// A pixel of slack for a line box that rounds across the edge.
			onScreen: !!box && box.top >= top - 1 && box.bottom <= bottom + 1
		};
	});
}

async function press(ep: EditorPage, page: Page, key: string, times = 1): Promise<void> {
	for (let i = 0; i < times; i++) {
		await page.keyboard.press(key);
		await ep.waitForRenderFlush();
	}
}

/** The moving end, once the scroll that shows it has run. */
async function endOnScreen(page: Page): Promise<MovingEnd> {
	await expect.poll(async () => (await movingEnd(page)).onScreen).toBe(true);
	return movingEnd(page);
}

/** Scrolls the table's row `row` to sit on the editor's bottom edge, the row below it hidden. */
async function rowOnBottomEdge(ep: EditorPage, page: Page, row: number): Promise<void> {
	await ep.scrollEditorTo(0);
	await page.evaluate(
		(path) => (window as any).__test.rects.scrollTo(path, { block: 'nearest', hold: false }),
		[1, row, 0]
	);
	await ep.waitForRenderFlush();
}

async function open(page: Page, doc: string): Promise<EditorPage> {
	const ep = new EditorPage(page);
	await ep.goto();
	await ep.loadContent(doc);
	return ep;
}

test.describe('a range folded back into one block', () => {
	test('Shift+ArrowUp back into the starting block shows it, the start of it moving', async ({
		page
	}) => {
		const ep = await open(page, SIXTY);
		await ep.focusBlockEnd(10);
		await press(ep, page, 'Shift+ArrowDown', 25);
		await press(ep, page, 'Shift+ArrowUp', 25);
		const end = await endOnScreen(page);
		expect(end.crossBlock).toBe(false);
		expect(end.anchor).toEqual({ path: [10], offset: para(10).length });
		expect(end.focus).toEqual({ path: [10], offset: 0 });
	});

	test('one more Shift+ArrowUp after the fold extends into the block above', async ({ page }) => {
		const ep = await open(page, SIXTY);
		await ep.focusBlockEnd(10);
		await press(ep, page, 'Shift+ArrowDown', 25);
		await press(ep, page, 'Shift+ArrowUp', 26);
		const end = await endOnScreen(page);
		expect(end.crossBlock).toBe(true);
		expect(end.anchor).toEqual({ path: [10], offset: para(10).length });
		expect(end.focus).toEqual({ path: [9], offset: 0 });
	});

	test('Shift+ArrowDown back into the starting block shows it', async ({ page }) => {
		const ep = await open(page, SIXTY);
		await ep.focusBlock(40, 10);
		await press(ep, page, extendKey('docStart'));
		await press(ep, page, 'Shift+ArrowDown', 40);
		const end = await endOnScreen(page);
		expect(end.crossBlock).toBe(false);
		expect(end.anchor).toEqual({ path: [40], offset: 10 });
		expect(end.focus).toEqual({ path: [40], offset: 0 });
	});

	test('the document start folding back into the first block shows it', async ({ page }) => {
		const ep = await open(page, SIXTY);
		await ep.focusBlock(0, 10);
		await press(ep, page, extendKey('docEnd'));
		await press(ep, page, extendKey('docStart'));
		const end = await endOnScreen(page);
		expect(end.anchor).toEqual({ path: [0], offset: 10 });
		expect(end.focus).toEqual({ path: [0], offset: 0 });
	});

	test('the document end folding back into the last block shows it', async ({ page }) => {
		const ep = await open(page, SIXTY);
		await ep.focusBlock(59, 10);
		await press(ep, page, extendKey('docStart'));
		await press(ep, page, extendKey('docEnd'));
		const end = await endOnScreen(page);
		expect(end.anchor).toEqual({ path: [59], offset: 10 });
		expect(end.focus).toEqual({ path: [59], offset: para(59).length });
	});
});

test.describe('a range across blocks', () => {
	test('Shift+ArrowDown past the bottom edge is followed down', async ({ page }) => {
		const ep = await open(page, SIXTY);
		await ep.focusBlockEnd(5);
		await press(ep, page, 'Shift+ArrowDown', 30);
		const end = await endOnScreen(page);
		expect(end.focus).toEqual({ path: [35], offset: 0 });
	});

	test('the document end mounts a block never rendered and shows it', async ({ page }) => {
		const ep = await open(page, paragraphs(200));
		// A count of the hosts proves windowing is on, which the tree alone can't.
		expect(await page.locator('.vr-spacer').count()).toBeGreaterThan(0);
		await ep.focusBlock(0, 0);
		await press(ep, page, extendKey('docEnd'));
		const end = await endOnScreen(page);
		expect(end.focus).toEqual({ path: [199], offset: para(199).length });
		await press(ep, page, 'ArrowLeft');
		expect(await ep.bridge.isCrossBlockSelection()).toBe(false);
	});

	test('Shift+End and Shift+Home move the end along its line, on screen', async ({ page }) => {
		const ep = await open(page, SIXTY);
		await ep.focusBlockEnd(5);
		await press(ep, page, 'Shift+ArrowDown', 30);
		await press(ep, page, extendKey('lineEnd'));
		let end = await endOnScreen(page);
		expect(end.anchor).toEqual({ path: [5], offset: para(5).length });
		expect(end.focus).toEqual({ path: [35], offset: para(35).length });
		await press(ep, page, extendKey('lineStart'));
		end = await endOnScreen(page);
		expect(end.focus).toEqual({ path: [35], offset: 0 });
	});
});

test.describe('a range through a table', () => {
	test('Shift+ArrowDown from the row on the bottom edge shows the row below', async ({ page }) => {
		const ep = await open(page, TABLE);
		await ep.focusBlockAtPath([1, 25, 0], 0);
		await rowOnBottomEdge(ep, page, 25);
		await press(ep, page, 'Shift+ArrowDown');
		const end = await endOnScreen(page);
		expect(end.anchor).toMatchObject({ path: [1], offset: 25 });
		expect(end.focus).toMatchObject({ path: [1], offset: 26 });
	});

	test('more Shift+ArrowDown inside the table follows it a row at a time', async ({ page }) => {
		const ep = await open(page, TABLE);
		await ep.focusBlockAtPath([1, 25, 0], 0);
		await press(ep, page, 'Shift+ArrowDown', 11);
		const end = await endOnScreen(page);
		expect(end.focus).toMatchObject({ path: [1], offset: 36 });
	});

	test('from a paragraph above, Shift+ArrowDown grows through the table', async ({ page }) => {
		const ep = await open(page, TABLE);
		await ep.focusBlockEnd(0);
		await press(ep, page, 'Shift+ArrowDown', 41);
		const end = await endOnScreen(page);
		expect(end.anchor).toEqual({ path: [0], offset: 'intro'.length });
		expect(end.focus).toMatchObject({ path: [1], offset: 40 });
	});

	test('past the table’s last row, Shift+ArrowDown leaves for the paragraph below', async ({
		page
	}) => {
		const ep = await open(page, TABLE);
		await ep.focusBlockEnd(0);
		await press(ep, page, 'Shift+ArrowDown', LAST_ROW + 2);
		const end = await endOnScreen(page);
		expect(end.focus).toEqual({ path: [2], offset: 0 });
	});

	test('from a paragraph below, Shift+ArrowUp takes the last row, then the one above', async ({
		page
	}) => {
		const ep = await open(page, TABLE);
		await ep.focusBlock(2, 0);
		await press(ep, page, 'Shift+ArrowUp');
		expect((await endOnScreen(page)).focus).toMatchObject({ path: [1], offset: LAST_ROW });
		await press(ep, page, 'Shift+ArrowUp');
		expect((await endOnScreen(page)).focus).toMatchObject({ path: [1], offset: LAST_ROW - 1 });
	});
});

test.describe("the range's keys once its end shows", () => {
	test('a letter typed over a range ending on a rule replaces the text, the rule kept', async ({
		page
	}) => {
		const ep = await open(page, 'alpha\n\n---\n\nbeta\n');
		await ep.focusBlock(0, 2);
		await press(ep, page, 'Shift+ArrowDown', 2);
		expect((await endOnScreen(page)).focus).toEqual({ path: [1], offset: 0 });
		await page.keyboard.type('X');
		await expect
			.poll(() => page.evaluate(() => (window as any).__test.getSource()))
			.toBe('alX\n\n---\n\nbeta\n');
	});
});
