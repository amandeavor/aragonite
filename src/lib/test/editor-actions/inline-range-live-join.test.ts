// @vitest-environment jsdom
// In live mode an inline range write cleans its join like a cut: removing the only thing inside a
// link or a bold run leaves no `[](u)` or `****` behind, and a construct swapped for another stays.
// Miss-analysis: no test called the image overlay's Remove, and every inline range test ran in
// source mode, so the range write's literal splice never stood beside a hidden run.
import { describe, expect, it } from 'vitest';
import { createInlineRangeCommit } from '#lib/editor-actions/inline-range-commit.js';
import { createImageEditCommitter } from '#lib/components/image/image-edit-commit.js';
import { createSelectionState } from '#lib/selection/selection-state.svelte.js';
import type { PresentationMode } from '#lib/presentation-mode.js';
import { testCaretWriter } from '#lib/test/harness/caret-writer.js';
import { makeTopHarness } from '../harness/editor-actions';
import { fixtureReading } from '../harness/fixture-grammar';

function harness(source: string, mode: PresentationMode) {
	const reading = fixtureReading({}, mode);
	const h = makeTopHarness(source, { reading });
	const inlineRange = createInlineRangeCommit({ deps: h.deps, controller: h.controller });
	return { ...h, reading, inlineRange };
}

const IMAGE = '![b](i.png)';

describe("the image overlay's Remove", () => {
	it.each([
		['the only content of a link', 'x [![b](i.png)](u) y\n', 'live', 'x  y\n'],
		['the only content of a bold run', 'a **![b](i.png)** c\n', 'live', 'a  c\n'],
		[
			'the only content of a link, in source mode',
			'x [![b](i.png)](u) y\n',
			'source',
			'x [](u) y\n'
		]
	] as const)('removes %s: %j', async (_label, source, mode, expected) => {
		const h = harness(source, mode);
		const committer = createImageEditCommitter({
			caretWriter: testCaretWriter,
			getDoc: () => h.doc,
			getEditorEl: () => null,
			selection: createSelectionState(),
			inlineRange: h.inlineRange,
			events: h.events,
			reading: h.reading
		});

		committer.removeImage({
			paragraphPath: [0],
			sourceStart: source.indexOf(IMAGE),
			preSelectOffset: 0
		});

		await expect.poll(() => h.doc.children[0].raw).toBe(expected);
	});
});

describe('an inline range write in live mode', () => {
	it('lands the caret where the cleaned join meets', async () => {
		const source = 'a **![b](i.png)** c\n';
		const h = harness(source, 'live');
		const start = source.indexOf(IMAGE);

		await h.inlineRange.commitInlineRange([0], start, start + IMAGE.length, '', start, {
			landCaret: true
		});

		expect(h.doc.children[0].raw).toBe('a  c\n');
		expect(h.landings).toMatchObject([{ leafPath: [0], offset: 'a '.length }]);
	});

	it('reports the length the cleaned join stores', () => {
		const source = 'x [![b](i.png)](u) y\n';
		const h = harness(source, 'live');
		const start = source.indexOf(IMAGE);

		expect(h.inlineRange.writtenDelta([0], start, start + IMAGE.length, '')).toBe(
			'x  y\n'.length - source.length
		);
	});

	// A construct swapped for another leaves every run around it paired, so nothing is cleaned.
	it.each([
		['a link card url', '**[x](old)** y\n', '[x](old)', '[x](new)'],
		['an image field', '**![b](i.png)** y\n', IMAGE, '![c](i.png)'],
		['a menu pick', '**see [[qu** y\n', '[[qu', '[[Page]]']
	])('writes %s inside a bold run as asked', async (_label, source, from, to) => {
		const h = harness(source, 'live');
		const start = source.indexOf(from);

		await h.inlineRange.commitInlineRange([0], start, start + from.length, to, start);

		expect(h.doc.children[0].raw).toBe(source.replace(from, to));
	});
});
