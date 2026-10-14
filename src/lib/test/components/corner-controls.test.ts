// @vitest-environment jsdom
// Miss-analysis: the only test opened the bar over one code block at the top, so moving every
// block's controls, covered or not, passed it.
import { describe, it, expect, afterEach } from 'vitest';
import {
	CLEARANCE_VAR,
	UNDER_FIND_BAR_ATTR,
	boxesOverlap,
	keepCornerControlsClear,
	placeCornerControl
} from '#lib/components/corner-controls.js';

// The bar's box: 10px down, 48px tall, over the right half of an 800px editor.
const BAR = new DOMRect(400, 10, 390, 48);

function barAt(rect: DOMRect): HTMLElement {
	const bar = document.createElement('div');
	bar.getBoundingClientRect = () => rect;
	return bar;
}

/** A control whose measured box follows the shift editor.css would apply, as the browser's would.
 *  A `y` read on each measure stands for a document that scrolls. */
function controlAt(x: number, y: number | (() => number)): HTMLElement {
	const top = typeof y === 'number' ? () => y : y;
	const control = document.createElement('div');
	control.setAttribute('data-corner-control', '');
	control.getBoundingClientRect = () => {
		const shift = parseFloat(control.style.getPropertyValue(CLEARANCE_VAR)) || 0;
		return new DOMRect(x, top() + shift, 60, 24);
	};
	return control;
}

const shiftOf = (control: HTMLElement) => control.style.getPropertyValue(CLEARANCE_VAR);

describe('a corner control under the find bar', () => {
	it('moves to the bar bottom plus a gap when the bar covers it', () => {
		const control = controlAt(720, 22);
		placeCornerControl(control, barAt(BAR));
		expect(control.hasAttribute(UNDER_FIND_BAR_ATTR)).toBe(true);
		expect(shiftOf(control)).toBe('40px');
	});

	it('stays put when the bar does not cover it, touching at an edge included', () => {
		const below = controlAt(720, BAR.bottom);
		const beside = controlAt(BAR.left - 60, 22);
		placeCornerControl(below, barAt(BAR));
		placeCornerControl(beside, barAt(BAR));
		expect(boxesOverlap(below.getBoundingClientRect(), BAR)).toBe(false);
		for (const control of [below, beside]) {
			expect(control.hasAttribute(UNDER_FIND_BAR_ATTR)).toBe(false);
			expect(shiftOf(control)).toBe('');
		}
	});

	it('judges a moved control by its unmoved place, so a second check keeps the shift', () => {
		const control = controlAt(720, 22);
		placeCornerControl(control, barAt(BAR));
		placeCornerControl(control, barAt(BAR));
		expect(control.hasAttribute(UNDER_FIND_BAR_ATTR)).toBe(true);
		expect(shiftOf(control)).toBe('40px');
	});

	it('goes back once its unmoved place is clear of the bar', () => {
		const control = controlAt(720, 22);
		placeCornerControl(control, barAt(BAR));
		placeCornerControl(control, barAt(new DOMRect(400, 10, 390, 8)));
		expect(control.hasAttribute(UNDER_FIND_BAR_ATTR)).toBe(false);
		expect(shiftOf(control)).toBe('');
	});
});

describe('the open find bar', () => {
	const cleanups: Array<() => void> = [];
	afterEach(() => {
		cleanups.splice(0).forEach((undo) => undo());
		document.body.replaceChildren();
	});

	function editorWithBlock() {
		const root = document.body.appendChild(document.createElement('div'));
		const host = root.appendChild(document.createElement('div'));
		host.className = 'block-host';
		const text = host.appendChild(document.createElement('p'));
		const bar = barAt(BAR);
		const detach = keepCornerControlsClear(() => root)(bar);
		cleanups.push(() => detach?.());
		return { root, host, text, detach: () => detach?.() };
	}

	it('checks a control that mounts after the pointer is already in its block', () => {
		const { host, text } = editorWithBlock();
		text.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
		const late = host.appendChild(controlAt(720, 22));
		const word = text.appendChild(document.createElement('span'));
		word.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
		expect(late.hasAttribute(UNDER_FIND_BAR_ATTR)).toBe(true);
	});

	it('checks a block focus enters', () => {
		const { host, text } = editorWithBlock();
		const control = host.appendChild(controlAt(720, 22));
		text.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
		expect(control.hasAttribute(UNDER_FIND_BAR_ATTR)).toBe(true);
	});

	it('checks the block under the pointer again as the document scrolls', () => {
		const { host, text } = editorWithBlock();
		let y = 200;
		const control = host.appendChild(controlAt(720, () => y));
		text.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
		y = 22;
		host.parentElement!.dispatchEvent(new Event('scroll'));
		expect(control.hasAttribute(UNDER_FIND_BAR_ATTR)).toBe(true);
	});

	it('puts a moved control back once a scroll carries its block clear of the bar', () => {
		const { root, host, text } = editorWithBlock();
		let y = 22;
		const control = host.appendChild(controlAt(720, () => y));
		text.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
		// The pointer leaves for the space between blocks.
		root.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
		y = 200;
		document.dispatchEvent(new Event('scroll'));
		expect(control.hasAttribute(UNDER_FIND_BAR_ATTR)).toBe(false);
	});

	it('puts every moved control back when it closes', () => {
		const { host, text, detach } = editorWithBlock();
		const control = host.appendChild(controlAt(720, 22));
		text.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }));
		detach();
		expect(control.hasAttribute(UNDER_FIND_BAR_ATTR)).toBe(false);
		expect(shiftOf(control)).toBe('');
	});
});
