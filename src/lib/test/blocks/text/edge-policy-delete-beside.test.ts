// @vitest-environment jsdom
// Miss-analysis: every widget row pressed the plain key, which the dispatch takes at keydown, so no
// test asked what a delete chord meets beside the caret, the answer its keydown reads.
import { describe, expect, it } from 'vitest';
import {
	installEdgeDispatchCleanup,
	makeEdgeDispatch,
	mountIslandBlock
} from './edge-policy-fixture';
import { mountWidgetBlock } from './math-widget-fixture';
import '#lib/schema/built-in-descriptors.js';

installEdgeDispatchCleanup();

function widgetBlock(source: string, kind: string, reading = false) {
	const { node, el, inlineWidgets } = mountWidgetBlock(source, kind);
	const entered: number[] = [];
	const h = makeEdgeDispatch(node, el, {
		isReading: () => reading,
		enterWidget: (widget) => void entered.push(widget.start)
	});
	return { ...h, widget: inlineWidgets[0], entered };
}

function islandBlock(source: string, start: number, end: number, reading = false) {
	const { node, el, island } = mountIslandBlock(source, start, end);
	window.getSelection()?.removeAllRanges();
	const h = makeEdgeDispatch(node, el, { hasIslands: () => true, isReading: () => reading });
	const selected = () =>
		window.getSelection()!.rangeCount > 0 &&
		window
			.getSelection()!
			.getRangeAt(0)
			.cloneContents()
			.querySelector('[data-decoration-island]') !== null;
	return { ...h, island, selected };
}

describe('deleteBeside: what a delete of any unit meets beside the caret', () => {
	it('takes an atomic widget whole on the side the delete faces', () => {
		const backward = widgetBlock('a&copy;b', 'entityReference');
		expect(backward.dispatch.deleteBeside(backward.widget.end, 'backward')).toBe(true);
		const forward = widgetBlock('a&copy;b', 'entityReference');
		expect(forward.dispatch.deleteBeside(forward.widget.start, 'forward')).toBe(true);
		expect([backward.edits[0][1], forward.edits[0][1]]).toEqual(['ab', 'ab']);
	});

	it('enters an image, its bytes kept', () => {
		const h = widgetBlock('hello ![a](u) world', 'image');
		expect(h.dispatch.deleteBeside(h.widget.end, 'backward')).toBe(true);
		expect(h.entered).toEqual([h.widget.start]);
		expect(h.edits).toEqual([]);
	});

	it('meets nothing with the widget behind the delete', () => {
		const h = widgetBlock('hello ![a](u) world', 'image');
		expect(h.dispatch.deleteBeside(h.widget.end, 'forward')).toBe(false);
		expect(h.dispatch.deleteBeside(h.widget.start, 'backward')).toBe(false);
		expect(h.entered).toEqual([]);
	});

	it('in reading mode enters an atomic widget and writes nothing', () => {
		const h = widgetBlock('a&copy;b', 'entityReference', true);
		expect(h.dispatch.deleteBeside(h.widget.end, 'backward')).toBe(true);
		expect(h.entered).toEqual([h.widget.start]);
		expect(h.edits).toEqual([]);
	});

	it('selects a replace decoration whole', () => {
		const h = islandBlock('abHIDDENcd\n', 2, 8);
		expect(h.dispatch.deleteBeside(8, 'backward')).toBe(true);
		expect(h.selected()).toBe(true);
		expect(h.edits).toEqual([]);
	});

	it('leaves a replace decoration alone in reading mode, as the plain key does', () => {
		const h = islandBlock('abHIDDENcd\n', 2, 8, true);
		expect(h.dispatch.deleteBeside(8, 'backward')).toBe(false);
		expect(h.selected()).toBe(false);
	});

	// What a delete takes past a widget decoration depends on its unit, which only the input names.
	it('leaves a widget decoration, which stands for no bytes, to the delete unit', () => {
		const h = islandBlock('hello\n', 3, 3);
		expect(h.dispatch.deleteBeside(3, 'backward')).toBe(false);
		expect(h.edits).toEqual([]);
	});

	it('meets nothing while a shown source holds bytes the tree has not seen', () => {
		const { node, el, inlineWidgets } = mountWidgetBlock('a&copy;b', 'entityReference');
		const h = makeEdgeDispatch(node, el, { isRevealing: () => true });
		expect(h.dispatch.deleteBeside(inlineWidgets[0].end, 'backward')).toBe(false);
		expect(h.edits).toEqual([]);
	});
});
