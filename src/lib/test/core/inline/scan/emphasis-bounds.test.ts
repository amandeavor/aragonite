import { describe, it, expect } from 'vitest';
import { parseInline } from '../../../../core/inline';
import { expectBoundedGrowth, measureScanGrowth } from '../../../harness/scan-growth';
import { assertConstructCoverage, assertTotalCoverage, collectKind } from './scan-test-helpers';

const scan = (raw: string) => parseInline(raw, 0, raw.length);

// A paragraph of many pairs must parse in linear time; work per pair that grows with the
// paragraph turns it quadratic.
describe('emphasis pairing bounds', () => {
	// 24KB because a few KB of pairs scans under the harness's noise floor, and a declared size
	// under the floor is one the harness only ever replaces.
	it('a pair flood scans within a bounded growth ratio', () => {
		const growth = measureScanGrowth(scan, '*a*', [24, 96]);
		expectBoundedGrowth(growth);
	}, 300_000);

	// Two marker characters per side are a case of their own, so a bound that held only
	// for the one-character run would miss a regression in the two-character path.
	it('a strong and strikethrough flood scans within a bounded growth ratio', () => {
		const growth = measureScanGrowth(scan, '**a** ~~b~~ ', [24, 96]);
		expectBoundedGrowth(growth);
	}, 300_000);

	// Emphasis inside each link label pairs inside that label, so cost per label must not grow
	// with the paragraph.
	it('emphasis nested in a link flood scans within a bounded growth ratio', () => {
		const growth = measureScanGrowth(scan, '[*a*](u) ', [24, 96]);
		expectBoundedGrowth(growth);
	}, 300_000);

	// The growth rows read a scan that stops pairing past some count as linear; this row counts
	// every pair. Spaced, since an unspaced `*a*` abuts into shared `**` runs.
	it('claims every pair in a flood with markers and interiors intact', () => {
		const pairs = 20_000;
		const raw = '*a* '.repeat(pairs);
		const nodes = scan(raw);
		assertTotalCoverage(nodes, 0, raw.length);
		assertConstructCoverage(nodes);
		expect(collectKind(nodes, 'emphasis')).toHaveLength(pairs);
		expect(nodes.filter((n) => n.kind !== 'emphasis').every((n) => n.kind === 'text')).toBe(true);
	}, 120_000);

	// Nesting is the same case: an inner pair must land back in
	// the list where the outer pair can still collect it as a child.
	it('nests a pair flood without losing a level', () => {
		const depth = 2000;
		const raw = '*'.repeat(depth) + 'x' + '*'.repeat(depth);
		const nodes = scan(raw);
		assertTotalCoverage(nodes, 0, raw.length);
		assertConstructCoverage(nodes);
		// Runs of `depth` collapse into strong pairs from the inside out, plus one
		// emphasis when the run length is odd.
		expect(collectKind(nodes, 'strong')).toHaveLength(Math.floor(depth / 2));
		expect(collectKind(nodes, 'emphasis')).toHaveLength(depth % 2);
	}, 120_000);
});
