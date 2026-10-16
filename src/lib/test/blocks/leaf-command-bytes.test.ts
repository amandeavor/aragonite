// @vitest-environment jsdom
// A leaf's command changes its metadata by rewriting the leaf's bytes with `replaceRaw`, so the
// change survives a reload. Miss-analysis: a leaf command could only write metadata, which never
// reached a leaf's bytes, and no test reloaded what a leaf command left.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	destroyMountedEditors,
	installLayoutStubs,
	mountEditor,
	placeCaret,
	surfaceAt
} from '#lib/test/harness/mount-editor.svelte.js';
import { pressKey } from '#lib/test/harness/settle.js';
import { blockNodeAt } from '#lib/tree-operations/node-primitives.js';
import type { EditorTestSurface } from '#lib/components/editor-root/test-surface.js';
import { TAG_KEY, tagLeafPlugin } from './fixtures/tag-leaf';

beforeEach(() => {
	installLayoutStubs();
	// Showing a source measures the caret through Range rects, which jsdom lacks.
	Range.prototype.getClientRects ??= () => [] as unknown as DOMRectList;
	Range.prototype.getBoundingClientRect ??= () => new DOMRect();
});
afterEach(destroyMountedEditors);

const SCOPES = [
	{ name: 'at the top level', source: 'x\n\n%% memo\n', path: [1], tagged: 'x\n\n%%! memo\n' },
	{ name: 'in a blockquote', source: '> %% memo\n', path: [0, 0], tagged: '> %%! memo\n' }
];

describe('a leaf command that rewrites its bytes', () => {
	for (const scope of SCOPES) {
		it(`tags the leaf ${scope.name}, and a reload reads the same metadata`, async () => {
			const plugin = tagLeafPlugin();
			const editor = mountEditor<EditorTestSurface>({ source: scope.source, plugins: [plugin] });
			await editor.settle();
			const surface = surfaceAt(editor, scope.path);
			placeCaret(surface, 2);

			await pressKey(surface, TAG_KEY);
			await editor.settle();

			expect(editor.source()).toBe(scope.tagged);
			const live = blockNodeAt(editor.instance.__test.getDocument(), scope.path)?.metadata;
			expect(live).toEqual({ tagged: true });
			const reloaded = mountEditor<EditorTestSurface>({ source: scope.tagged, plugins: [plugin] });
			expect(blockNodeAt(reloaded.instance.__test.getDocument(), scope.path)?.metadata).toEqual(
				live
			);
		});
	}

	// The handler reads the leaf's bytes, so it runs once the open source is written.
	it('keeps an edit in a shown source, writing it before the command', async () => {
		const editor = mountEditor<EditorTestSurface>({
			source: '%% old\n\nnext\n',
			plugins: [tagLeafPlugin('reveal')]
		});
		await editor.settle();
		editor.instance.__test.getBlockComponent([0])?.focus?.(3);
		await editor.settle();
		const source = editor.target.querySelector<HTMLElement>('.reveal-leaf-source');
		expect(source, 'the leaf source is not showing').not.toBeNull();
		source!.textContent = '%% new';

		await pressKey(source!, TAG_KEY);
		await editor.settle();
		await editor.settle();

		expect(editor.source()).toBe('%%! new\n\nnext\n');
	});
});
