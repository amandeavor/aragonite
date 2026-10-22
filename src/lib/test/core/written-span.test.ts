// Miss-analysis: the per-character scan was only ever timed on short blocks, so its cost on a
// 1 MB paragraph (two scans a keystroke) showed up only in the report-only giant-paragraph row.
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { writtenSpan } from '../../core/written-span';
import { freshOrFixedSeed } from '../invariants/arbitraries';

/** The plain loop the chunked scan must agree with. */
function spanByLoop(before: string, after: string) {
	const shorter = Math.min(before.length, after.length);
	let start = 0;
	while (start < shorter && before[start] === after[start]) start++;
	let suffix = 0;
	while (
		suffix < shorter - start &&
		before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
	) {
		suffix++;
	}
	return { start, end: after.length - suffix, removedEnd: before.length - suffix };
}

describe('writtenSpan: the span a write changed', () => {
	it('matches the plain loop for an edit at every chunk edge of a long block', () => {
		const block = 'ab\n'.repeat(1500);
		for (const at of [0, 1, 1023, 1024, 1025, 2047, 2048, 3072, block.length - 1, block.length]) {
			for (const [removed, inserted] of [
				[0, 'x'],
				[1, ''],
				[2, 'yz'],
				[0, 'ab\n']
			] as const) {
				const after = block.slice(0, at) + inserted + block.slice(at + removed);
				expect(writtenSpan(block, after), `${at} -${removed} +${inserted}`).toEqual(
					spanByLoop(block, after)
				);
			}
		}
	});

	it('matches the plain loop on any two strings', () => {
		const text = fc.string({ unit: fc.constantFrom('a', 'b', '\n', '\r'), maxLength: 3000 });
		fc.assert(
			fc.property(text, text, (before, after) => {
				expect(writtenSpan(before, after)).toEqual(spanByLoop(before, after));
			}),
			{ seed: freshOrFixedSeed(1024), numRuns: 300 }
		);
	});
});
