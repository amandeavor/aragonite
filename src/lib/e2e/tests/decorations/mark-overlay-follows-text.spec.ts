import { test, expect } from '../../fixtures';
import type { Page } from '@playwright/test';
import { EditorPage } from '../../editor-page';
import type { PresentationMode } from '../../../presentation-mode';
import { textRunEnd, textRunStart } from '../../text-runs';
import { findInput, openFind, typeQuery } from '../search/helpers';
import { PluginsPage, clickWidgetCenter } from '../plugins/helpers';

/**
 * A mark's overlay moves with its text when hiding or showing markers moves the text without
 * resizing the block (requirements/decorations/mark-overlay-follows-text.md).
 */

const DOC = '**bold** hello world\n\nother line\n';

type Paint = 'plain mark' | 'search highlight';

const OVERLAY: Record<Paint, string> = {
	'plain mark': '.decoration-overlay.e2e-follow',
	'search highlight': '.decoration-overlay.match-overlay'
};

async function paint(editor: EditorPage, page: Page, kind: Paint): Promise<void> {
	if (kind === 'plain mark') {
		// Raw 9..14 is `hello`, past the bold's four marker bytes.
		await page.evaluate(() => {
			(window as any).__test.decorations.addSource({
				name: 'e2e-follow',
				provide: () => [{ type: 'mark', path: [0], start: 9, end: 14, class: 'e2e-follow' }]
			});
		});
	} else {
		await openFind(editor);
		await typeQuery(editor, 'hello');
		await expect(findInput(page)).toHaveValue('hello');
	}
	await expect(page.locator(OVERLAY[kind])).toHaveCount(1);
	// Past the first resize notification, which re-measures on its own and would hide a stale paint.
	await editor.waitForRenderFlush();
	await editor.waitForRenderFlush();
}

/** How far the overlay's left and right edges sit from the painted `hello`, read in one frame. */
async function drift(page: Page, selector: string): Promise<number | null> {
	return page.evaluate((sel) => {
		const box = document.querySelector(sel)?.getBoundingClientRect();
		const run = (window as any).__test.textRunRect('hello', [0]);
		if (!box || !run) return null;
		return Math.max(Math.abs(box.left - run.left), Math.abs(box.right - run.right));
	}, selector);
}

async function expectOverlayOnText(page: Page, kind: Paint): Promise<void> {
	await expect.poll(() => drift(page, OVERLAY[kind]), { timeout: 2000 }).toBeLessThanOrEqual(1);
}

/** Where `hello` starts, so a row can show the step moved the text at all. */
async function helloLeft(page: Page): Promise<number> {
	return page.evaluate(() => (window as any).__test.textRunRect('hello', [0]).left);
}

// Live and reading hide the same markers, so a flip between them moves no text; a flip away from a
// focused preview block blurs it first, which the preview-block focus row covers.
const FLIPS: [PresentationMode, PresentationMode][] = [
	['source', 'live'],
	['live', 'source'],
	['source', 'reading'],
	['reading', 'source'],
	['source', 'preview-block'],
	['source', 'preview-inline']
];

const PAINTS: Paint[] = ['plain mark', 'search highlight'];

