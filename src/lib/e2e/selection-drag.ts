/**
 * Dragging the page's selection and dropping it, the one way an e2e spec makes that drag. Firefox
 * over WebDriver BiDi starts the native drag but sends no `drop` or `dragend` and pins `dragover`
 * to one point, so there the drag events are fired by hand, each where the browser would fire it.
 */
import type { Page } from '@playwright/test';
import { isFirefox } from './browser-engine';
import type { Point } from './text-runs';

/** A drag still held over the page. */
export interface HeldDrag {
	moveTo(to: Point, steps?: number): Promise<void>;
	release(): Promise<void>;
}

export interface DragOptions {
	/** The key held from before the press until after the release, which makes the drop a copy. */
	copyWith?: 'Control' | 'Alt';
}

/** Presses on the selected text at `from`, drags it to `to` and keeps holding it there. */
export async function holdSelectionDrag(
	page: Page,
	from: Point,
	to: Point,
	options: DragOptions = {}
): Promise<HeldDrag> {
	if (options.copyWith) await page.keyboard.down(options.copyWith);
	const drag = isFirefox(page) ? await firedDrag(page, from, options) : await mouseDrag(page, from);
	await drag.moveTo({ x: from.x + 4, y: from.y }, 2);
	await drag.moveTo(to, 12);
	await drag.moveTo({ x: to.x + 1, y: to.y }, 2);
	return {
		moveTo: drag.moveTo,
		async release() {
			await drag.release();
			if (options.copyWith) await page.keyboard.up(options.copyWith);
		}
	};
}

/** Presses on the selected text at `from`, drags it to `to` and releases it there. */
export async function dragSelection(
	page: Page,
	from: Point,
	to: Point,
	options: DragOptions = {}
): Promise<void> {
	await (await holdSelectionDrag(page, from, to, options)).release();
}

async function mouseDrag(page: Page, from: Point): Promise<HeldDrag> {
	await page.mouse.move(from.x, from.y);
	await page.mouse.down();
	return {
		moveTo: (to, steps = 1) => page.mouse.move(to.x, to.y, { steps }),
		release: () => page.mouse.up()
	};
}

/** The drag held on the page between the calls that fire its events. */
interface FiredDrag {
	source: Element;
	dataTransfer: DataTransfer;
	over: Element | null;
	accepted: boolean;
	at: { x: number; y: number };
	ctrlKey: boolean;
	altKey: boolean;
}

/** The browser's selection drag fired by hand, each event where the browser fires it: `drop`
 *  only where the last `dragover` was accepted, `dragend` always. */
async function firedDrag(page: Page, from: Point, options: DragOptions): Promise<HeldDrag> {
	await page.evaluate(
		({ from, ctrlKey, altKey }) => {
			const sel = window.getSelection();
			const pressed = document.caretPositionFromPoint(from.x, from.y);
			const range = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null;
			if (!range || range.collapsed || !pressed) throw new Error('no selection to drag');
			// A press off the selection starts a new selection in every browser, not a drag.
			if (!range.isPointInRange(pressed.offsetNode, pressed.offset)) {
				throw new Error('the press lands outside the selection, so it would not drag it');
			}
			const source = document.elementFromPoint(from.x, from.y)!;
			const dataTransfer = new DataTransfer();
			dataTransfer.setData('text/plain', range.toString());
			dataTransfer.effectAllowed = 'copyMove';
			const drag: FiredDrag = {
				source,
				dataTransfer,
				over: null,
				accepted: false,
				at: from,
				ctrlKey,
				altKey
			};
			(window as unknown as { __e2eDrag: FiredDrag }).__e2eDrag = drag;
			source.dispatchEvent(
				new DragEvent('dragstart', {
					bubbles: true,
					cancelable: true,
					composed: true,
					dataTransfer,
					clientX: from.x,
					clientY: from.y,
					ctrlKey,
					altKey
				})
			);
		},
		{ from, ctrlKey: options.copyWith === 'Control', altKey: options.copyWith === 'Alt' }
	);
	let at = from;
	return {
		async moveTo(to, steps = 1) {
			const path: Point[] = [];
			for (let i = 1; i <= steps; i++) {
				path.push({ x: at.x + ((to.x - at.x) * i) / steps, y: at.y + ((to.y - at.y) * i) / steps });
			}
			at = to;
			await page.evaluate((path) => {
				const drag = (window as unknown as { __e2eDrag: FiredDrag }).__e2eDrag;
				const fire = (target: Element, type: string, related: Element | null = null) =>
					target.dispatchEvent(
						new DragEvent(type, {
							bubbles: true,
							cancelable: true,
							composed: true,
							relatedTarget: related,
							dataTransfer: drag.dataTransfer,
							clientX: drag.at.x,
							clientY: drag.at.y,
							ctrlKey: drag.ctrlKey,
							altKey: drag.altKey
						})
					);
				for (const point of path) {
					drag.at = point;
					const el = document.elementFromPoint(point.x, point.y);
					if (el !== drag.over) {
						if (el) fire(el, 'dragenter', drag.over);
						if (drag.over) fire(drag.over, 'dragleave', el);
						drag.over = el;
					}
					drag.accepted = el ? !fire(el, 'dragover') : false;
				}
			}, path);
		},
		async release() {
			await page.evaluate(() => {
				const w = window as unknown as { __e2eDrag?: FiredDrag };
				const drag = w.__e2eDrag!;
				delete w.__e2eDrag;
				const init = {
					bubbles: true,
					cancelable: true,
					composed: true,
					dataTransfer: drag.dataTransfer,
					clientX: drag.at.x,
					clientY: drag.at.y,
					ctrlKey: drag.ctrlKey,
					altKey: drag.altKey
				};
				const unclaimed =
					drag.over && drag.accepted && drag.over.dispatchEvent(new DragEvent('drop', init));
				drag.source.dispatchEvent(new DragEvent('dragend', init));
				// A real browser would now make its own native move, which a fired drop cannot.
				if (unclaimed)
					throw new Error('the page accepted the drop but left the browser to apply it');
			});
		}
	};
}
