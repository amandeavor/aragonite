import { test, expect } from '../../fixtures';
import type { Page } from '@playwright/test';
import { EditorPage } from '../../editor-page';
import { browserCaret, drawnCaretMarks, setCaretProp } from '../../carets-showing';
import { TABLE_THEN_FENCE, arriveAtBoundary } from '../selection/gap-caret-fixtures';

// The drawn caret on the device pixel grid, and in the color of the text it stands in
// (requirements/caret/drawn-caret-pixels.md).

/** A line height that puts the second block's lines between pixels. */
const OFF_GRID = '.editor .text-editable-block { line-height: 1.37; }';

/** Two frames, so a paint armed by the last event has run. */
function nextFrames(page: Page): Promise<unknown> {
	return page.evaluate(
		() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))
	);
}

interface Edges {
	left: number;
	top: number;
	right: number;
	bottom: number;
}

interface BarPixels {
	dpr: number;
	state: string;
	/** The bar's box before any slant: a slant leans from its foot, which stays put. */
	bar: Edges;
	/** The strikethrough tick's box, or null when none draws. */
	tick: Edges | null;
	color: string;
	/** The caret's x, and the color of the element holding it. */
	caretLeft: number;
	caretTop: number;
	textColor: string;
}

function barPixels(page: Page): Promise<BarPixels> {
	return page.evaluate(() => {
		const el = document.querySelector<HTMLElement>('.md-drawn-caret')!;
		const style = getComputedStyle(el);
		const r = el.getBoundingClientRect();
		const width = parseFloat(style.width);
		const bar = { left: r.left, top: r.top, right: r.left + width, bottom: r.bottom };
		const after = getComputedStyle(el, '::after');
		const ticked = after.content !== 'none' && after.content !== 'normal';
		const tickLeft = bar.left + parseFloat(after.left);
		const tickTop = bar.top + parseFloat(after.top);
		const tick = ticked
			? {
					left: tickLeft,
					top: tickTop,
					right: tickLeft + parseFloat(after.width),
					bottom: tickTop + parseFloat(after.height)
				}
			: null;
		const range = window.getSelection()!.getRangeAt(0);
		const caret = range.getClientRects()[0] ?? range.getBoundingClientRect();
		const node = range.startContainer;
		const holder = node instanceof Element ? node : node.parentElement!;
		return {
			dpr: window.devicePixelRatio,
			state: el.dataset.caretState ?? '',
			bar,
			tick,
			color: style.backgroundColor,
			caretLeft: caret.left,
			caretTop: caret.top,
			textColor: getComputedStyle(holder).color
		};
	});
}

/** A length in device pixels, to the whole pixel the layout's 1/64px units leave it within. */
function devicePixels(css: number, dpr: number): number {
	const device = css * dpr;
	return Math.abs(device - Math.round(device)) < 0.05 ? Math.round(device) : device;
}

function expectOnGrid(edges: Edges, dpr: number, what: string): void {
	for (const side of ['left', 'top', 'right', 'bottom'] as const) {
		const device = edges[side] * dpr;
		expect(
			Math.abs(device - Math.round(device)),
			`${what} ${side} at device pixel ${device}`
		).toBeLessThan(0.05);
	}
}

/** A length token rounded to the nearest whole device pixel, at least one, as the browser's own
 *  caret width is. */
function deviceWidth(css: number, dpr: number): number {
	return Math.max(1, Math.round(css * dpr));
}

/** Puts the caret after the first letter of `word` in the second block, one key at a time. */
async function caretInWord(editor: EditorPage, line: string, word: string): Promise<void> {
	await editor.clickBlock(1);
	await editor.page.keyboard.press('Home');
	for (let i = 0; i <= line.indexOf(word); i++) await editor.page.keyboard.press('ArrowRight');
	await nextFrames(editor.page);
}

