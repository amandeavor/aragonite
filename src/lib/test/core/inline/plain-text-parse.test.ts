// Most keystrokes land in a span with nothing for the inline parse to read, so that span costs
// one search and no scan state; what the search must not skip is held by plain-span.property.
// Miss-analysis: the rebuilt parse kept no shortcut for plain text, and no row counted its work.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { parseInline } from '#lib';
import {
	disablePerfInstruments,
	enablePerfInstruments,
	perfSnapshot,
	resetPerfInstruments
} from '#lib/perf/instruments.js';

beforeEach(() => {
	resetPerfInstruments();
	enablePerfInstruments();
});

afterEach(() => disablePerfInstruments());

const scansFor = (raw: string, start = 0, end = raw.length) => {
	resetPerfInstruments();
	const nodes = parseInline(raw, start, end);
	return { nodes, scans: perfSnapshot().inlineScanCount };
};

describe('a plain span parses without scan state', () => {
	it.each(['Typing a short sentence here', 'Hello, world? Yes; 100% (sure).', 'naïve café 😀'])(
		'%j is one text node',
		(raw) => {
			expect(scansFor(raw)).toEqual({
				nodes: [{ kind: 'text', start: 0, end: raw.length, text: raw }],
				scans: 0
			});
		}
	);

	it('a special character past the range end leaves the range plain', () => {
		expect(scansFor('plain *bold*', 0, 6).scans).toBe(0);
	});

	it.each(['a *b*', 'see www.a.co', 'a@b.co'])('%j builds scan state', (raw) => {
		expect(scansFor(raw).scans).toBe(1);
	});
});
