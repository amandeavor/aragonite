// Miss-analysis: every renumbering fixture started its list at 1, where a renumber that resets the
// list to 1 writes the bytes it read.
import { describe, it, expect } from 'vitest';
import { serialize } from '#lib/core/serializer.js';
import { registerBlockListState } from '#lib/block-lists/state-registry.js';
import {
	makeBlockListState,
	makeEditorActionsDeps,
	makeListContextAt,
	makeNestedHarness
} from '#lib/test/harness/editor-actions.js';
import { expectParseConverged } from '#lib/test/harness/parse-converged.js';
import { makeReorderContainer } from './reorder-harness';

describe('a reorder keeps the ordered list’s first number', () => {
	it.each([
		{ move: 'the last item up one', from: 2, to: 1, bytes: '8. a\n9. c\n10. b\n' },
		{ move: 'the second item above the first', from: 1, to: 0, bytes: '8. b\n9. a\n10. c\n' },
		{ move: 'the first item down one', from: 0, to: 1, bytes: '8. b\n9. a\n10. c\n' },
		{ move: 'the last item to the top', from: 2, to: 0, bytes: '8. c\n9. a\n10. b\n' }
	])('moving $move', async ({ from, to, bytes }) => {
		const h = makeReorderContainer('8. a\n9. b\n10. c\n');
		await h.reorder.moveReorderUnit([0, from, 0], to);
		expect(serialize(h.doc)).toBe(bytes);
		h.assertStable();
	});
});

/** The top-level list's item 0 and the sublist it holds, both mounted. */
function mountFirstItem(source: string) {
	const { deps } = makeEditorActionsDeps(source);
	const item = () => deps.doc.children[0].children![0];
	const sublist = () => item().children![1];
	registerBlockListState(item(), makeBlockListState(item));
	registerBlockListState(sublist(), makeBlockListState(sublist));
	const { listContext } = makeListContextAt(deps, 0);
	return { deps, sublist, listContext };
}

// The blank lines are load-bearing: GFM lets only a list starting at 1 interrupt a paragraph, so
// without one `5. x` reads as more of `a`'s text.
describe('an indent or outdent keeps each ordered list’s first number', () => {
	it('Tab into a sublist that starts at 5 continues it', async () => {
		const { deps, listContext } = mountFirstItem('1. a\n\n   5. x\n2. b\n');
		expect(await listContext.indentItem(1)).toBe(true);
		expectParseConverged(deps.doc);
		expect(serialize(deps.doc)).toBe('1. a\n\n   5. x\n   6. b\n');
	});

	it.each([
		{
			case: 'the sublist the item leaves',
			source: '1. a\n\n   5. x\n   6. y\n',
			item: 1,
			bytes: '1. a\n\n   5. x\n2. y\n'
		},
		{
			case: 'the lifted item’s own sublist, which its later siblings join',
			source: '1. a\n   1. x\n\n      3. q\n   2. y\n',
			item: 0,
			bytes: '1. a\n2. x\n\n   3. q\n   4. y\n'
		}
	])('Shift+Tab keeps $case', async ({ source, item, bytes }) => {
		const { deps, sublist, listContext } = mountFirstItem(source);
		expect(await listContext.promoteNestedItem(0, sublist(), item)).toBe(true);
		expectParseConverged(deps.doc);
		expect(serialize(deps.doc)).toBe(bytes);
	});
});

describe('deleting the first item keeps the ordered list’s first number', () => {
	it('Backspace in an empty first item', async () => {
		const h = makeNestedHarness('8. \n9. b\n10. c\n', { index: 0 });
		await h.bundle.blockEdit.mergeWithPrevious(0);
		expectParseConverged(h.deps.doc);
		expect(serialize(h.deps.doc)).toBe('8. b\n9. c\n');
	});
});
