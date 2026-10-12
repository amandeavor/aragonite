/**
 * Every holder of a composing flag asks `editor-actions/dropped-composition.ts` both questions
 * (G4.155): did the browser drop its composition, and does a composed run open one here. A holder
 * asking only the first writes a paragraph per run when a range's removal lands the caret on it.
 */
import { describe, it, expect } from 'vitest';
import { collectEditorSources, type SourceFile } from './scan-source';

const MODULE = 'src/lib/editor-actions/dropped-composition.ts';
const ASKS_DROP = /\breportDroppedComposition\s*\(/;
const ASKS_OPEN = /\bopensComposition\s*\(/;

const holdersIn = (files: Pick<SourceFile, 'relPath' | 'code'>[]) =>
	files.filter((f) => f.relPath !== MODULE && ASKS_DROP.test(f.code));

const skippingOpen = (files: Pick<SourceFile, 'relPath' | 'code'>[]): string[] =>
	holdersIn(files)
		.filter((f) => !ASKS_OPEN.test(f.code))
		.map((f) => f.relPath);

describe('G4.155 every composing-flag holder opens a composition whose start went elsewhere', () => {
	const sources = collectEditorSources();

	it('finds the editable surface and the caret host among the holders', () => {
		const found = holdersIn(sources).map((f) => f.relPath);
		expect(found).toContain('src/lib/components/blocks/editable-surface.ts');
		expect(found).toContain('src/lib/editor-actions/caret-host-input.ts');
	});

	it('every holder asks whether a composed run opens a composition', () => {
		expect(
			skippingOpen(sources),
			'call opensComposition at beforeinput: a range across blocks claims the start, and the block its removal leaves the caret in gets only the runs'
		).toEqual([]);
	});

	it('the matcher flags a holder that asks only about a drop', () => {
		const dropOnly = { relPath: 'a.ts', code: 'if (reportDroppedComposition(e, open)) end();' };
		const both = {
			relPath: 'b.ts',
			code: `${dropOnly.code}\nif (opensComposition(e, open)) open();`
		};
		expect(skippingOpen([dropOnly, both])).toEqual(['a.ts']);
	});
});