test.describe('mark overlay follows its text', () => {
	let editor: EditorPage;

	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		await editor.goto();
	});

	for (const [from, to] of FLIPS) {
		for (const kind of PAINTS) {
			test(`a ${kind} sits on its text after a flip from ${from} to ${to}`, async ({ page }) => {
				await editor.setPresentationMode(from);
				await editor.loadContent(DOC);
				await paint(editor, page, kind);
				await expectOverlayOnText(page, kind);
				const before = await helloLeft(page);

				await editor.setPresentationMode(to);
				await editor.waitForRenderFlush();
				expect(await helloLeft(page), 'the flip moves the text').not.toBeCloseTo(before, 0);
				await expectOverlayOnText(page, kind);
			});
		}
	}

	test('in preview-inline, the caret entering and leaving the bold moves the overlay with the text', async ({
		page
	}) => {
		await editor.setPresentationMode('preview-inline');
		await editor.loadContent(DOC);
		await paint(editor, page, 'plain mark');
		const end = await textRunEnd(page, 'world');
		await page.mouse.click(end.x, end.y);
		await editor.waitForRenderFlush();
		const hidden = await helloLeft(page);
		await expectOverlayOnText(page, 'plain mark');

		await page.keyboard.press('Home');
		await editor.waitForRenderFlush();
		expect(await helloLeft(page), 'entering the bold shows its markers').toBeGreaterThan(hidden);
		await expectOverlayOnText(page, 'plain mark');

		await page.keyboard.press('End');
		await editor.waitForRenderFlush();
		expect(await helloLeft(page), 'leaving the bold hides them').toBeCloseTo(hidden, 0);
		await expectOverlayOnText(page, 'plain mark');
	});

	test('in preview-block, focusing the block and leaving it moves the overlay with the text', async ({
		page
	}) => {
		await editor.setPresentationMode('preview-block');
		await editor.loadContent(DOC);
		await paint(editor, page, 'plain mark');
		const hidden = await helloLeft(page);

		const end = await textRunEnd(page, 'world');
		await page.mouse.click(end.x, end.y);
		await editor.waitForRenderFlush();
		expect(await helloLeft(page), 'focusing the block shows its markers').toBeGreaterThan(hidden);
		await expectOverlayOnText(page, 'plain mark');

		const other = await textRunEnd(page, 'line');
		await page.mouse.click(other.x, other.y);
		await editor.waitForRenderFlush();
		expect(await helloLeft(page), 'leaving the block hides them').toBeCloseTo(hidden, 0);
		await expectOverlayOnText(page, 'plain mark');
	});

	test('a theme change whose styles widen the bold moves the overlay with the text', async ({
		page
	}) => {
		await page.addStyleTag({
			content: ".editor[data-editor-theme='light'] strong { letter-spacing: 4px; }"
		});
		await editor.loadContent(DOC);
		await paint(editor, page, 'plain mark');
		const before = await helloLeft(page);

		await page.getByTestId('header-theme-toggle').click();
		await expect(editor.editorContainer).toHaveAttribute('data-editor-theme', 'light');
		await editor.waitForRenderFlush();
		expect(await helloLeft(page), 'the wider bold pushes the text right').toBeGreaterThan(before);
		await expectOverlayOnText(page, 'plain mark');
	});

	test('a cross-block selection starting at the mark’s word stays on it after a flip from source to live', async ({
		page
	}) => {
		await editor.loadContent(DOC);
		const start = await textRunStart(page, 'hello');
		await page.mouse.click(start.x, start.y);
		// The first press reaches the line's end, the second crosses into the next block.
		await page.keyboard.press('Shift+ArrowDown');
		await page.keyboard.press('Shift+ArrowDown');
		await expect
			.poll(() => editor.bridge.getSelectionPaths())
			.toMatchObject({ focus: { path: [1] } });
		const endpoint = page.locator('[data-block-path="[0]"] .selection-overlay-endpoint');
		await expect(endpoint).toHaveCount(1);
		await editor.waitForRenderFlush();
		await editor.waitForRenderFlush();

		await editor.setPresentationMode('live');
		await editor.waitForRenderFlush();
		await expect(endpoint).toHaveCount(1);
		await expect
			.poll(
				() =>
					page.evaluate(() => {
						const box = document
							.querySelector('[data-block-path="[0]"] .selection-overlay-endpoint')!
							.getBoundingClientRect();
						return Math.abs(box.left - (window as any).__test.textRunRect('hello', [0]).left);
					}),
				{ timeout: 2000 }
			)
			.toBeLessThanOrEqual(1);
	});

	test('in live mode, a mark over a block of bare markers paints while the block holds the caret', async ({
		page
	}) => {
		await editor.setPresentationMode('live');
		await editor.loadContent('[]()\n\nother line\n');
		await page.evaluate(() => {
			(window as any).__test.decorations.addSource({
				name: 'e2e-follow',
				provide: () => [{ type: 'mark', path: [0], start: 0, end: 4, class: 'e2e-follow' }]
			});
		});
		const overlay = page.locator(OVERLAY['plain mark']);
		// Hidden markers have no width, so the mark paints nothing until they show.
		await expect(overlay).toHaveCount(0);
		await editor.waitForRenderFlush();
		await editor.waitForRenderFlush();

		await editor.clickBlock(0);
		await expect
			.poll(() =>
				page.evaluate(() => {
					// One rect per marker run on each side, so both sides compare their outer edges.
					const span = (sel: string) => {
						const rects = [...document.querySelectorAll(sel)].map((el) =>
							el.getBoundingClientRect()
						);
						if (rects.length === 0) return null;
						return {
							left: Math.min(...rects.map((r) => r.left)),
							right: Math.max(...rects.map((r) => r.right))
						};
					};
					const painted = span('.decoration-overlay.e2e-follow');
					const markers = span('[data-block-path="[0]"] .md-marker');
					if (!painted || !markers) return null;
					return Math.max(
						Math.abs(painted.left - markers.left),
						Math.abs(painted.right - markers.right)
					);
				})
			)
			.toBeLessThanOrEqual(1);

		const other = await textRunEnd(page, 'line');
		await page.mouse.click(other.x, other.y);
		await expect(overlay).toHaveCount(0);
	});
});

