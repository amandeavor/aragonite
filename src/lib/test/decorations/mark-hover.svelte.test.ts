// @vitest-environment jsdom
// A mark's hover starts once and ends once per hover, keyed by the decoration rather than the
// rendered rect, since the overlay repaints its rects on every invalidate and scroll.
import { describe, it, expect, afterEach } from 'vitest';
import { mount, unmount, flushSync } from 'svelte';
import DecorationOverlay from '#lib/components/DecorationOverlay.svelte';
import type { BlockComponent } from '#lib/block-component.js';
import { parse } from '#lib/core/parser.js';
import { createDecorationEngine } from '#lib/decorations/decoration-state.svelte.js';
import type { Decoration, MarkDecoration, MarkHover } from '#lib/decorations/types.js';
import { editorMountContext } from '../harness/mount-context';

const doc = parse('hello world, a longer line\n\n| a | b |\n| - | - |\n| x | y |\n');

/** jsdom measures every range at zero size, so the leaf answers with the rects a browser would:
 *  one per visual line, `wrapAt` splitting a range that crosses it. */
function paintingLeaf(wrapAt = Infinity): BlockComponent {
	return {
		focus: () => {},
		getCursorOffset: () => null,
		editable: true,
		focusable: true,
		measurePartialRects: (start: number, end: number) =>
			end <= wrapAt || start >= wrapAt
				? [new DOMRect(start * 8, 0, (end - start) * 8, 16)]
				: [new DOMRect(start * 8, 0, (wrapAt - start) * 8, 16), new DOMRect(0, 22, end * 8, 16)]
	} as unknown as BlockComponent;
}

/** A grid's overlay paints its cells' marks as whole-cell rects. */
function paintingGrid(): BlockComponent {
	return {
		focus: () => {},
		getCursorOffset: () => null,
		editable: false,
		focusable: true,
		cellRect: (row: number, col: number) => new DOMRect(col * 40, row * 20, 40, 20)
	} as unknown as BlockComponent;
}

type HoverCall = { cls: string; hover: MarkHover | null };

let instance: ReturnType<typeof mount> | null = null;
afterEach(async () => {
	if (instance) await unmount(instance);
	instance = null;
	document.body.innerHTML = '';
});

function setup(opts: { path?: number[]; leaf?: BlockComponent; container?: boolean } = {}) {
	const path = opts.path ?? [0];
	const errors: { path: number[]; error: unknown }[] = [];
	// A variable, not a literal, so the deps type grows without this suite changing.
	const deps = {
		getDoc: () => doc,
		onMarkError: (errPath: number[], error: unknown) => errors.push({ path: errPath, error })
	};
	const engine = createDecorationEngine(deps);
	const target = document.createElement('div');
	const blockEl = document.createElement('div');
	document.body.append(target, blockEl);
	instance = mount(DecorationOverlay, {
		target,
		props: {
			path,
			blockRef: opts.leaf ?? paintingLeaf(),
			blockEl,
			isContainer: opts.container ?? false
		},
		context: editorMountContext({ services: { decorations: engine } })
	});
	flushSync();
	return { engine, errors };
}

/** A source whose answer the test swaps, then re-runs with `invalidate`. */
function swappableSource(engine: ReturnType<typeof setup>['engine'], first: Decoration[]) {
	let answer = first;
	const handle = engine.addSource({ name: 'probe', provide: () => answer });
	flushSync();
	return (next: Decoration[]) => {
		answer = next;
		handle.invalidate();
		flushSync();
	};
}

function hoverMark(calls: HoverCall[], over: Partial<MarkDecoration> = {}): MarkDecoration {
	return {
		type: 'mark',
		path: [0],
		start: 0,
		end: 5,
		class: 'probe',
		interactive: { onHover: (dec, hover) => calls.push({ cls: dec.class, hover }) },
		...over
	};
}

function painted(): HTMLElement[] {
	return [...document.querySelectorAll<HTMLElement>('.decoration-overlay')];
}

function enter(el: Element, from: Element | null = null): void {
	el.dispatchEvent(new MouseEvent('pointerenter', { relatedTarget: from }));
}

function leave(el: Element, to: Element | null = document.body): void {
	el.dispatchEvent(new MouseEvent('pointerleave', { relatedTarget: to }));
}

