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

// Miss-analysis: every row parsed a range ending at or near its string's end, so a search
// running on to the block's end cost nothing any row could see.
describe('a range parse reads nothing past the range end', () => {
	/** Median microseconds per parse of `[0, range.length)`, alone and at the head of `raw`. */
	const microsPerParse = (raw: string, end: number) => {
		const reps = 40;
		const samples: number[] = [];
		for (let sample = 0; sample < 7; sample++) {
			const started = performance.now();
			for (let i = 0; i < reps; i++) parseInline(raw, 0, end);
			samples.push(((performance.now() - started) * 1000) / reps);
		}
		return samples.sort((a, b) => a - b)[3];
	};
	// A plain tail with no character the parse reads, so a search past the range finds nothing.
	const tail = ' plain words'.repeat(400_000);

	it.each(['plain words only', 'a *b* and c'])('%j costs the same at the head of 4 MB', (range) => {
		const alone = microsPerParse(range, range.length);
		const atHead = microsPerParse(range + tail, range.length);
		expect(atHead / Math.max(alone, 0.05)).toBeLessThan(10);
	});
});
