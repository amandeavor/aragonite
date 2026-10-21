import { test, expect } from '../../fixtures';
import type { Page } from '@playwright/test';
import { EditorPage } from '../../editor-page';
import { isMacOS } from '../../platform-keys';

// PageUp and PageDown move the caret a screen up or down, out of its block, and a range collapses
// to where its moving end would step. Requirements: `e2e/requirements/keyboard-navigation/page-keys.md`.

// On a Mac the page keys scroll and leave the caret where it is, which the browser does itself.
test.skip(isMacOS, 'the page keys move no caret on macOS');

const para = (i: number) => `paragraph ${i} with a few words in it`;
const paragraphs = (count: number) =>
	Array.from({ length: count }, (_, i) => para(i)).join('\n\n') + '\n';
const SIXTY = paragraphs(60);

interface Caret {
	path: number[];
	offset: number;
	collapsed: boolean;
	onScreen: boolean;
}

/** Where the caret is, whether the selection is collapsed, and whether its line shows (a pixel of
 *  slack for a line box that rounds across the edge). */
function caret(page: Page): Promise<Caret> {
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
		const collapsed =
			JSON.stringify(sel.anchor) === JSON.stringify(sel.focus) && !t.isCrossBlockSelection();
		return {
			path,
			offset,
			collapsed,
			onScreen: !!box && box.top >= Math.max(0, port.top) - 1 && box.bottom <= port.bottom + 1
		};
	});
}

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

async function caretOnScreen(page: Page): Promise<Caret> {
	await expect.poll(async () => (await caret(page)).onScreen).toBe(true);
	return caret(page);
}

function expectPageStep(from: number, to: number, perPage: number): void {
	expect(Math.abs(Math.abs(to - from) - perPage)).toBeLessThanOrEqual(1.5);
}

async function open(page: Page, doc: string): Promise<EditorPage> {
	const ep = new EditorPage(page);
	await ep.goto();
	await ep.loadContent(doc);
	return ep;
}

test.describe('the page keys from a caret', () => {
	for (const [key, start] of [
		['PageDown', 5],
		['PageUp', 40]
	] as const) {
		test(`${key} moves the caret a screen, and a letter types there`, async ({ page }) => {
			const ep = await open(page, SIXTY);
			const perPage = await blocksPerPage(page);
			await ep.focusBlock(start, 5);
			await press(ep, page, key);
			const at = await caretOnScreen(page);
			expect(at.collapsed).toBe(true);
			expectPageStep(start, at.path[0], perPage);
			await page.keyboard.type('Z');
			const lines = (await ep.bridge.getSource()).split('\n\n');
			expect(lines.findIndex((line) => line.includes('Z'))).toBe(at.path[0]);
		});
	}

	test('PageDown near the end stops on the last block', async ({ page }) => {
		const ep = await open(page, SIXTY);
		await ep.focusBlock(55, 5);
		await press(ep, page, 'PageDown');
		expect((await caretOnScreen(page)).path).toEqual([59]);
	});

	// The first press lands on a run of one-letter lines, the second past them on long ones again.
	test('repeated presses keep their column across a short line', async ({ page }) => {
		const ep = await open(page, SIXTY);
		const step = Math.round(await blocksPerPage(page));
		const short = (i: number) => Math.abs(i - step) <= 2;
		const lines = Array.from({ length: 60 }, (_, i) => (short(i) ? 'x' : para(i)));
		await ep.loadContent(lines.join('\n\n') + '\n');
		await ep.focusBlock(0, 20);
		await press(ep, page, 'PageDown');
		expect(short((await caretOnScreen(page)).path[0])).toBe(true);
		await press(ep, page, 'PageDown');
		const at = await caretOnScreen(page);
		expect(short(at.path[0])).toBe(false);
		expect(Math.abs(at.offset - 20)).toBeLessThanOrEqual(2);
	});

	// A held key's repeat can reach the block before the step it follows has landed; two keydowns
	// sent in one task are that repeat, which a real press, sent a task apart, never is.
	test('a PageDown sent before the last one landed steps on from where it lands', async ({
		page
	}) => {
		const ep = await open(page, paragraphs(200));
		const perPage = await blocksPerPage(page);
		await ep.focusBlock(2, 5);
		await page.evaluate(() => {
			const init = { key: 'PageDown', bubbles: true, cancelable: true };
			for (let i = 0; i < 2; i++)
				document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', init));
		});
		await ep.waitForRenderFlush();
		const at = await caretOnScreen(page);
		expect(at.collapsed).toBe(true);
		expectPageStep(2, at.path[0], 2 * perPage);
	});

	// Two columns, so a row's cells sit side by side and the step has to keep to one of them.
	test('PageDown in a table cell moves a screen of rows down its column', async ({ page }) => {
		const rows = Array.from({ length: 60 }, (_, i) => `| cell ${i} | x ${i} |`);
		const ep = await open(page, `intro\n\n| H | I |\n| - | - |\n${rows.join('\n')}\n\nafter\n`);
		await ep.focusBlockAtPath([1, 2, 1], 1);
		await press(ep, page, 'PageDown');
		const at = await caretOnScreen(page);
		expect(at.collapsed).toBe(true);
		expect(at.path[2]).toBe(1);
		expect(at.path[1]).toBeGreaterThan(7);
		await page.keyboard.type('Z');
		expect(await ep.bridge.getSource()).toMatch(/\| cell \d+ \| x?Zx? \d+ \|/);
	});
});

test.describe('the page keys over a range', () => {
	test('PageDown collapses a range across blocks a screen below its moving end', async ({
		page
	}) => {
		const ep = await open(page, SIXTY);
		const perPage = await blocksPerPage(page);
		await ep.focusBlockEnd(5);
		await press(ep, page, 'Shift+ArrowDown', 30);
		await press(ep, page, 'PageDown');
		const at = await caretOnScreen(page);
		expect(at.collapsed).toBe(true);
		expectPageStep(35, at.path[0], perPage);
	});

	test('PageUp collapses a range inside one block a screen above it', async ({ page }) => {
		const ep = await open(page, SIXTY);
		const perPage = await blocksPerPage(page);
		await ep.focusBlock(40, 5);
		await press(ep, page, 'Shift+ArrowRight', 3);
		await press(ep, page, 'PageUp');
		const at = await caretOnScreen(page);
		expect(at.collapsed).toBe(true);
		expectPageStep(40, at.path[0], perPage);
	});
});
