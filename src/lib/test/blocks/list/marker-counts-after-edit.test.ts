// @vitest-environment jsdom
// A list's stored marker-width counts equal a fresh parse's after an item turns into a to-do, through
// the keystroke rebuild, and back and forth through an undo and a redo.
// Miss-analysis: the rows that made a to-do in place ran with the perf instruments on, which turn
// the dev recount off, and source mode's column doesn't move, so nothing compared the counts.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { tick } from 'svelte';
import type { Document } from '#lib/core/nodes.js';
import { parse } from '#lib/core/parser.js';
import {
	destroyMountedEditors,
	installLayoutStubs,
	mountEditor,
	pressKeyAt,
	surfaceAt,
	typeInto
} from '#lib/test/harness/mount-editor.svelte.js';

beforeAll(installLayoutStubs);
afterEach(destroyMountedEditors);

type Seam = { getDocument(): Document };

describe('a list’s marker-width counts after an edit', () => {
	it('match a fresh parse when an item becomes a to-do and back', async () => {
		const editor = mountEditor<Seam>({ source: '- a\n- b\n', presentationMode: 'source' });
		await tick();
		const stored = () => Array.from(editor.instance.__test.getDocument().children[0].markerWidths!);
		const parsed = () => Array.from(parse(editor.source()).children[0].markerWidths!);
		const steps: Record<string, string> = {};
		const record = (step: string) => {
			steps[step] = editor.source();
			expect(stored(), step).toEqual(parsed());
		};
		const type = async (text: string) => {
			typeInto(surfaceAt(editor, [0, 0, 0]), text);
			await tick();
		};
		const press = async (shiftKey: boolean) => {
			await pressKeyAt(editor, [0, 0, 0], 0, { key: 'z', ctrlKey: true, shiftKey });
			await editor.settle();
		};

		// The first key rebuilds the whole list; later ones move one item's count.
		await type('a!');
		await type('[ ] a!');
		record('to-do');
		await press(false);
		record('undo');
		await press(true);
		record('redo');

		expect(steps).toEqual({
			'to-do': '- [ ] a!\n- b\n',
			undo: '- a\n- b\n',
			redo: '- [ ] a!\n- b\n'
		});
	});
});