describe('a mark reports one hover per decoration', () => {
	it('reports the entered rect as the anchor, then one end on leaving', () => {
		const calls: HoverCall[] = [];
		const { engine } = setup();
		swappableSource(engine, [hoverMark(calls)]);

		const [rect] = painted();
		enter(rect);
		leave(rect);

		expect(calls).toHaveLength(2);
		expect(calls[0].hover?.anchor).toMatchObject({ left: 0, top: 0, width: 40, height: 16 });
		expect(calls[0].hover?.rects).toHaveLength(1);
		expect(calls[1].hover).toBeNull();
	});

	it('fires nothing between two rects of a wrapped mark, and ends once leaving both', () => {
		const calls: HoverCall[] = [];
		const { engine } = setup({ leaf: paintingLeaf(3) });
		swappableSource(engine, [hoverMark(calls)]);

		const [first, second] = painted();
		expect(second, 'the wrapped mark painted one rect per line').toBeDefined();
		enter(first);
		leave(first, second);
		enter(second, first);
		expect(calls).toHaveLength(1);
		expect(calls[0].hover?.rects).toHaveLength(2);

		leave(second);
		expect(calls.map((c) => c.hover)).toEqual([calls[0].hover, null]);
	});
});

describe('a started hover ends exactly once, whatever ends it', () => {
	it('survives the source re-providing the same mark, and ends once when it is gone', () => {
		const calls: HoverCall[] = [];
		const { engine } = setup();
		const provide = swappableSource(engine, [hoverMark(calls)]);
		enter(painted()[0]);

		provide([hoverMark(calls)]);
		provide([hoverMark(calls, { class: 'probe probe-hovered' })]);
		expect(calls, 'a re-provided mark fired a leave/enter pair').toHaveLength(1);

		provide([]);
		expect(calls).toHaveLength(2);
		expect(calls[1]).toEqual({ cls: 'probe probe-hovered', hover: null });
	});

	it('ends once when the overlay unmounts, as a block windowed out does', async () => {
		const calls: HoverCall[] = [];
		const { engine } = setup();
		swappableSource(engine, [hoverMark(calls)]);
		enter(painted()[0]);

		await unmount(instance!);
		instance = null;
		flushSync();

		expect(calls.map((c) => c.hover === null)).toEqual([false, true]);
	});

	it('routes a throwing onHover to the error sink and keeps reporting later hovers', () => {
		const calls: HoverCall[] = [];
		const { engine, errors } = setup();
		const boom: MarkDecoration = {
			...hoverMark(calls),
			interactive: {
				onHover: () => {
					throw new Error('plugin onHover blew up');
				}
			}
		};
		const provide = swappableSource(engine, [boom]);
		enter(painted()[0]);
		leave(painted()[0]);
		expect(errors.map((e) => (e.error as Error).message)).toEqual([
			'plugin onHover blew up',
			'plugin onHover blew up'
		]);
		expect(errors[0].path).toEqual([0]);

		provide([hoverMark(calls)]);
		enter(painted()[0]);
		expect(calls).toHaveLength(1);
	});
});

describe('only marks with a pointer handler take pointer events', () => {
	it('paints many plain marks and a keyboard-only mark with none taking pointer events', () => {
		const { engine } = setup();
		const plain: Decoration[] = Array.from({ length: 200 }, (_, i) => ({
			type: 'mark',
			path: [0],
			start: i % 20,
			end: (i % 20) + 1,
			class: 'plain'
		}));
		const keyboardOnly: MarkDecoration = {
			type: 'mark',
			path: [0],
			start: 0,
			end: 5,
			class: 'kbd',
			interactive: { onActivate: () => {} }
		};
		swappableSource(engine, [...plain, keyboardOnly]);

		expect(painted()).toHaveLength(201);
		expect(document.querySelectorAll('.decoration-overlay-interactive')).toHaveLength(0);
	});
});

describe('a table cell names its decoration by the precedence rule', () => {
	it('hovers the innermost of two hover marks collapsed into one cell rect', () => {
		const calls: HoverCall[] = [];
		const { engine } = setup({ path: [1], leaf: paintingGrid(), container: true });
		const cell = [1, 1, 0];
		swappableSource(engine, [
			hoverMark(calls, { path: cell, start: 0, end: 3, class: 'outer' }),
			hoverMark(calls, { path: cell, start: 1, end: 2, class: 'inner' }),
			hoverMark(calls, { path: cell, start: 1, end: 2, class: 'later-same-span' })
		]);
		const [rect] = painted();
		enter(rect);
		expect(calls.map((c) => c.cls)).toEqual(['inner']);
	});

	it('keeps a cell clickable when a plain mark from a later source shares it', () => {
		let clicks = 0;
		const { engine } = setup({ path: [1], leaf: paintingGrid(), container: true });
		engine.addSource({
			name: 'clickable',
			provide: () => [
				{
					type: 'mark',
					path: [1, 1, 0],
					start: 0,
					end: 1,
					class: 'click',
					interactive: { onClick: () => clicks++ }
				}
			]
		});
		engine.addSource({
			name: 'highlight',
			provide: () => [{ type: 'mark', path: [1, 1, 0], start: 0, end: 1, class: 'hl' }]
		});
		flushSync();
		painted()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
		expect(clicks).toBe(1);
	});
});
