/**
 * Pointer actions on a locator that leave the page where it is when the target is on screen. A
 * driver scrolls a locator's target into view before acting, and over WebDriver BiDi (Firefox) it
 * centres the target every time, even one already showing; these scroll only an off-screen target.
 */
import type { Locator } from '@playwright/test';
import type { Point } from './text-runs';

export interface InPlaceOptions {
	/** The point to press, relative to the target's top-left corner; its centre by default. */
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

// Retried like the driver's own check, so a target still moving into place or covered for a
// moment is waited for rather than missed.
const TRIES = 50;

/** Where to press: on screen and on `target` itself, not on something covering it. */
async function pointInView(target: Locator, position?: Point): Promise<Point> {
	await target.waitFor({ state: 'visible' });
	for (let i = 0; i < TRIES; i++) {
		const at = await target.evaluate(async (el, position) => {
			const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
			const read = () => {
				const box = el.getBoundingClientRect();
				const x = box.left + (position ? position.x : box.width / 2);
				const y = box.top + (position ? position.y : box.height / 2);
				return { x, y, hit: el.contains(document.elementFromPoint(x, y)) };
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
			return after.hit && after.x === now.x && after.y === now.y ? after : null;
		}, position ?? null);
		if (at) return at;
	}
	throw new Error('clickInPlace: the target never sat still and uncovered on screen');
}
