// G1.117: a write never turns a CRLF pair into a lone `\r` or a lone `\n`.
// Miss-analysis: no check compared a document's line endings across a write, so a split pair
// reached the bytes silently.
import { describe, it, expect } from 'vitest';
import { checkLineEndingPairsKept } from '../../invariants/line-ending-pairs';
import { lineEndingCounts } from '../../core/line-ending-pairs';
import { serialize } from '../../core/serializer';
import { makeTopHarness } from '../harness/editor-actions';
import { takeDevWarns } from '../support/warn-gate';

const counts = lineEndingCounts;
const BEFORE = 'abc\r\nAfter\r\n';

describe('G1.117 a write keeps every CRLF pair whole', () => {
	it('names a pair split into a lone `\\r`, a lone `\\n`, or both', () => {
		for (const after of ['abc\rZ\nAfter\r\n', 'abc\rAfter\r\n', 'abc\nAfter\r\n']) {
			expect(checkLineEndingPairsKept(counts(BEFORE), counts(after))?.code, after).toBe(
				'line-ending-pairs'
			);
		}
	});

	it('passes a pair deleted whole, a new lone `\\r` with no pair lost, and LF text', () => {
		expect(checkLineEndingPairsKept(counts(BEFORE), counts('abcAfter\r\n'))).toBeNull();
		expect(checkLineEndingPairsKept(counts(BEFORE), counts('a\rbc\r\nAfter\r\n'))).toBeNull();
		expect(checkLineEndingPairsKept(counts('a\nb\n'), counts('ab\n'))).toBeNull();
	});

	it('fires from a keystroke write that splits a pair', async () => {
		const h = makeTopHarness(BEFORE);
		takeDevWarns();
		await h.actions.updateBlockContent(0, 'abc\rZ\nAfter', 'authored', 4, 5);
		expect(serialize(h.deps.doc)).toContain('\rZ\n');
		expect(takeDevWarns().map((w) => w.tag)).toContain('invariant:line-ending-pairs');
	});
});
