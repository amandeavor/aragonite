// @vitest-environment jsdom
// The bytes a drag carries out of a leaf are cut by the same rule as the bytes it leaves behind,
// so the two agree on screen: put back where they were, they show what the leaf showed.
// Miss-analysis: the drop's tests moved plain words only, so the raw slice it carried never held
// a delimiter run whose partner stayed behind.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { parse } from '#lib/core/parser.js';
import { blockNodeAt } from '#lib/tree-operations/node-primitives.js';
import { storedAsAt } from '#lib/tree-operations/stored-as.js';
import {
	bytesLeavingLeaf,
	joinLeaves,
	replaceRangeInLeaf
} from '#lib/tree-operations/leaf-range.js';
import { readBack, shownOf } from '#lib/core/inline/live-edit/read-back.js';
import { getContentRange } from '#lib/core/inline/index.js';
import { cleanLiveJoinSeam } from '#lib/components/blocks/text/live-join-seam.js';
import {
	registerLiveJoinSeamCleaner,
	__resetLiveJoinSeamCleanerForTests
} from '#lib/schema/inline-construct-policy.js';
import type { StoredAs } from '#lib/schema/stored-as.js';
import type { PresentationMode } from '#lib/presentation-mode.js';
import { fixtureReading } from '../harness/fixture-grammar';

beforeAll(() => registerLiveJoinSeamCleaner(cleanLiveJoinSeam));
afterAll(() => __resetLiveJoinSeamCleanerForTests());

function leaving(
	source: string,
	path: number[],
	from: string,
	to: string,
	mode: PresentationMode = 'live'
) {
	const doc = parse(source);
	const node = blockNodeAt(doc, path)!;
	const start = node.raw.indexOf(from);
	const range = { start, end: node.raw.indexOf(to, start) + to.length };
	const store = storedAsAt(doc, path, fixtureReading({}, mode));
	const cut = replaceRangeInLeaf(node, range, '', store);
	return { node, store, cut, moved: bytesLeavingLeaf(node, range, store) };
}

const shown = (bytes: string, store: StoredAs): string => shownOf(readBack(bytes, store)!, store);

// Each range runs from the start of `from` to the end of the `to` after it.
const SHAPES: Array<[string, string, number[], string, string]> = [
	['a run closing inside the range', 'Some **bold** and words tail\n', [0], 'ld**', ' an'],
	['a run opening inside the range', 'Some text **and bold** tail\n', [0], 'text', '**an'],
	['a run wrapping the whole range', '**a b c** x\n', [0], 'b', 'b'],
	['a to-do item’s text', '- [ ] Some **bold** and words tail\n', [0, 0, 0], 'ld**', ' an'],
	['a heading’s text', '# Some **bold** and words\n', [0], 'ld**', ' an'],
	['a table cell', '| Some **bold** and |\n| - |\n| x |\n', [0, 0, 0], 'ld**', ' an']
];

describe('the bytes a range takes out of a leaf', () => {
	it.each(SHAPES)(
		'put back where they were, show what the leaf showed: %s',
		(_label, source, path, from, to) => {
			const { node, store, cut, moved } = leaving(source, path, from, to);
			const restored = cut.raw.slice(0, cut.caret) + moved + cut.raw.slice(cut.caret);

			expect(shown(restored, store)).toBe(shown(node.raw, store));
		}
	);

	// The tail cut leaves only the leaf's own trailing bytes after the range, so the head cut must
	// leave them alone too, or the map would end the moved bytes in the wrong place.
	it.each(SHAPES)(
		'end where the leaf’s trailing bytes start: %s',
		(_label, source, path, from, to) => {
			const { node, store } = leaving(source, path, from, to);
			const start = node.raw.indexOf(from);
			const end = node.raw.indexOf(to, start) + to.length;
			const content = getContentRange(node);
			const tail = replaceRangeInLeaf(
				node,
				{ start: end, end: Math.max(end, content.end) },
				'',
				store
			);
			const head = replaceRangeInLeaf(
				{ ...node, raw: tail.raw },
				{ start: Math.min(start, content.start), end: tail.mapOffset(start) },
				'',
				store
			);

			expect(head.mapOffset(tail.caret)).toBe(head.raw.length - (tail.raw.length - tail.caret));
		}
	);

	it('carry no run whose partner stays behind', () => {
		const { cut, moved } = leaving('Some **bold** and words tail\n', [0], 'ld**', ' an');

		expect(moved).toBe('ld an');
		expect(cut.raw).toBe('Some bod words tail\n');
	});

	it('are the plain slice in source mode', () => {
		const { moved } = leaving('Some **bold** and words tail\n', [0], 'ld**', ' an', 'source');

		expect(moved).toBe('ld** an');
	});
});

describe('where a range replace puts the old bytes', () => {
	const map = (source: string, start: number, end: number, typed: string) => {
		const doc = parse(source);
		const edit = replaceRangeInLeaf(
			doc.children[0],
			{ start, end },
			typed,
			storedAsAt(doc, [0], fixtureReading({}, 'live'))
		);
		return (offset: number) => edit.mapOffset(offset);
	};

	it('shifts the bytes past a literal splice by what it wrote', () => {
		const at = map('abc def\n', 1, 3, 'XYZ');
		expect([0, 1, 2, 3, 5].map(at)).toEqual([0, 1, 1, 4, 6]);
	});

	it('lands a byte the join cleanup dropped where its run stood', () => {
		// `Some **bo` + `d words`: the opener goes, so `bo` moves back two bytes.
		const at = map('Some **bold** and words tail\n', 9, 16, '');
		expect([4, 5, 6, 7, 9, 16, 17].map(at)).toEqual([4, 5, 5, 5, 7, 7, 8]);
	});

	it('keeps a join’s seam before the text typed into it', () => {
		const doc = parse('ab\n\ncd\n');
		const [first, second] = doc.children;
		const store = storedAsAt(doc, [0], fixtureReading({}, 'live'));
		const join = joinLeaves(
			{ node: first, offset: 2 },
			{ node: second, offset: 0 },
			'X',
			store,
			'\n'
		);

		expect([1, 2, 3].map((offset) => join.map(offset))).toEqual([1, 2, 4]);
	});
});
