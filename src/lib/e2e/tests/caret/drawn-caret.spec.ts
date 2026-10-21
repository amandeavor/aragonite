import { test, expect } from '../../fixtures';
import type { Page } from '@playwright/test';
import { EditorPage } from '../../editor-page';
import { attachIme } from '../../simulation/ime';
import {
	caretsShowing,
	caretsUnderForcedColors,
	drawnBar,
	drawnCaretBox,
	expectBarBesideWidget,
	nativeCaretBox,
	setCaretProp,
	type CaretBox
} from '../../carets-showing';
import { MemoPage } from '../plugins/memo-helpers';
import { clickPastImageRightEdge, waitForFirstImageLoaded } from '../blocks/image/helpers';
import { PluginsPage } from '../plugins/helpers';
import { TABLE_THEN_FENCE, arriveAtBoundary } from '../selection/gap-caret-fixtures';
import { skipUnlessSupported } from '../../browser-engine';
import { edgeKey } from '../../platform-keys';

// The drawn caret against the browser's own (requirements/caret/drawn-caret.md): exactly one caret
// shows in every row, and where the bar draws, it sits on the browser's caret position.

const ONE_DRAWN = { native: false, drawn: 1 };
const ONE_NATIVE = { native: true, drawn: 0 };
const NONE = { native: false, drawn: 0 };

/** Each edge within a pixel, the rect a user would see as the same caret. Edges, not height: the
 *  bar snaps both ends outward to the device grid, 1.4px taller on Firefox's 25.6px empty line. */
function expectSameBox(drawn: CaretBox | null, native: CaretBox | null): void {
	expect(drawn, 'the drawn caret draws').not.toBeNull();
	expect(native, 'the browser holds a measurable caret').not.toBeNull();
	expect(
		Math.abs(drawn!.left - native!.left),
		`x ${drawn!.left} vs ${native!.left}`
	).toBeLessThanOrEqual(1);
	expect(
		Math.abs(drawn!.top - native!.top),
		`y ${drawn!.top} vs ${native!.top}`
	).toBeLessThanOrEqual(1);
	const drawnBottom = drawn!.top + drawn!.height;
	const nativeBottom = native!.top + native!.height;
	expect(
		Math.abs(drawnBottom - nativeBottom),
		`bottom ${drawnBottom} vs ${nativeBottom}`
	).toBeLessThanOrEqual(1);
}

/** Exactly one caret shows, and if it is the drawn one, on the browser's caret position. */
async function expectOneCaretOnTheRange(page: Page): Promise<void> {
	await expect.poll(() => caretsShowing(page)).toEqual(ONE_DRAWN);
	expectSameBox(await drawnCaretBox(page), await nativeCaretBox(page));
}

