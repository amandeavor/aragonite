// The child spans every container rebuild splices through: a verbatim list child's region, the
// region check that refuses a stale span, the dev check behind it, and the entry points that drop it.
import { describe, it, expect } from 'vitest';
import { takeDevWarns } from '#lib/test/support/warn-gate.js';
import { spliceChildren } from '#lib/tree-operations/children.js';
import { reorderChildren } from '#lib/tree-operations/reorder.js';
import {
	container,
	paragraph,
	rebuild,
	rewriteChild,
	spans
} from '#lib/test/harness/container-rebuild.js';

describe('a list splices its child verbatim', () => {
	it('splices a child whose bytes end without a line ending', () => {
		const node = container('list', [paragraph('- a\n'), paragraph('- b')]);
		rewriteChild(node, 1, '- bb');
		expect(node.raw).toBe('- a\n- bb');
		expect(spans(node)).toEqual([0, 4, 4, 8]);
	});
});

describe('the rebuild refuses a splice it cannot place', () => {
	// A reorder mutates a bare children array, which has no owner to drop spans on: the region
	// check is the whole defense, and without it the moved child's region is written twice.
	it('re-derives after a reorder no join could invalidate for it', () => {
		const node = container('blockquote', [paragraph('a\n'), paragraph('bbbb\n')]);
		expect(node.raw).toBe('> a\n> bbbb\n');
		reorderChildren(node.children!, 1, 0);
		rewriteChild(node, 0, 'bbbbb\n');
		expect(node.raw).toBe('> bbbbb\n> a\n');
	});
});

// Only the dev-mode check catches a sibling's bytes moving under the spans (G1.38): the region
// check reads just the rewritten child, and nothing dropped the spans or changed the count.
describe('the dev belt behind a splice', () => {
	it('fires and re-derives when a sibling moved under the spans', () => {
		const node = container('blockquote', [paragraph('a\n'), paragraph('b\n')]);
		expect(node.raw).toBe('> a\n> b\n');
		// Hand-written, the way a reorder writes: past every entry point, so nothing drops the spans.
		node.children![1].leadingTrivia = '\n';

		rewriteChild(node, 0, 'aa\n');

		expect(takeDevWarns().map((warn) => warn.tag)).toEqual(['invariant:child-spans-faithful']);
		expect(node.raw).toBe('> aa\n>\n> b\n');
		expect(spans(node)).toEqual([0, 5, 5, 11]);
	});
});

describe('the children entry points drop the spans they invalidate', () => {
	it('drops on a replacing splice and on an appending one', () => {
		const node = container('blockquote', [paragraph('a\n'), paragraph('b\n')]);
		// A typed array, not a plain one: Svelte proxies plain arrays, and the shift would create a
		// reactive source per element, the per-child cost the spans exist to remove.
		expect(node.childSpans).toBeInstanceOf(Uint32Array);
		expect(spans(node)).toEqual([0, 4, 4, 8]);
		spliceChildren(node, 1, 1, [paragraph('c\n')]);
		expect(node.childSpans).toBeUndefined();
		rebuild(node);
		spliceChildren(node, 2, 0, [paragraph('d\n')]);
		expect(node.childSpans).toBeUndefined();
		rebuild(node);
		expect(node.raw).toBe('> a\n> c\n> d\n');
	});
});
