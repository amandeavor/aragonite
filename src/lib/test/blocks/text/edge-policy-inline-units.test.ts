// @vitest-environment jsdom
// Miss-analysis: Chromium crosses a non-editable widget or decoration natively, so no row asked the
// block which inline spans an arrow must cross whole, and WebKit stepped one character past them.
import { describe, expect, it } from 'vitest';
import { parse } from '#lib/core/parser.js';
import type { CstNode } from '#lib/core/nodes.js';
import {
	installEdgeDispatchCleanup,
	makeEdgeDispatch,
	mountIslandBlock,
	mountSurface
} from './edge-policy-fixture';

installEdgeDispatchCleanup();

function unitsOf(source: string, overrides: Parameters<typeof makeEdgeDispatch>[2] = {}) {
	const node: CstNode = parse(source).children[0];
	return makeEdgeDispatch(node, mountSurface('x'), overrides).dispatch.inlineUnits;
}

describe('the inline spans an arrow crosses whole', () => {
	it('a step-over widget, from either side, plain or extending', () => {
		// `a&copy;b`: the entity at [1, 7).
		const units = unitsOf('a&copy;b\n');
		for (const extending of [false, true]) {
			expect(units.beside(1, 'forward', extending)).toEqual({ start: 1, end: 7 });
			expect(units.beside(7, 'backward', extending)).toEqual({ start: 1, end: 7 });
			expect(units.beside(7, 'forward', extending)).toBeNull();
			expect(units.beside(1, 'backward', extending)).toBeNull();
		}
	});

	it('between two adjacent widgets, the one the key is aimed at', () => {
		const units = unitsOf('&copy;&reg;\n');
		expect(units.beside(6, 'forward', false)).toEqual({ start: 6, end: 11 });
		expect(units.beside(6, 'backward', false)).toEqual({ start: 0, end: 6 });
	});

	it('a widget a plain arrow enters is crossed only by an extending one', () => {
		// `a<br>b`: the raw-HTML widget at [1, 5), whose policy selects it on a plain arrow.
		const units = unitsOf('a<br>b\n');
		expect(units.beside(1, 'forward', false)).toBeNull();
		expect(units.beside(1, 'forward', true)).toEqual({ start: 1, end: 5 });
		expect(units.beside(5, 'backward', true)).toEqual({ start: 1, end: 5 });
	});

	it('the block’s own policy for a widget it draws on its own terms', () => {
		const units = unitsOf('a<br>b\n', { widgetEdgePolicy: () => ({ onEdge: 'step-over' }) });
		expect(units.beside(1, 'forward', false)).toEqual({ start: 1, end: 5 });
	});

	it('nothing while a source shows, whose text the browser walks', () => {
		const units = unitsOf('a&copy;b\n', { isRevealing: () => true });
		expect(units.beside(1, 'forward', false)).toBeNull();
		expect(units.beside(1, 'forward', true)).toBeNull();
	});

	it('a replace decoration from either side, a widget decoration never', () => {
		const replace = mountIslandBlock('abHIDDENcd\n', 2, 8);
		const units = makeEdgeDispatch(replace.node, replace.el, { hasIslands: () => true }).dispatch
			.inlineUnits;
		expect(units.beside(2, 'forward', false)).toEqual({ start: 2, end: 8 });
		expect(units.beside(8, 'backward', true)).toEqual({ start: 2, end: 8 });

		const widget = mountIslandBlock('abcd\n', 2);
		const see = makeEdgeDispatch(widget.node, widget.el, { hasIslands: () => true }).dispatch
			.inlineUnits;
		expect(see.beside(2, 'forward', false)).toBeNull();
		expect(see.beside(2, 'backward', false)).toBeNull();
	});

	it('a press that crossed one lets go of the widget edge a click held', () => {
		const held: (number | null)[] = [];
		unitsOf('a&copy;b\n', { setSnapTarget: (at) => held.push(at) }).crossed();
		expect(held).toEqual([null]);
	});
});