test.describe('the drawn caret', () => {
	let editor: EditorPage;

	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		await editor.goto();
	});

	test('a click in a paragraph draws one caret on the browser’s position', async ({ page }) => {
		await editor.loadContent('hello world\n');
		await editor.clickBlockAtPath([0], 5);
		await expectOneCaretOnTheRange(page);
	});

	test('typing keeps one drawn caret on the browser’s position after every key', async ({
		page
	}) => {
		await editor.loadContent('hello world\n');
		await editor.focusBlock(0, 5);
		for (const letter of 'abcdef') {
			await page.keyboard.type(letter);
			await expectOneCaretOnTheRange(page);
		}
		expect(await editor.bridge.getSource()).toBe('helloabcdef world\n');
	});

	test.describe('sits on the browser’s caret position', () => {
		const ROWS: Array<[string, string, (ep: EditorPage, page: Page) => Promise<void>]> = [
			['at the start of a line', 'hello world\n', (ep) => ep.focusBlock(0, 0)],
			['at the end of a line', 'hello world\n', (ep) => ep.focusBlock(0, 11)],
			[
				'in an empty block',
				'first\n',
				async (ep, page) => {
					await ep.focusBlock(0, 5);
					await page.keyboard.press('Enter');
				}
			],
			['in a heading', '# Title\n', (ep) => ep.focusBlock(0, 4)],
			['in a list item', '- item\n', (ep) => ep.focusBlockAtPath([0, 0, 0], 2)],
			['in a quote', '> quoted\n', (ep) => ep.focusBlockAtPath([0, 0], 3)],
			[
				'in a table cell',
				'| a | b |\n| - | - |\n| cell | d |\n',
				async (ep, page) => {
					await page.locator('.table-cell').nth(2).click();
					await page.keyboard.press(edgeKey('lineEnd'));
				}
			],
			['in a code block', '```\ncode\n```\n', (ep) => ep.focusBlock(0, 6)],
			[
				'in text right after an inline widget',
				'see :tada: after\n',
				(ep) => ep.focusBlock(0, 'see :tada: a'.length)
			],
			[
				'on the line a Shift+Enter at a block’s end opens',
				'Plan\n',
				async (ep, page) => {
					await ep.focusBlock(0, 4);
					await page.keyboard.press('Shift+Enter');
				}
			]
		];

		for (const [where, md, place] of ROWS) {
			test(where, async ({ page }) => {
				await editor.loadContent(md);
				await place(editor, page);
				await expectOneCaretOnTheRange(page);
			});
		}
	});

	test('focus leaving the editor shows no caret, and a click brings the drawn one back', async ({
		page
	}) => {
		await editor.loadContent('hello world\n');
		await editor.focusBlock(0, 3);
		await expect.poll(() => caretsShowing(page)).toEqual(ONE_DRAWN);
		await page.evaluate(() => (document.activeElement as HTMLElement).blur());
		await expect.poll(() => caretsShowing(page)).toEqual(NONE);
		await editor.clickBlockAtPath([0], 3);
		await expectOneCaretOnTheRange(page);
	});

	test('the window losing focus shows no caret, and regaining it shows the drawn one', async ({
		page
	}) => {
		await editor.loadContent('hello world\n');
		await editor.focusBlock(0, 3);
		await expect.poll(() => caretsShowing(page)).toEqual(ONE_DRAWN);
		// A headless page keeps its window focused, so the focus read and its events are stood in.
		await page.evaluate(() => {
			document.hasFocus = () => false;
			window.dispatchEvent(new FocusEvent('blur'));
		});
		await expect.poll(() => drawnCaretBox(page)).toBeNull();
		await page.evaluate(() => {
			document.hasFocus = () => true;
			window.dispatchEvent(new FocusEvent('focus'));
		});
		await expectOneCaretOnTheRange(page);
	});

	test('a range in one block shows no caret, and collapsing it shows the drawn one', async ({
		page
	}) => {
		await editor.loadContent('hello world\n');
		await editor.focusBlock(0, 5);
		await page.keyboard.press('Shift+ArrowLeft');
		await expect.poll(() => caretsShowing(page)).toEqual(NONE);
		await page.keyboard.press('ArrowRight');
		await expectOneCaretOnTheRange(page);
	});

	test('a cross-block range shows no caret', async ({ page }) => {
		await editor.loadContent('first\n\nsecond\n');
		await editor.focusBlockEnd(0);
		await page.keyboard.press('Shift+ArrowDown');
		await editor.waitForCrossBlock(true);
		await expect.poll(() => caretsShowing(page)).toEqual(NONE);
	});

	// The browser can't draw beside an image, so `native` leaves that caret to the editor too.
	test('under the native caret prop, the bar still draws beside an image', async ({ page }) => {
		await setCaretProp(page, 'native');
		await editor.loadContent('- ![pic|300x200](/test-fixtures/sample.png)\n');
		await waitForFirstImageLoaded(page);
		await clickPastImageRightEdge(page);
		await expect.poll(() => caretsShowing(page)).toEqual(ONE_DRAWN);
		await expectBarBesideWidget(page, page.locator('[data-image-widget]'), 'image');
		await page.keyboard.type('x');
		await expect.poll(() => caretsShowing(page)).toEqual(ONE_NATIVE);
	});

	test('typing mid-word writes nothing on the editable but what the render writes', async ({
		page
	}) => {
		await editor.loadContent('hello world\n');
		await editor.focusBlock(0, 3);
		await expect.poll(() => caretsShowing(page)).toEqual(ONE_DRAWN);
		await page.evaluate(() => {
			const written: string[] = [];
			(window as any).__written = written;
			new MutationObserver((records) =>
				written.push(...records.map((r) => r.attributeName ?? '?'))
			).observe(document.activeElement!, { attributes: true });
		});
		await page.keyboard.type('abc');
		await editor.bridge.waitForSourceContains('helabclo world');
		await expectOneCaretOnTheRange(page);
		expect(await page.evaluate(() => (window as any).__written)).toEqual([]);
	});

	test('the find bar keeps the browser’s caret', async ({ page }) => {
		await editor.loadContent('hello world\n');
		await editor.focusBlock(0, 3);
		await page.keyboard.press('ControlOrMeta+f');
		await page.keyboard.type('wor');
		await expect.poll(() => caretsShowing(page)).toEqual(ONE_NATIVE);
	});

	test('an IME composition shows the browser’s caret, and the commit the drawn one', async ({
		page
	}) => {
		await editor.loadContent('hello world\n');
		await editor.focusBlock(0, 5);
		const ime = await attachIme(page);
		await ime.compose('か');
		await expect.poll(() => caretsShowing(page)).toEqual(ONE_NATIVE);
		await ime.commit('かん');
		await editor.bridge.waitForSourceContains('helloかん world');
		await expectOneCaretOnTheRange(page);
	});

	test('reduced motion draws a caret that doesn’t blink', async ({ page }) => {
		skipUnlessSupported(page, 'mediaEmulation');
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await editor.loadContent('hello world\n');
		await editor.focusBlock(0, 3);
		// Each move switches the blink between its two keyframes, so both are read.
		for (const letter of ['x', 'y']) {
			await page.keyboard.type(letter);
			await expect.poll(() => caretsShowing(page)).toEqual(ONE_DRAWN);
			const animation = await page
				.locator('.md-drawn-caret')
				.evaluate((bar) => getComputedStyle(bar).animationName);
			expect(animation).toBe('none');
		}
	});

	test('reduced motion draws the widget and gap bars without a blink', async ({ page }) => {
		skipUnlessSupported(page, 'mediaEmulation');
		await page.emulateMedia({ reducedMotion: 'reduce' });
		const animation = async () => {
			const bar = await drawnBar(page);
			expect(bar?.state).not.toBe('text');
			return page.locator('.md-drawn-caret').evaluate((el) => getComputedStyle(el).animationName);
		};
		await editor.loadContent('- ![pic|300x200](/test-fixtures/sample.png)\n');
		await waitForFirstImageLoaded(page);
		await clickPastImageRightEdge(page);
		await expect.poll(async () => (await drawnBar(page))?.state).toBe('widget');
		expect(await animation()).toBe('none');

		await editor.loadContent(TABLE_THEN_FENCE);
		await arriveAtBoundary(editor);
		await expect.poll(async () => (await drawnBar(page))?.state).toBe('gap');
		expect(await animation()).toBe('none');
	});

	test.describe('forced colors', () => {
		// WebKit has no forced-colors mode (the query always matches none); Playwright only flips it.
		test.skip(({ browserName }) => browserName === 'webkit', 'no forced-colors mode in WebKit');

		test('forced colors keep the browser’s caret', async ({ page }) => {
			skipUnlessSupported(page, 'mediaEmulation');
			await page.emulateMedia({ forcedColors: 'active' });
			await editor.loadContent('hello world\n');
			await editor.focusBlock(0, 3);
			await page.keyboard.type('x');
			await expect.poll(() => caretsShowing(page)).toEqual(ONE_NATIVE);
		});

		// The browser shows its own caret in the gap proxy under forced colors, so the editor's bar
		// there would be a second one.
		test('forced colors show one caret at a gap', async ({ page }) => {
			await page.emulateMedia({ forcedColors: 'active' });
			await editor.loadContent(TABLE_THEN_FENCE);
			await arriveAtBoundary(editor);
			const gap = (await page.locator('[data-gap-caret]').boundingBox())!;
			const across = { x: gap.x - 10, y: gap.y - 20, width: 600, height: 40 };
			expect(await caretsUnderForcedColors(page, across)).toBe(1);
		});
	});

	test('the caret prop: native never draws, drawn draws, and a live switch swaps in place', async ({
		page
	}) => {
		await editor.loadContent('hello world\n');
		await editor.focusBlock(0, 3);
		await expect.poll(() => caretsShowing(page)).toEqual(ONE_DRAWN);
		await setCaretProp(page, 'native');
		await expect.poll(() => caretsShowing(page)).toEqual(ONE_NATIVE);
		await page.keyboard.type('x');
		await expect.poll(() => caretsShowing(page)).toEqual(ONE_NATIVE);
		await setCaretProp(page, 'drawn');
		await expectOneCaretOnTheRange(page);
	});

	test('the bar is hidden from assistive tech and leaves the selection alone', async ({ page }) => {
		await editor.loadContent('hello world\n');
		await editor.focusBlock(0, 3);
		await expect.poll(() => caretsShowing(page)).toEqual(ONE_DRAWN);
		const bar = page.locator('.md-drawn-caret');
		await expect(bar).toHaveAttribute('aria-hidden', 'true');
		const snapshot = await page.locator('.editor').ariaSnapshot();
		expect(snapshot).not.toContain('md-drawn-caret');
		const read = await page.evaluate(() => {
			const sel = window.getSelection()!;
			return {
				active: document.activeElement?.className,
				node: sel.anchorNode?.textContent,
				offset: sel.anchorOffset,
				inBar: !!(sel.anchorNode as Element | null)?.parentElement?.closest('.md-drawn-caret')
			};
		});
		expect(read).toEqual({
			active: expect.stringContaining('text-editable-block'),
			node: 'hello world',
			offset: 3,
			inBar: false
		});
	});

	test.describe('on a coarse pointer', () => {
		test.use({ hasTouch: true });

		test('keeps the browser’s caret', async ({ page }) => {
			skipUnlessSupported(page, 'touch');
			await editor.loadContent('hello world\n');
			await editor.focusBlock(0, 3);
			await expect.poll(() => caretsShowing(page)).toEqual(ONE_NATIVE);
		});
	});
});

