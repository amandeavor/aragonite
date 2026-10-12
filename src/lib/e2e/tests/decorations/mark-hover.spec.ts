import { test, expect } from '../../fixtures';
import type { Page } from '@playwright/test';
import { EditorPage } from '../../editor-page';
import { FIXTURE_BYTES } from '../perf/vr-helpers';

/**
 * Mark hover (requirements/decorations/mark-hover.md). Each source records its `onHover` calls on
 * `window.__hovers`, an anchor as plain numbers and an end as null, so a spec reads the whole run.
 */

type Recorded = { cls: string; anchor: { left: number; top: number; width: number } | null };

interface MarkSpec {
	path: number[];
	start: number;
	end: number;
	cls: string;
}

/** Registers a hover source whose marks the page can swap with `window.__setMarks(name, marks)`. */
async function addHoverSource(page: Page, name: string, marks: MarkSpec[]): Promise<void> {
	await page.evaluate(
		({ name, marks }) => {
			const w = window as any;
			w.__hovers ??= [];
			w.__marks ??= {};
			w.__marks[name] = marks;
			w.__setMarks = (source: string, next: MarkSpec[]) => {
				w.__marks[source] = next;
				w.__test.decorations.invalidateSource(source);
			};
			w.__test.decorations.addSource({
				name,
				provide: () =>
					w.__marks[name].map((m: MarkSpec) => ({
						type: 'mark',
						path: m.path,
						start: m.start,
						end: m.end,
						class: m.cls,
						interactive: {
							onHover: (dec: { class: string }, hover: { anchor: DOMRect } | null) => {
								w.__hovers.push({
									cls: dec.class,
									anchor: hover
										? { left: hover.anchor.left, top: hover.anchor.top, width: hover.anchor.width }
										: null
								});
							}
						}
					}))
			});
		},
		{ name, marks }
	);
}

function hovers(page: Page): Promise<Recorded[]> {
	return page.evaluate(() => [...((window as any).__hovers ?? [])]);
}

