/**
 * Double and triple clicks, the one way an e2e spec makes a click run. Firefox over WebDriver
 * BiDi gives every press `detail` 1 and fires no `dblclick`, so there each real press has its
 * place in the run written onto its own mouse events and the `dblclick` is fired by hand.
 */
import type { Locator, Page } from '@playwright/test';
import { isFirefox } from './browser-engine';
import type { Point } from './text-runs';
import { showInPlace } from './click-in-place';

/** Clicks `clicks` times at one point, each its own press and release. */
export async function multiClick(page: Page, at: Point, clicks: number): Promise<void> {
	await (await multiClickHold(page, at, clicks)).release();
}

/** A run's last press, still held down. */
export interface HeldPress {
	release(): Promise<void>;
}

/** Clicks `clicks - 1` times at `at` and holds the last press down, for a spec to drag or read. */
export async function multiClickHold(page: Page, at: Point, clicks: number): Promise<HeldPress> {
	await page.mouse.move(at.x, at.y);
	for (let i = 1; i < clicks; i++) await (await press(page, i)).release();
	return press(page, clicks);
}

/** Clicks `clicks` times at `from` and drags the last press to `to` before releasing it. */
export async function multiClickDrag(
	page: Page,
	from: Point,
	to: Point,
	clicks: number
): Promise<void> {
	const held = await multiClickHold(page, from, clicks);
	await page.mouse.move(to.x, to.y, { steps: 8 });
	await held.release();
}

/** Clicks `clicks` times at the centre of `target`, scrolled into view first as a locator click is. */
export async function multiClickElement(target: Locator, clicks: number): Promise<void> {
	await showInPlace(target);
	const box = await target.boundingBox();
	if (!box) throw new Error('the multi-click target has no box');
	await multiClick(target.page(), { x: box.x + box.width / 2, y: box.y + box.height / 2 }, clicks);
}

/** The press in progress, kept on the page between the arming and the release. */
interface ClickRun {
	count: number;
	click: MouseEvent | null;
}

/** Presses the `count`th click of a run where the mouse stands; its release carries the same count. */
async function press(page: Page, count: number): Promise<HeldPress> {
	const firefox = isFirefox(page);
	if (firefox) await armClickCount(page, count);
	await page.mouse.down({ clickCount: count });
	return {
		async release() {
			await page.mouse.up({ clickCount: count });
			if (firefox) await disarmClickCount(page);
		}
	};
}

/** Writes `count` as the `detail` of the next trusted mousedown, mouseup and click, read by every
 *  listener after the window's own capture listener, which runs first. */
function armClickCount(page: Page, count: number): Promise<void> {
	return page.evaluate((count) => {
		const w = window as unknown as { __e2eClickRun?: ClickRun };
		if (!w.__e2eClickRun) {
			const run: ClickRun = { count: 0, click: null };
			w.__e2eClickRun = run;
			for (const type of ['mousedown', 'mouseup', 'click']) {
				const onPress = (e: Event) => {
					if (!run.count || !e.isTrusted) return;
					Object.defineProperty(e, 'detail', { value: run.count });
					if (type === 'click') run.click = e as MouseEvent;
				};
				window.addEventListener(type, onPress, { capture: true });
			}
		}
		w.__e2eClickRun.count = count;
		w.__e2eClickRun.click = null;
	}, count);
}

/** Ends the press, firing the `dblclick` a second click raises on the element it clicked. */
function disarmClickCount(page: Page): Promise<void> {
	return page.evaluate(() => {
		const run = (window as unknown as { __e2eClickRun: ClickRun }).__e2eClickRun;
		const { count, click } = run;
		run.count = 0;
		run.click = null;
		const target = click?.target;
		if (count !== 2 || !(target instanceof Element) || !target.isConnected) return;
		const { clientX, clientY, screenX, screenY } = click!;
		target.dispatchEvent(
			new MouseEvent('dblclick', {
				bubbles: true,
				cancelable: true,
				composed: true,
				detail: 2,
				view: window,
				clientX,
				clientY,
				screenX,
				screenY
			})
		);
	});
}
