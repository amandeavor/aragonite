// @vitest-environment jsdom
// A source's own row paints each item, and a row that fails to mount leaves the default label in
// its place and reports the failure, the way every other plugin view does.
// Miss-analysis: the plugin view mounts were tested route by route, and the inline menu's row was
// the one route no test ever handed a throwing component.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import type { EditorError } from '#lib/editor-events.js';
import type { InlineMenuItem, InlineMenuSource } from '#lib/inline-menu/types.js';
import {
	destroyMountedEditors,
	installLayoutStubs,
	mountEditor,
	placeCaret,
	surfaceAt,
	type MountedEditor
} from '#lib/test/harness/mount-editor.svelte.js';
import ThrowingRow from './fixtures/ThrowingRow.svelte';

beforeAll(installLayoutStubs);
afterEach(destroyMountedEditors);

const ITEMS: InlineMenuItem[] = [
	{ id: 'good', label: 'good', insert: '#good' },
	{ id: 'bad', label: 'bad', insert: '#bad' }
];

async function openMenu(row: InlineMenuSource['row']) {
	const mounted = mountEditor({ source: 'see\n', presentationMode: 'live' });
	await mounted.settle();
	const errors: EditorError[] = [];
	mounted.instance.getEvents().on('error', (error) => errors.push(error));
	const menus = mounted.instance.getInlineMenus();
	menus.addSource({ name: 'tags', trigger: '#', items: () => ITEMS, row });
	placeCaret(surfaceAt(mounted, [0]), 3);
	menus.open('tags');
	await mounted.settle();
	return { mounted, errors };
}

function option(mounted: MountedEditor, id: string): HTMLElement {
	const el = [
		...mounted.target.ownerDocument.querySelectorAll<HTMLElement>('[role="option"]')
	].find((o) => o.textContent?.trim() === id);
	if (!el) throw new Error(`no row for ${id}`);
	return el;
}

describe('an inline menu row that fails to mount', () => {
	it('as a component, shows the default row and reports the source', async () => {
		const { mounted, errors } = await openMenu(ThrowingRow);

		expect(option(mounted, 'good').querySelector('.custom-row')).not.toBeNull();
		const failed = option(mounted, 'bad');
		expect(failed.querySelector('.custom-row')).toBeNull();
		expect(failed.querySelector('.inline-menu-label')?.textContent).toBe('bad');
		expect(errors).toEqual([
			{ origin: 'subscriber', error: new Error('row exploded'), context: { source: 'tags' } }
		]);
	});
});
