// @vitest-environment jsdom
// Miss-analysis: every delete row pressed a key at keydown, so a delete arriving as `beforeinput`
// alone (a soft keyboard, or a key no arm took) had no test at the dispatch.
import { describe, expect, it } from 'vitest';
import { parse } from '#lib/core/parser.js';
import { trimTrailingLineEnding } from '#lib/core/lines.js';
import {
	BACKSPACE,
	DELETE,
	installEdgeDispatchCleanup,
	makeEdgeDispatch,
	mountIslandBlock,
	mountSurface
} from './edge-policy-fixture';
import { mountWidgetBlock } from './math-widget-fixture';
import '#lib/schema/built-in-descriptors.js';

installEdgeDispatchCleanup();

function mount(source: string) {
	const node = parse(source).children[0];
	const el = mountSurface(trimTrailingLineEnding(node.raw));
	return makeEdgeDispatch(node, el);
}

describe('deleteAtCaret: a collapsed delete the browser never runs', () => {
	it('Backspace takes the character before the caret through one write', () => {
		const h = mount('abc\n');
		expect(h.dispatch.deleteAtCaret(3, BACKSPACE)).toBe('taken');
		expect(h.edits).toEqual([[0, 'ab\n', 3, 2]]);
	});

	it('Backspace takes a ZWJ family whole', () => {
		const h = mount('a\u{1F468}‍\u{1F469}‍\u{1F467}\n');
		h.dispatch.deleteAtCaret(9, BACKSPACE);
		expect(h.edits.map((e) => e[1])).toEqual(['a\n']);
	});

	it('Delete takes a combining cluster whole, Backspace only its mark', () => {
		const forward = mount('éx\n');
		forward.dispatch.deleteAtCaret(0, DELETE);
		const backward = mount('éx\n');
		backward.dispatch.deleteAtCaret(2, BACKSPACE);
		expect([forward.edits[0][1], backward.edits[0][1]]).toEqual(['x\n', 'ex\n']);
	});

	it('answers at the edge at the block start, where the merge is the key', () => {
		const h = mount('abc\n');
		expect(h.dispatch.deleteAtCaret(0, BACKSPACE)).toBe('at-edge');
		expect(h.edits).toHaveLength(0);
	});

	it('takes the byte past a widget decoration, which stands for none', () => {
		const { node, el } = mountIslandBlock('hello\n', 3, 3);
		const h = makeEdgeDispatch(node, el, { hasIslands: () => true });
		h.dispatch.deleteAtCaret(3, BACKSPACE);
		expect(h.edits.map((e) => e[1])).toEqual(['helo\n']);
	});

	it('selects an image beside the caret, as the key does, rather than deleting it', () => {
		const entered: number[] = [];
		const { node, el, inlineWidgets } = mountWidgetBlock('hello ![a](u) world', 'image');
		const h = makeEdgeDispatch(node, el, {
			enterWidget: (widget) => void entered.push(widget.start)
		});
		h.dispatch.deleteAtCaret(inlineWidgets[0].end, BACKSPACE);
		expect(h.edits).toHaveLength(0);
		expect(entered).toEqual([inlineWidgets[0].start]);
	});

	it('takes an atomic widget whole, as the key does', () => {
		const { node, el, inlineWidgets } = mountWidgetBlock('a&copy;b', 'entityReference');
		const h = makeEdgeDispatch(node, el);
		h.dispatch.deleteAtCaret(inlineWidgets[0].start, DELETE);
		expect(h.edits.map((e) => e[1])).toEqual(['ab']);
	});

	it('leaves a shown source to the browser, whose bytes the tree has not seen', () => {
		const node = parse('abc\n').children[0];
		const h = makeEdgeDispatch(node, mountSurface('abc'), { isRevealing: () => true });
		expect(h.dispatch.deleteAtCaret(3, BACKSPACE)).toBe('declined');
		expect(h.edits).toHaveLength(0);
	});
});
