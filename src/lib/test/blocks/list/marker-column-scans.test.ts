// @vitest-environment jsdom
// A list scans its items for the marker column when its items, a marker or the mode change, never
// for a keystroke in an item's text, which on a long list would read every item per key.
// Miss-analysis: the column's only cost probe typed one fast burst, and a burst never crosses an
// undo snapshot, where the list's ids arrive as a fresh copy of the same ids.
import { describe, it, expect, vi, beforeAll, afterEach, onTestFinished } from 'vitest';
import { tick } from 'svelte';
import { UNDO_DEBOUNCE_MS } from '#lib/editor-actions/commit/text-batch.js';
import {
	destroyMountedEditors,
	installLayoutStubs,
	mountEditor,
	pressKeyAt,
	surfaceAt,
	typeInto,
	type MountedEditor
} from '#lib/test/harness/mount-editor.svelte.js';

const columnScans = vi.hoisted(() => ({ count: 0 }));

vi.mock('#lib/components/blocks/list/marker-column.js', async (importOriginal) => {
	const real =
		await importOriginal<typeof import('#lib/components/blocks/list/marker-column.js')>();
	return {
		...real,
		markerColumn: (...args: Parameters<typeof real.markerColumn>) => {
			columnScans.count++;
			return real.markerColumn(...args);
		}
	};
});

beforeAll(installLayoutStubs);
afterEach(destroyMountedEditors);

const columnOf = (editor: MountedEditor) =>
	editor.target
		.querySelector<HTMLElement>('.list-block')!
		.style.getPropertyValue('--md-list-column');

async function typeInItem(editor: MountedEditor, item: number, text: string): Promise<void> {
	typeInto(surfaceAt(editor, [0, item, 0]), text);
	await tick();
}

describe('the list’s marker column', () => {
	it('is not scanned again for keystrokes in an item’s text, across typing pauses', async () => {
		// The typing pause is a wall-clock timer, so the test moves the clock instead of waiting.
		vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
		onTestFinished(() => void vi.useRealTimers());
		const editor = mountEditor({ source: '8. a\n9. b\n10. c\n', presentationMode: 'live' });
		await tick();
		const column = columnOf(editor);
		columnScans.count = 0;

		for (const text of ['bx', 'bxy', 'bxyz']) {
			// Past the pause, the key opens a new undo entry, which copies the edited path.
			vi.advanceTimersByTime(UNDO_DEBOUNCE_MS);
			await typeInItem(editor, 1, text);
		}

		expect(editor.source()).toBe('8. a\n9. bxyz\n10. c\n');
		expect(columnScans.count).toBe(0);
		expect(columnOf(editor)).toBe(column);
	});

	it('is scanned again when an item’s marker changes in place', async () => {
		const editor = mountEditor({ source: '- a\n- b\n', presentationMode: 'source' });
		await tick();
		const before = columnOf(editor);
		columnScans.count = 0;

		await typeInItem(editor, 0, '[ ] a');

		expect(editor.source()).toBe('- [ ] a\n- b\n');
		expect(columnScans.count).toBeGreaterThan(0);
		expect(columnOf(editor)).not.toBe(before);
	});

	it('is scanned again when an item comes', async () => {
		const editor = mountEditor({ source: '8. a\n9. b\n', presentationMode: 'live' });
		await tick();
		const before = columnOf(editor);

		await pressKeyAt(editor, [0, 1, 0], 1, { key: 'Enter' });
		await tick();

		expect(editor.source()).toBe('8. a\n9. b\n10. \n');
		expect(columnOf(editor)).not.toBe(before);
	});

	it('is scanned again when the mode starts drawing to-do boxes', async () => {
		const editor = mountEditor({ source: '- [ ] a\n- b\n', presentationMode: 'source' });
		await tick();
		const before = columnOf(editor);

		editor.props.presentationMode = 'live';
		await editor.settle();

		expect(columnOf(editor)).not.toBe(before);
	});
});