async function centerOf(page: Page, selector: string, nth = 0): Promise<{ x: number; y: number }> {
	const box = (await page.locator(selector).nth(nth).boundingBox())!;
	return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Somewhere on the page no mark covers: the harness's top-left corner, above the editor. */
async function moveAway(page: Page): Promise<void> {
	await page.mouse.move(2, 2, { steps: 4 });
}

/** The run so far, once it has stopped changing for two reads in a row. */
async function settledHovers(page: Page): Promise<Recorded[]> {
	let last = JSON.stringify(await hovers(page));
	await expect
		.poll(async () => {
			const now = JSON.stringify(await hovers(page));
			const stable = now === last;
			last = now;
			return stable;
		})
		.toBe(true);
	return hovers(page);
}

test.describe('mark hover', () => {
	let editor: EditorPage;

	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		await editor.goto();
	});

	test('entering a one-line mark reports its rect, and leaving reports one end', async ({
		page
	}) => {
		await editor.loadContent('hello world\n');
		await addHoverSource(page, 'one', [{ path: [0], start: 0, end: 5, cls: 'hv-one' }]);
		const overlay = page.locator('.decoration-overlay.hv-one');
		await expect(overlay).toHaveCount(1);
		const box = (await overlay.boundingBox())!;

		const { x, y } = await centerOf(page, '.decoration-overlay.hv-one');
		await page.mouse.move(x, y, { steps: 4 });
		await expect.poll(() => hovers(page)).toHaveLength(1);
		const [start] = await hovers(page);
		expect(start.anchor).toEqual({
			left: expect.closeTo(box.x, 0),
			top: expect.closeTo(box.y, 0),
			width: expect.closeTo(box.width, 0)
		});

		await moveAway(page);
		expect(await settledHovers(page)).toEqual([start, { cls: 'hv-one', anchor: null }]);
	});

	test('crossing between the lines of a wrapped mark fires nothing; leaving it ends once', async ({
		page
	}) => {
		const line = 'word '.repeat(120).trim();
		await editor.loadContent(`${line}\n`);
		await addHoverSource(page, 'wrap', [{ path: [0], start: 0, end: line.length, cls: 'hv-wrap' }]);
		const overlays = page.locator('.decoration-overlay.hv-wrap');
		await expect.poll(() => overlays.count()).toBeGreaterThanOrEqual(2);

		const first = (await overlays.nth(0).boundingBox())!;
		const second = (await overlays.nth(2).boundingBox())!;
		expect(second.y, 'the third rect sits on the second line').toBeGreaterThan(first.y);
		const x = first.x + 200;
		await page.mouse.move(x, first.y + first.height / 2, { steps: 4 });
		await expect.poll(() => hovers(page)).toHaveLength(1);
		// Straight down, in small steps, so the pointer passes through the space between the lines.
		await page.mouse.move(x, second.y + second.height / 2, { steps: 12 });
		expect(await settledHovers(page)).toHaveLength(1);

		await moveAway(page);
		const run = await settledHovers(page);
		expect(run.map((r) => r.anchor === null)).toEqual([false, true]);
	});

	test('a re-provided mark keeps its hover, and a removed one ends it once', async ({ page }) => {
		await editor.loadContent('hello world\n');
		await addHoverSource(page, 'live', [{ path: [0], start: 0, end: 5, cls: 'hv-live' }]);
		const { x, y } = await centerOf(page, '.decoration-overlay.hv-live');
		await page.mouse.move(x, y, { steps: 4 });
		await expect.poll(() => hovers(page)).toHaveLength(1);

		await page.evaluate(() => {
			const w = window as any;
			w.__setMarks('live', [{ path: [0], start: 0, end: 5, cls: 'hv-live' }]);
			w.__setMarks('live', [{ path: [0], start: 0, end: 5, cls: 'hv-live hv-hovered' }]);
		});
		await expect(page.locator('.decoration-overlay.hv-hovered')).toHaveCount(1);
		expect(await settledHovers(page), 'a repaint fired a leave/enter pair').toHaveLength(1);

		await page.evaluate(() => (window as any).__setMarks('live', []));
		await expect(page.locator('.decoration-overlay.hv-live')).toHaveCount(0);
		const run = await settledHovers(page);
		expect(run.slice(1)).toEqual([{ cls: 'hv-live hv-hovered', anchor: null }]);
	});

	test('scrolling the hovered block out of the rendered range ends its hover once', async ({
		page
	}) => {
		const count = await editor.loadLargeFixture('flat-prose', FIXTURE_BYTES);
		await addHoverSource(page, 'far', [{ path: [0], start: 0, end: 4, cls: 'hv-far' }]);
		const { x, y } = await centerOf(page, '.decoration-overlay.hv-far');
		await page.mouse.move(x, y, { steps: 4 });
		await expect.poll(() => hovers(page)).toHaveLength(1);

		await page.evaluate((last) => (window as any).__test.rects.scrollTo([last]), count - 1);
		await expect
			.poll(() => page.evaluate(() => (window as any).__test.isBlockMounted([0])))
			.toBe(false);
		const run = await settledHovers(page);
		expect(run.map((r) => r.anchor === null)).toEqual([false, true]);
	});

	test('replacing the document ends the hover once', async ({ page }) => {
		await editor.loadContent('hello world\n');
		await addHoverSource(page, 'swap', [{ path: [0], start: 0, end: 5, cls: 'hv-swap' }]);
		const { x, y } = await centerOf(page, '.decoration-overlay.hv-swap');
		await page.mouse.move(x, y, { steps: 4 });
		await expect.poll(() => hovers(page)).toHaveLength(1);

		// The source keeps offering the same mark, so only the swap itself can end the hover.
		await editor.loadContent('hello again\n');
		const run = await settledHovers(page);
		expect(run.slice(0, 2).map((r) => r.anchor === null)).toEqual([false, true]);
		expect(run.filter((r) => r.anchor === null)).toHaveLength(1);
	});

	test('unmounting the editor ends the hover once', async ({ page }) => {
		await editor.loadContent('hello world\n');
		await addHoverSource(page, 'gone', [{ path: [0], start: 0, end: 5, cls: 'hv-gone' }]);
		const { x, y } = await centerOf(page, '.decoration-overlay.hv-gone');
		await page.mouse.move(x, y, { steps: 4 });
		await expect.poll(() => hovers(page)).toHaveLength(1);

		// The host's own toggle remounts the editor under `{#key}`; clicked from script so the
		// pointer stays on the mark and only the unmount can end the hover.
		await page.evaluate(() => {
			const label = [...document.querySelectorAll('label')].find((l) =>
				/drag handles/i.test(l.textContent ?? '')
			);
			label!.querySelector('input')!.click();
		});
		const run = await settledHovers(page);
		expect(run.map((r) => r.anchor === null)).toEqual([false, true]);
	});

	test('over two overlapping marks, the inner one hovers whatever the source order', async ({
		page
	}) => {
		await editor.loadContent('hello world\n');
		await addHoverSource(page, 'inner', [{ path: [0], start: 2, end: 4, cls: 'hv-inner' }]);
		await addHoverSource(page, 'outer', [{ path: [0], start: 0, end: 11, cls: 'hv-outer' }]);
		const { x, y } = await centerOf(page, '.decoration-overlay.hv-inner');
		await page.mouse.move(x, y, { steps: 4 });
		await expect.poll(() => hovers(page)).not.toHaveLength(0);
		const run = await settledHovers(page);
		expect(run.at(-1)?.cls).toBe('hv-inner');
	});

	test('two hundred plain marks and a keyboard-only mark take no pointer events', async ({
		page
	}) => {
		await editor.loadContent('hello world\n');
		await page.evaluate(() => {
			(window as any).__test.decorations.addSource({
				name: 'plain-many',
				provide: () => [
					...Array.from({ length: 200 }, (_, i) => ({
						type: 'mark',
						path: [0],
						start: i % 10,
						end: (i % 10) + 1,
						class: 'hv-plain'
					})),
					{
						type: 'mark',
						path: [0],
						start: 0,
						end: 5,
						class: 'hv-kbd',
						interactive: { onActivate: () => {} }
					}
				]
			});
		});
		await expect(page.locator('.decoration-overlay')).toHaveCount(201);
		const taking = await page
			.locator('.decoration-overlay')
			.evaluateAll((els) => els.filter((el) => getComputedStyle(el).pointerEvents !== 'none'));
		expect(taking).toHaveLength(0);
	});

	test('a throwing onHover reaches the error event and the editor keeps working', async ({
		page
	}) => {
		await editor.loadContent('hello world\n');
		await page.evaluate(() => {
			const w = window as any;
			w.__test.startErrorCapture();
			w.__test.decorations.addSource({
				name: 'boom',
				provide: () => [
					{
						type: 'mark',
						path: [0],
						start: 0,
						end: 5,
						class: 'hv-boom',
						interactive: {
							onHover: () => {
								throw new Error('plugin onHover blew up');
							}
						}
					}
				]
			});
		});
		const { x, y } = await centerOf(page, '.decoration-overlay.hv-boom');
		await page.mouse.move(x, y, { steps: 4 });
		await expect
			.poll(() => page.evaluate(() => (window as any).__test.getCapturedErrors()))
			.toContain('decoration');

		await editor.focusBlockEnd(0);
		await editor.typeText('!');
		await expect
			.poll(() => page.evaluate(() => (window as any).__test.getSource()))
			.toBe('hello world!\n');
	});
});
