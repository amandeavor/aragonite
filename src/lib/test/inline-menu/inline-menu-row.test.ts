// @vitest-environment jsdom
// A source's own row paints each item, as a component or as plain DOM, and a row that fails to
// mount leaves the default label in its place and reports the failure, as other plugin views do.
// Miss-analysis: the plugin view mounts were tested route by route, and the inline menu's row was
// the one route no test ever handed a throwing component.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import type { EditorError } from '#lib/editor-events.js';
import type {
	InlineMenuDomRow,
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

/** A DOM row that keeps every element it built and every one it was asked to destroy. */
function recordingRow(): InlineMenuDomRow & { built: HTMLElement[]; destroyed: HTMLElement[] } {
	const built: HTMLElement[] = [];
	const destroyed: HTMLElement[] = [];
	return {
		built,
		destroyed,
		buildDom({ item, active, query }: InlineMenuRowProps) {
			const el = document.createElement('b');
			el.className = 'dom-row';
			el.textContent = item.label;
			el.dataset.active = String(active);
			el.dataset.query = query;
			built.push(el);
			return el;
		},
		destroy: (el) => void destroyed.push(el)
	};
}

const domRowOf = (mounted: MountedEditor, label: string) =>
	option(mounted, label).querySelector<HTMLElement>('.dom-row');

describe('a DOM row', () => {
	it('paints each item inside its option', async () => {
		const row = recordingRow();
		const { mounted } = await openMenu(row, ['a', 'b']);

		expect(domRowOf(mounted, 'a')?.dataset.active).toBe('true');
		expect(domRowOf(mounted, 'b')?.dataset.active).toBe('false');
		expect(row.built).toHaveLength(2);
	});

	it('rebuilds only the rows whose props changed when the active row moves', async () => {
		const row = recordingRow();
		const { mounted } = await openMenu(row, ['a', 'b', 'c']);
		const untouched = domRowOf(mounted, 'c');

		await pressKey(surfaceAt(mounted, [0]), { key: 'ArrowDown' });

		expect(domRowOf(mounted, 'a')?.dataset.active).toBe('false');
		expect(domRowOf(mounted, 'b')?.dataset.active).toBe('true');
		expect(domRowOf(mounted, 'c')).toBe(untouched);
		expect(row.built).toHaveLength(5);
		expect(row.destroyed).toEqual([row.built[0], row.built[1]]);
	});

	it('hands every element it built to destroy once the menu closes', async () => {
		const row = recordingRow();
		const { mounted } = await openMenu(row, ['a', 'b']);
		expect(row.built).toHaveLength(2);

		await pressKey(surfaceAt(mounted, [0]), { key: 'Escape' });

		expect(mounted.target.ownerDocument.querySelector('[role="option"]')).toBeNull();
		expect(row.destroyed).toEqual(row.built);
	});
});

describe('a component row', () => {
	it('takes a new active flag in place', async () => {
		const { mounted } = await openMenu(ThrowingRow, ['a', 'b']);
		const first = option(mounted, 'a').querySelector<HTMLElement>('.custom-row');
		expect(first?.dataset.activeRow).toBe('true');

		await pressKey(surfaceAt(mounted, [0]), { key: 'ArrowDown' });

		expect(option(mounted, 'a').querySelector('.custom-row')).toBe(first);
		expect(first?.dataset.activeRow).toBe('false');
	});
});

describe('an inline menu row that fails to mount', () => {
	const throwingDomRow: InlineMenuDomRow = {
		buildDom({ item }) {
			if (item.id === 'bad') throw new Error('row exploded');
			const el = document.createElement('span');
			el.className = 'custom-row';
			el.textContent = item.label;
			return el;
		}
	};

	it.each([
		['a component', ThrowingRow],
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

describe('a DOM row whose destroy throws', () => {
	const failingDestroy = (): InlineMenuDomRow => ({
		buildDom: ({ item }) => {
			const el = document.createElement('b');
			el.className = 'dom-row';
			el.textContent = item.label;
			return el;
		},
		destroy() {
			throw new Error('destroy exploded');
		}
	});
	const destroyError = {
		origin: 'subscriber',
		error: new Error('destroy exploded'),
		context: { source: 'tags' }
	};

	it('keeps the rebuilt row and reports, when the active row moves', async () => {
		const { mounted, errors } = await openMenu(failingDestroy(), ['a', 'b']);

		await pressKey(surfaceAt(mounted, [0]), { key: 'ArrowDown' });

		expect(domRowOf(mounted, 'a')).not.toBeNull();
		expect(domRowOf(mounted, 'b')).not.toBeNull();
		expect(errors).toEqual([destroyError, destroyError]);
	});

	it('still closes the menu and reports each row, when the menu closes', async () => {
		const { mounted, errors } = await openMenu(failingDestroy(), ['a', 'b']);

		await pressKey(surfaceAt(mounted, [0]), { key: 'Escape' });

		expect(mounted.target.ownerDocument.querySelector('[role="option"]')).toBeNull();
		expect(errors).toEqual([destroyError, destroyError]);
	});
});
