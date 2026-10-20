/**
 * Pointer actions on a locator that leave the page where it is when the target is on screen. A
 * driver scrolls a locator's target into view before acting, and over WebDriver BiDi (Firefox) it
 * centres the target every time, even one already showing; these scroll only an off-screen target.
 */
import { expect, test, type Locator } from '@playwright/test';
import type { Point } from './text-runs';

export interface InPlaceOptions {
	/** The point to press, from the top-left of the target's padding box as in `locator.click`;
	 *  by default the middle of the part of it on screen. */
	position?: Point;
	button?: 'left' | 'right' | 'middle';
}

/** Clicks `target` like `locator.click()`, scrolling only when the point isn't on screen. */
export async function clickInPlace(target: Locator, opts: InPlaceOptions = {}): Promise<void> {
	const at = await pointInView(target, opts.position);
	await target.page().mouse.click(at.x, at.y, { button: opts.button });
}

/** Moves the mouse onto `target` like `locator.hover()`, scrolling only when it's off screen. */
export async function hoverInPlace(target: Locator, opts: InPlaceOptions = {}): Promise<void> {
	const at = await pointInView(target, opts.position);
	await target.page().mouse.move(at.x, at.y);
}

/** Scrolls `target` to the middle of the screen if any of it is hidden, as Chromium does. */
export async function showInPlace(target: Locator): Promise<void> {
	await target.waitFor({ state: 'visible' });
	await target.evaluate((el) => {
		const box = el.getBoundingClientRect();
		const corners = [
			[box.left + 1, box.top + 1],
			[box.right - 1, box.bottom - 1]
		];
		if (!corners.every(([x, y]) => el.contains(document.elementFromPoint(x, y))))
			el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
	});
}

/** Where to press: on screen and on `target` itself, not on something covering it. Retried until
 *  the project's action timeout, or the test's when none is set, at the driver's own spacing. */
async function pointInView(target: Locator, position?: Point): Promise<Point> {
	await target.waitFor({ state: 'visible' });
	let found: Point | null = null;
	await expect(async () => {
		const at = await target.evaluate(async (el, position) => {
			const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
			// The driver's points: `position` from the padding box, else the middle of the first box
			// fragment showing on screen, so a target partly off screen is pressed where it shows.
			const middleOnScreen = (r: DOMRect): Point | null => {
				const [left, right] = [Math.max(r.left, 0), Math.min(r.right, innerWidth)];
				const [top, bottom] = [Math.max(r.top, 0), Math.min(r.bottom, innerHeight)];
				return right - left >= 1 && bottom - top >= 1
					? { x: (left + right) / 2, y: (top + bottom) / 2 }
					: null;
			};
			const read = () => {
				const box = el.getBoundingClientRect();
				let x: number;
				let y: number;
				if (position) {
					const style = getComputedStyle(el);
					x = box.left + parseFloat(style.borderLeftWidth) + position.x;
					y = box.top + parseFloat(style.borderTopWidth) + position.y;
				} else {
					const shown = [...el.getClientRects()].map(middleOnScreen).find((p) => p !== null);
					({ x, y } = shown ?? { x: box.left + box.width / 2, y: box.top + box.height / 2 });
				}
				const under = document.elementFromPoint(x, y);
				return { x, y, hit: el.contains(under), under: under?.outerHTML.slice(0, 80) ?? 'nothing' };
			};
			let now = read();
			if (!now.hit) {
				el.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' });
				await frame();
				now = read();
			}
			// Stable across a frame, as the driver requires before it presses.
			await frame();
			const after = read();
			return { ...after, still: after.x === now.x && after.y === now.y };
		}, position ?? null);
		if (!at.hit) throw new Error(`clickInPlace: the press point is over ${at.under}`);
		if (!at.still) throw new Error('clickInPlace: the target is still moving');
		found = at;
	}).toPass({
		timeout: test.info().project.use.actionTimeout ?? 0,
		intervals: [0, 20, 100, 100, 500]
	});
	return found!;
}
