// Two blocks an edit leaves side by side reload as those two: a pair a removal or a move uncovers
// folds as prose (a paragraph or lazy line taking the text below), but never changes a block's
// kind, and a block a move places beside a neighbour stays apart from it.
// Miss-analysis: the uncovered-join tests were all prose pairs, so no row put a table or a `---`
// under the paragraph a delete or a move left behind.
import { describe, it, expect } from 'vitest';
import { serialize } from '#lib/core/serializer.js';
import { makeTopHarness } from '#lib/test/harness/editor-actions.js';
import { makeReorderHarness } from '#lib/test/editor-actions/reorder-harness.js';
import { expectParseConverged } from '#lib/test/harness/parse-converged.js';

type Uncover = (source: string, index: number) => Promise<{ kinds: string[]; bytes: string }>;

/** The two ways an edit uncovers the pair around block `index`: deleting it, and moving it up. */
const UNCOVERS: [string, Uncover][] = [
	[
		'deleting the block between them',
		async (source, index) => {
			const h = makeTopHarness(source);
			await h.actions.deleteBlock(index, 'keyless');
			expectParseConverged(h.deps.doc);
			return { kinds: h.deps.doc.children.map((c) => c.kind), bytes: serialize(h.deps.doc) };
		}
	],
	[
		'moving the block between them up',
		async (source, index) => {
			const h = makeReorderHarness(source);
			await h.reorder.nudgeReorderUnit([index], -1);
			expectParseConverged(h.doc);
			return { kinds: h.doc.children.slice(1).map((c) => c.kind), bytes: serialize(h.doc) };
		}
	]
];

describe.each(UNCOVERS)('the pair a block leaves, %s (#479)', (_, uncover) => {
	it.each([
		['a table', 'a\n# h\n| A | B |\n| - | - |\n', ['paragraph', 'table']],
		['a rule', 'a\n# h\n---\n', ['paragraph', 'thematicBreak']]
	])('keeps %s under the paragraph above it', async (_l, source, kinds) => {
		const { kinds: after } = await uncover(source, 1);
		expect(after).toEqual(kinds);
	});

	it.each([
		['prose under prose', 'a\n# h\nb\n', ['paragraph']],
		['prose under a quote', '> q\n# h\np\n', ['blockquote']]
	])('lets %s fold in as the reload reads it', async (_l, source, kinds) => {
		const { kinds: after } = await uncover(source, 1);
		expect(after).toEqual(kinds);
	});
});

describe('a block a move places', () => {
	// The moved block takes the heading's flush slot, since a blank line stays with its position.
	it.each([
		['a table', 'x\n# h\n\n| A |\n| - |\n', 'table'],
		['a rule', 'x\n# h\n\n---\n', 'thematicBreak'],
		['prose', 'x\n# h\n\nb\n', 'paragraph']
	])('flush under a paragraph, %s keeps its own reading', async (_l, source, kind) => {
		const h = makeReorderHarness(source);
		await h.reorder.nudgeReorderUnit([2], -1);
		expect(h.doc.children.map((c) => c.kind)).toEqual(['paragraph', kind, 'heading']);
		expectParseConverged(h.doc);
	});
});

describe('a join no blank line can part', () => {
	// A list item takes indented code in across blank lines, so deleting what stood between them
	// merges them whatever the edit's origin.
	it('a list over indented code takes it in once the block between goes', async () => {
		const h = makeTopHarness('- a\n\n# h\n\n      code\n');
		await h.actions.deleteBlock(1, 'keyless');
		expect(h.deps.doc.children.map((c) => c.kind)).toEqual(['list']);
		expectParseConverged(h.deps.doc);
	});
});
