import { test, expect } from '../../../fixtures';
import type { Page } from '@playwright/test';
import { EditorPage } from '../../../editor-page';
import { extendKey } from '../../../platform-keys';

// Shift+PageUp and Shift+PageDown move a selection's moving end a screen up or down, from a caret
// or a range, and the end stays on screen. Requirements:
// `e2e/requirements/selection/keyboard/page-extend.md`.

const para = (i: number) => `paragraph ${i} with a few words in it`;
const paragraphs = (count: number) =>
	Array.from({ length: count }, (_, i) => para(i)).join('\n\n') + '\n';
const SIXTY = paragraphs(60);
// Twenty paragraphs, then a quote holding forty paragraphs of its own.
const QUOTED =
	paragraphs(20) + '\n' + Array.from({ length: 40 }, (_, i) => `> quote ${i}`).join('\n>\n') + '\n';
// One column: a header row and sixty body rows, so a row's cell index is its row index.
const TABLE =
	'intro\n\n| H |\n| - |\n' +
	Array.from({ length: 60 }, (_, i) => `| cell ${i} |`).join('\n') +
	'\n\nafter\n';
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

/** How many one-line paragraphs one screen of the editor holds: the page a key steps. */
function blocksPerPage(page: Page): Promise<number> {
	return page.evaluate(() => {
		const t = (window as any).__test;
		const pitch = t.rects.blockRect([1]).top - t.rects.blockRect([0]).top;
		const port = document.querySelector('.editor')!.getBoundingClientRect();
		const shown = Math.min(window.innerHeight, port.bottom) - Math.max(0, port.top);
		return shown / pitch;
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

async function open(page: Page, doc: string): Promise<EditorPage> {
	const ep = new EditorPage(page);
	await ep.goto();
	await ep.loadContent(doc);
	return ep;
}

/** A page step in paragraphs lands within one of the screen's height. */
function expectPageStep(from: number, to: number, perPage: number): void {
	expect(Math.abs(Math.abs(to - from) - perPage)).toBeLessThanOrEqual(1.5);
}

test.describe('a range across blocks', () => {
	for (const [key, sign] of [
		['Shift+PageUp', -1],
		['Shift+PageDown', 1]
	] as const) {
		test(`${key} moves the end a screen, the anchor kept`, async ({ page }) => {
			const ep = await open(page, SIXTY);
			const perPage = await blocksPerPage(page);
			await ep.focusBlockEnd(5);
			await press(ep, page, 'Shift+ArrowDown', 30);
			await press(ep, page, key);
			const end = await endOnScreen(page);
			expect(end.crossBlock).toBe(true);
			expect(end.anchor).toEqual({ path: [5], offset: para(5).length });
			expect(Math.sign(end.focus.path[0] - 35)).toBe(sign);
			expectPageStep(35, end.focus.path[0], perPage);
		});
	}

	test('an end the wheel took out of the rendered window steps from where it is', async ({
		page
	}) => {
		const ep = await open(page, paragraphs(200));
		const perPage = await blocksPerPage(page);
		await ep.focusBlock(0, 3);
		await press(ep, page, extendKey('docEnd'));
		await endOnScreen(page);
		const editor = (await page.locator('.editor').boundingBox())!;
		await page.mouse.move(editor.x + editor.width / 2, editor.y + editor.height / 2);
		await page.mouse.wheel(0, -100_000);
		// The wheel's scroll can run on past its event: the key waits for it to reach the top.
		const scrollTop = () => page.evaluate(() => document.querySelector('.editor')!.scrollTop);
		await expect.poll(scrollTop).toBe(0);
		await expect(page.locator('[data-block-path="199"]')).toHaveCount(0);
		await press(ep, page, 'Shift+PageUp');
		const end = await endOnScreen(page);
		expectPageStep(199, end.focus.path[0], perPage);
	});

	test('the document end stops the end on the last block', async ({ page }) => {
		const ep = await open(page, SIXTY);
		await ep.focusBlockEnd(5);
		await press(ep, page, 'Shift+ArrowDown', 50);
		await press(ep, page, 'Shift+PageDown', 2);
		const end = await endOnScreen(page);
		expect(end.focus.path).toEqual([59]);
	});

	// The first step lands on a run of one-letter lines, the second past them on long ones again.
	test('repeated steps keep their column across a short line', async ({ page }) => {
		const ep = await open(page, SIXTY);
		const step = Math.round(await blocksPerPage(page));
		const short = (i: number) => Math.abs(i - step) <= 2;
		const lines = Array.from({ length: 60 }, (_, i) => (short(i) ? 'x' : para(i)));
		await ep.loadContent(lines.join('\n\n') + '\n');
		await ep.focusBlock(0, 20);
		await press(ep, page, 'Shift+PageDown');
		const first = await endOnScreen(page);
		expect(short(first.focus.path[0])).toBe(true);
		await press(ep, page, 'Shift+PageDown');
		const { focus } = await endOnScreen(page);
		expect(short(focus.path[0])).toBe(false);
		expect(Math.abs(focus.offset - 20)).toBeLessThanOrEqual(2);
	});
});

test.describe('from a caret in one block', () => {
	test('Shift+PageDown grows a range out of the block, a screen down', async ({ page }) => {
		const ep = await open(page, SIXTY);
		const perPage = await blocksPerPage(page);
		await ep.focusBlock(5, 5);
		await press(ep, page, 'Shift+PageDown');
		const end = await endOnScreen(page);
		expect(end.crossBlock).toBe(true);
		expect(end.anchor).toEqual({ path: [5], offset: 5 });
		expectPageStep(5, end.focus.path[0], perPage);
	});

	test('Shift+PageUp from a range inside the block keeps its anchor', async ({ page }) => {
		const ep = await open(page, SIXTY);
		const perPage = await blocksPerPage(page);
		await ep.focusBlock(40, 5);
		await press(ep, page, 'Shift+ArrowRight', 3);
		await press(ep, page, 'Shift+PageUp');
		const end = await endOnScreen(page);
		expect(end.anchor).toEqual({ path: [40], offset: 5 });
		expectPageStep(40, end.focus.path[0], perPage);
	});

	test('Shift+PageUp in the first screen stops on the first block', async ({ page }) => {
		const ep = await open(page, SIXTY);
		await ep.focusBlock(2, 5);
		await press(ep, page, 'Shift+PageUp');
		const end = await endOnScreen(page);
		expect(end.focus.path).toEqual([0]);
	});
});

test.describe('into a container and a table', () => {
	test("Shift+PageDown steps into a quote's paragraphs and on through them", async ({ page }) => {
		const ep = await open(page, QUOTED);
		await ep.focusBlockEnd(5);
		await press(ep, page, 'Shift+PageDown', 2);
		const first = await endOnScreen(page);
		expect(first.focus.path).toHaveLength(2);
		expect(first.focus.path[0]).toBe(20);
		await press(ep, page, 'Shift+PageDown');
		const second = await endOnScreen(page);
		expect(second.focus.path[0]).toBe(20);
		expect(second.focus.path[1]).toBeGreaterThan(first.focus.path[1]);
	});

	test('a focus in a table steps a screen of rows', async ({ page }) => {
		const ep = await open(page, TABLE);
		await ep.focusBlockEnd(0);
		await press(ep, page, 'Shift+ArrowDown', 6);
		const before = await endOnScreen(page);
		expect(before.focus).toMatchObject({ path: [1], offset: 5 });
		await press(ep, page, 'Shift+PageDown');
		const end = await endOnScreen(page);
		expect(end.focus.path).toEqual([1]);
		expect(end.focus.offset).toBeGreaterThan(before.focus.offset + 5);
	});
});