test.describe('the drawn caret in a plugin’s editable leaf', () => {
	let memo: MemoPage;

	test.beforeEach(async ({ page }) => {
		memo = new MemoPage(page);
		await memo.gotoSeed();
	});

	test('sits on the browser’s caret position', async ({ page }) => {
		await memo.memo.click();
		await page.keyboard.press(edgeKey('lineEnd'));
		await expectOneCaretOnTheRange(page);
	});
});

test.describe('the drawn caret beside a text-height widget, under forced colors', () => {
	// WebKit has no forced-colors mode (the query always matches none); Playwright only flips it.
	test.skip(({ browserName }) => browserName === 'webkit', 'no forced-colors mode in WebKit');

	test.beforeEach(async ({ page }) => {
		await new PluginsPage(page).gotoPlugins('emoji');
	});

	// The browser shows its own caret beside a text-height widget under forced colors, so the
	// editor's bar there would be a second one.
	test('shows one caret', async ({ page }) => {
		await page.emulateMedia({ forcedColors: 'active' });
		await new PluginsPage(page).loadContent('Some prose on this line :tada:\n');
		const widget = (await page.locator('[data-inline-widget]').boundingBox())!;
		await page.mouse.click(widget.x + widget.width + 30, widget.y + widget.height / 2);
		const around = { x: widget.x - 10, y: widget.y - 10, width: widget.width + 60, height: 40 };
		expect(await caretsUnderForcedColors(page, around)).toBe(1);
	});
});