test.describe('mark overlay follows its text across a widget showing its source', () => {
	// Raw 19..24 is `hello`, after a formula that renders narrower than its source.
	const MATH_DOC = 'Before $x^2$ after hello\n\nNext\n';
	let editor: PluginsPage;

	test.beforeEach(async ({ page }) => {
		editor = new PluginsPage(page);
		await editor.gotoPlugins('math');
		await editor.loadContent(MATH_DOC);
		await page.evaluate(() => {
			(window as any).__test.decorations.addSource({
				name: 'e2e-follow',
				provide: () => [{ type: 'mark', path: [0], start: 19, end: 24, class: 'e2e-follow' }]
			});
		});
		await expect(page.locator(OVERLAY['plain mark'])).toHaveCount(1);
		await editor.waitForRenderFlush();
		await editor.waitForRenderFlush();
	});

	test('clicking a formula shows its source, and the overlay moves with the text after it', async ({
		page
	}) => {
		const rendered = await helloLeft(page);

		await clickWidgetCenter(page.locator('.math-inline-widget'));
		await expect(page.locator('.math-inline-widget')).toHaveCount(0);
		await editor.waitForRenderFlush();
		expect(await helloLeft(page), 'the source is wider than the formula').toBeGreaterThan(rendered);
		await expectOverlayOnText(page, 'plain mark');
	});

	// Leaving for another block folds through the blur; a click later in the line folds in place.
	for (const [how, word] of [
		['clicking another block', 'Next'],
		['clicking later in the line', 'after']
	]) {
		test(`${how} renders the formula again, and the overlay moves back with the text`, async ({
			page
		}) => {
			const rendered = await helloLeft(page);
			await clickWidgetCenter(page.locator('.math-inline-widget'));
			await expect(page.locator('.math-inline-widget')).toHaveCount(0);
			await expectOverlayOnText(page, 'plain mark');

			const away = await textRunEnd(page, word);
			await page.mouse.click(away.x, away.y);
			await expect(page.locator('.math-inline-widget')).toHaveCount(1);
			await editor.waitForRenderFlush();
			expect(await helloLeft(page), 'the formula is back').toBeCloseTo(rendered, 0);
			await expectOverlayOnText(page, 'plain mark');
		});
	}
});
