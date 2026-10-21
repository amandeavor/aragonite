// @vitest-environment jsdom
// A hand-built DOM view publishes what its handle has, of the members a view may supply, and
// nothing else; registration refuses a view whose surface disagrees with the kind.
// Miss-analysis: new surface; a forwarding ref that always had every member would lie to callers.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	destroyMountedEditors,
	installLayoutStubs,
	mountEditor,
	pressKeyAt,
	surfaceAt,
	typeInto,
	type MountedEditor
} from '#lib/test/harness/mount-editor.svelte.js';
import {
	defineBlockView,
	type BlockView,
	type BlockViewSpec,
	type HandBuiltViewHandle
} from '#lib/plugin.js';
import type { BlockComponent } from '#lib/block-component.js';
import { HAND_BUILT_MEMBERS, MEMBER_SOURCES } from '#lib/schema/block-view.js';
import { testContainer, testLeaf } from '#lib/test/harness/test-kinds.js';
import { markerLeafPlugin, newViewLog, loggedHandle } from './fixtures/dom-views';

type Lookup = { getBlockComponent(path: number[]): BlockComponent | null };

const SOURCE = 'intro\n\n@@ badge\n\noutro\n';

beforeEach(installLayoutStubs);
afterEach(async () => {
	await destroyMountedEditors();
	document.body.innerHTML = '';
});

function badgeView(extra: Partial<HandBuiltViewHandle> = {}, log = newViewLog()) {
	const focus = vi.fn();
	const view = defineBlockView({
		surface: 'none',
		mount(target) {
			target.className = 'badge-block';
			target.textContent = 'badge';
			return loggedHandle(log, target, {
				focus,
				getCursorOffset: () => null,
				focusable: true,
				...extra
			});
		}
	});
	return { view, focus, log };
}

function mountBadge(view: BlockView): MountedEditor<Lookup> {
	return mountEditor<Lookup>({ source: SOURCE, plugins: [markerLeafPlugin(view)] });
}

describe('a hand-built DOM view', () => {
	it('publishes its handle’s focus, which the editor calls when the caret arrives', async () => {
		const { view, focus } = badgeView();
		const editor = mountBadge(view);
		await editor.settle();
		await pressKeyAt(editor, [0], 'intro'.length, { key: 'ArrowDown' });
		expect(focus).toHaveBeenCalled();
	});

	it('publishes only the members its handle has, of those a view may supply', async () => {
		const rects = () => [new DOMRect(0, 0, 1, 1)];
		const { view } = badgeView({
			measurePartialRects: rects,
			// Editor-internal: a view's handle cannot publish it.
			...({ startDragAtPoint: () => true } as object)
		});
		const editor = mountBadge(view);
		await editor.settle();
		const ref = editor.instance.__test.getBlockComponent([1])!;
		expect(ref.measurePartialRects?.(0, 1)).toEqual(rects());
		expect('startDragAtPoint' in ref).toBe(false);
		expect('parkCaret' in ref).toBe(false);
		expect(ref.focusable).toBe(true);
		expect(editor.instance.__test.getBlockComponent([1])).toBe(ref);
	});

	it('reports editable from the kind’s registration', async () => {
		const { view } = badgeView();
		const editor = mountBadge(view);
		await editor.settle();
		expect(editor.instance.__test.getBlockComponent([1])!.editable).toBe(true);
	});

	it('publishes the new handle once update returns false', async () => {
		const first = vi.fn();
		const second = vi.fn();
		let mounts = 0;
		const view = defineBlockView({
			surface: 'none',
			mount() {
				mounts++;
				return {
					focus: mounts === 1 ? first : second,
					getCursorOffset: () => null,
					focusable: true,
					update: () => false
				};
			}
		});
		const editor = mountBadge(view);
		await editor.settle();
		editor.props.presentationMode = 'live';
		await editor.settle();
		editor.instance.__test.getBlockComponent([1])!.focus(0);
		expect(mounts).toBe(2);
		expect(second).toHaveBeenCalledWith(0);
		expect(first).not.toHaveBeenCalled();
	});

	it.each([
		[true, 1],
		[false, 0]
	])('with watchDocument %s, gets %i update for an edit to another block', async (watch, count) => {
		const log = newViewLog();
		const view = defineBlockView({
			surface: 'none',
			watchDocument: watch,
			mount: (target) =>
				loggedHandle<HandBuiltViewHandle>(log, target, {
					focus() {},
					getCursorOffset: () => null,
					focusable: true
				})
		});
		const editor = mountBadge(view);
		await editor.settle();
		typeInto(surfaceAt(editor, [0]), 'introX');
		await editor.settle();
		expect(log.updates).toHaveLength(count);
	});

	it('may publish exactly the members MEMBER_SOURCES gives to a view', () => {
		expect([...HAND_BUILT_MEMBERS].sort()).toEqual(
			Object.entries(MEMBER_SOURCES)
				.filter(([, source]) => source === 'view')
				.map(([key]) => key)
				.sort()
		);
	});
});

describe('registering a DOM view', () => {
	const leafSpec: BlockViewSpec = {
		surface: 'leaf',
		mount: () => ({})
	};

	it('refuses a leaf surface on a container kind', () => {
		expect(() =>
			testContainer(
				'dom-wrong-container',
				{ rebuildRaw: () => {} },
				// The test helper's type leaves the view to the leaf default; the registration takes one.
				{ view: defineBlockView(leafSpec) } as never
			)
		).toThrow(/is a container, but its view's surface is 'leaf'.*defineBlockView/);
	});

	it('refuses a container surface on a leaf kind', () => {
		expect(() =>
			testLeaf('dom-wrong-leaf', {
				view: defineBlockView({ surface: 'container', mount: () => ({}) })
			})
		).toThrow(/has no container group, but its view's surface is 'container'/);
	});

	it.each([
		['an unknown surface', { surface: 'render-primary', mount: () => ({}) }],
		['no surface', { mount: () => ({}) }],
		['a mount that is not a function', { surface: 'none', mount: 'draw' }]
	])('refuses %s', (_name, spec) => {
		expect(() => defineBlockView(spec as unknown as BlockViewSpec)).toThrow(/defineBlockView/);
	});
});