for (const scale of [1, 1.25, 1.5]) {
	test.describe(`the drawn caret at a device pixel ratio of ${scale}`, () => {
		test.use({ deviceScaleFactor: scale });

		test('a plain bar sits on whole device pixels, as wide as the browser’s, in the letter boundary’s column', async ({
			page,
			browserName
		}) => {
			const editor = new EditorPage(page);
			await editor.goto();
			await editor.loadContent('first\n\nWide mill thrift right hill bravo quiet\n');
			await page.addStyleTag({ content: OFF_GRID });
			await editor.clickBlock(1);
			await page.keyboard.press('Home');
			let offGridCarets = 0;
			for (let i = 0; i < 12; i++) {
				await page.keyboard.press('ArrowRight');
				await nextFrames(page);
				await expect.poll(() => drawnCaretMarks(page)).toEqual([]);
				const px = await barPixels(page);
				const caretX = px.caretLeft * scale;
				if (Math.abs(caretX - Math.round(caretX)) > 0.05) offGridCarets++;
				expectOnGrid(px.bar, scale, `step ${i}`);
				expect(devicePixels(px.bar.right - px.bar.left, scale), 'the browser’s caret width').toBe(
					deviceWidth(1, scale)
				);
				expect(
					Math.round(px.bar.left * scale),
					`the column the boundary at ${caretX} falls in`
				).toBe(Math.floor(caretX + 0.001));
			}
			const lineTop = (await barPixels(page)).caretTop * scale;
			// WebKit measures the range in whole pixels, so at 1x every boundary lands on one.
			if (browserName !== 'webkit' || scale !== 1) {
				expect(offGridCarets, 'some boundaries fall between device pixels').toBeGreaterThan(0);
			}
			expect(Math.abs(lineTop - Math.round(lineTop)), 'the line sits off the grid').toBeGreaterThan(
				0.05
			);
		});

		test('the bold, italic and strikethrough shapes keep the device grid', async ({ page }) => {
			const LINE = 'a **bold** *slant* ~~gone~~ z';
			const editor = new EditorPage(page);
			await editor.goto();
			await editor.loadContent(`first\n\n${LINE}\n`);
			await page.addStyleTag({ content: OFF_GRID });
			for (const [word, mark, width] of [
				['bold', 'strong', 3],
				['slant', 'emphasis', 1],
				['gone', 'strikethrough', 1]
			] as const) {
				await test.step(word, async () => {
					await caretInWord(editor, LINE, word);
					await expect.poll(() => drawnCaretMarks(page)).toEqual([mark]);
					const px = await barPixels(page);
					expectOnGrid(px.bar, scale, `the ${mark} bar`);
					expect(devicePixels(px.bar.right - px.bar.left, scale)).toBe(deviceWidth(width, scale));
					if (mark !== 'strikethrough') return;
					expectOnGrid(px.tick!, scale, 'the tick');
					expect(devicePixels(px.tick!.right - px.tick!.left, scale)).toBe(deviceWidth(13, scale));
					expect(devicePixels(px.tick!.bottom - px.tick!.top, scale)).toBe(deviceWidth(2, scale));
				});
			}
		});

		test('the gap bar’s top and thickness sit on whole device pixels', async ({ page }) => {
			const editor = new EditorPage(page);
			await editor.goto();
			await editor.loadContent(TABLE_THEN_FENCE);
			await page.addStyleTag({ content: OFF_GRID });
			await arriveAtBoundary(editor);
			await expect.poll(async () => (await barPixels(page)).state).toBe('gap');
			const { bar } = await barPixels(page);
			expectOnGrid({ ...bar, left: 0, right: 0 }, scale, 'the gap bar');
			expect(devicePixels(bar.bottom - bar.top, scale)).toBe(deviceWidth(2, scale));
		});
	});
}

test.describe('the drawn caret’s color', () => {
	const LINE = 'plain [link](u) **strong** end';

	test('is the color of the text it stands in, in a paragraph, a heading, a link and bold', async ({
		page
	}) => {
		const editor = new EditorPage(page);
		await editor.goto();
		await editor.loadContent(`# heading here\n\n${LINE}\n`);
		await page.addStyleTag({
			content: `
				.editor { --syntax-heading: rgb(40, 90, 200); }
				.editor .paragraph-block { color: rgb(200, 40, 40); }
				.editor a.md-link-content { color: rgb(30, 160, 60); }
				.editor strong { color: rgb(170, 60, 190); }`
		});
		await editor.clickBlock(0);
		await page.keyboard.press('End');
		await nextFrames(page);
		const heading = await barPixels(page);
		expect(heading.textColor, 'the heading’s text').toBe('rgb(40, 90, 200)');
		expect(heading.color, 'in the heading').toBe('rgb(40, 90, 200)');

		for (const [word, color] of [
			['plain', 'rgb(200, 40, 40)'],
			['link', 'rgb(30, 160, 60)'],
			['strong', 'rgb(170, 60, 190)']
		] as const) {
			await caretInWord(editor, LINE, word);
			const px = await barPixels(page);
			expect(px.textColor, `the text around ${word}`).toBe(color);
			expect(px.color, `in ${word}`).toBe(color);
		}
	});

	test('is the theme’s when it sets --md-caret-color', async ({ page }) => {
		const editor = new EditorPage(page);
		await editor.goto();
		await editor.loadContent(`first\n\n${LINE}\n`);
		await page.addStyleTag({
			content: `.editor { --md-caret-color: rgb(1, 2, 3); }
				.editor a.md-link-content { color: rgb(30, 160, 60); }`
		});
		for (const word of ['plain', 'link']) {
			await caretInWord(editor, LINE, word);
			expect((await barPixels(page)).color, `in ${word}`).toBe('rgb(1, 2, 3)');
		}
	});
});

test('at 1x the bar stands in the browser’s own caret column at every letter boundary', async ({
	page,
	browserName
}) => {
	test.skip(
		browserName === 'webkit',
		'WebKit reports the range in whole pixels, losing the fraction its caret rounds'
	);
	const editor = new EditorPage(page);
	await editor.goto();
	await editor.loadContent('first\n\nWide mill thrift right hill bravo quiet\n');
	const STEPS = 12;
	const drawn: number[] = [];
	await editor.clickBlock(1);
	await page.keyboard.press('Home');
	for (let i = 0; i < STEPS; i++) {
		await page.keyboard.press('ArrowRight');
		await nextFrames(page);
		drawn.push(Math.round((await barPixels(page)).bar.left));
	}
	const painted: number[] = [];
	await setCaretProp(page, 'native');
	await page.keyboard.press('Home');
	for (let i = 0; i < STEPS; i++) {
		await page.keyboard.press('ArrowRight');
		painted.push((await browserCaret(page)).left);
	}
	expect(drawn).toEqual(painted);
});
