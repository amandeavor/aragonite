// @vitest-environment jsdom
// A source's own row paints each item, as a component or as plain DOM, and a row that fails to
// mount or re-render leaves the default label in its place and reports the failure.
// Miss-analysis: the plugin view mounts were tested route by route, and the inline menu's row was
// the one route no test ever handed a throwing component.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import type { EditorError } from '#lib/editor-events.js';
import type { PluginView } from '#lib/plugin-view.js';
import { svelteView } from '#lib/svelte-view.svelte.js';
import type {
	InlineMenuItem,
	InlineMenuRowProps,
	InlineMenuSource
} from '#lib/inline-menu/types.js';
import {
	destroyMountedEditors,
	installLayoutStubs,
	mountEditor,
	placeCaret,
	surfaceAt,
	type MountedEditor
} from '#lib/test/harness/mount-editor.svelte.js';
import { pressKey } from '#lib/test/harness/settle.js';
import ThrowingRow from './fixtures/ThrowingRow.svelte';
import ThrowWhenActiveRow from './fixtures/ThrowWhenActiveRow.svelte';

beforeAll(installLayoutStubs);
afterEach(destroyMountedEditors);

const item = (id: string): InlineMenuItem => ({ id, label: id, insert: `#${id}` });

async function openMenu(row: InlineMenuSource['row'], ids = ['good', 'bad']) {
	const mounted = mountEditor({ source: 'see\n', presentationMode: 'live' });
	await mounted.settle();
	const errors: EditorError[] = [];
	mounted.instance.getEvents().on('error', (error) => errors.push(error));
	const menus = mounted.instance.getInlineMenus();
	menus.addSource({ name: 'tags', trigger: '#', items: () => ids.map(item), row });
	placeCaret(surfaceAt(mounted, [0]), 3);
	menus.open('tags');
	await mounted.settle();
	return { mounted, errors };
}

function option(mounted: MountedEditor, label: string): HTMLElement {
	const el = [
		...mounted.target.ownerDocument.querySelectorAll<HTMLElement>('[role="option"]')
	].find((o) => o.textContent?.trim() === label);
	if (!el) throw new Error(`no row for ${label}`);
	return el;
}

/** A DOM row view that keeps every element it drew, and draws `active` and the query on it. */
function drawingRow(): PluginView<InlineMenuRowProps> & { drawn: HTMLElement[] } {
	const drawn: HTMLElement[] = [];
	const paint = (el: HTMLElement, { item, active, query }: InlineMenuRowProps) => {
		el.textContent = item.label;
		el.dataset.active = String(active);
		el.dataset.query = query;
	};
	const view: PluginView<InlineMenuRowProps> = (target, props) => {
		const el = document.createElement('b');
		el.className = 'dom-row';
		paint(el, props);
		drawn.push(el);
		target.append(el);
		return { update: (next) => paint(el, next) };
	};
	return Object.assign(view, { drawn });
}

const domRowOf = (mounted: MountedEditor, label: string) =>
	option(mounted, label).querySelector<HTMLElement>('.dom-row');

describe('a DOM row', () => {
	it('paints each item inside its option', async () => {
		const row = drawingRow();
		const { mounted } = await openMenu(row, ['a', 'b']);

		expect(domRowOf(mounted, 'a')?.dataset.active).toBe('true');
		expect(domRowOf(mounted, 'b')?.dataset.active).toBe('false');
		expect(row.drawn).toHaveLength(2);
	});

	it('updates its rows in place when the active row moves', async () => {
		const row = drawingRow();
		const { mounted } = await openMenu(row, ['a', 'b', 'c']);

		await pressKey(surfaceAt(mounted, [0]), { key: 'ArrowDown' });

		expect(domRowOf(mounted, 'a')?.dataset.active).toBe('false');
		expect(domRowOf(mounted, 'b')?.dataset.active).toBe('true');
		expect(row.drawn).toHaveLength(3);
		expect(domRowOf(mounted, 'b')).toBe(row.drawn[1]);
	});
});

describe('a component row', () => {
	it('takes a new active flag in place', async () => {
		const { mounted } = await openMenu(svelteView(ThrowingRow), ['a', 'b']);
		const first = option(mounted, 'a').querySelector<HTMLElement>('.custom-row');
		expect(first?.dataset.activeRow).toBe('true');

		await pressKey(surfaceAt(mounted, [0]), { key: 'ArrowDown' });

		expect(option(mounted, 'a').querySelector('.custom-row')).toBe(first);
		expect(first?.dataset.activeRow).toBe('false');
	});

	// Svelte re-renders a row after its update returns, so only the row's error boundary sees that.
	it('that throws on a later re-render shows the default row and reports the source', async () => {
		const { mounted, errors } = await openMenu(svelteView(ThrowWhenActiveRow), ['a', 'late']);

		await pressKey(surfaceAt(mounted, [0]), { key: 'ArrowDown' });
		await mounted.settle();

		const failed = option(mounted, 'late');
		expect(failed.querySelector('.custom-row')).toBeNull();
		expect(failed.querySelector('.inline-menu-label')?.textContent).toBe('late');
		expect(option(mounted, 'a').querySelector('.custom-row')).not.toBeNull();
		expect(errors).toEqual([
			{ origin: 'subscriber', error: new Error('row exploded late'), context: { source: 'tags' } }
		]);
	});
});

describe('an inline menu row that fails to mount', () => {
	const throwingDomRow: PluginView<InlineMenuRowProps> = (target, { item }) => {
		if (item.id === 'bad') throw new Error('row exploded');
		const el = document.createElement('span');
		el.className = 'custom-row';
		el.textContent = item.label;
		target.append(el);
		return {};
	};

	it.each([
		['a component', svelteView(ThrowingRow)],
		['a DOM row', throwingDomRow]
	])('as %s, shows the default row and reports the source', async (_name, row) => {
		const { mounted, errors } = await openMenu(row);

		expect(option(mounted, 'good').querySelector('.custom-row')).not.toBeNull();
		const failed = option(mounted, 'bad');
		expect(failed.querySelector('.custom-row')).toBeNull();
		expect(failed.querySelector('.inline-menu-label')?.textContent).toBe('bad');
		expect(errors).toEqual([
			{ origin: 'subscriber', error: new Error('row exploded'), context: { source: 'tags' } }
		]);
	});
});
