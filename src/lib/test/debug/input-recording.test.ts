import { describe, it, expect } from 'vitest';
import {
	INPUT_RECORDING_FORMAT,
	applySplice,
	chainBreaks,
	eventSignature,
	hashSource,
	matchesExpected,
	readInputRecording,
	spliceBetween,
	type InputRecording,
	type RecordedStep
} from '#lib/debug/input-recording.js';

// Miss-analysis: new module; the e2e replay and the recordings lint both trust these functions,
// so a wrong splice or a lax reader would pass every fixture silently.

const caret = (offset: number) => ({
	anchor: { path: [0], offset },
	focus: { path: [0], offset }
});

function recording(sources: string[], text = true): InputRecording {
	const steps: RecordedStep[] = sources.slice(1).map((source, i) => ({
		family: 'key',
		before: { version: i, hash: hashSource(sources[i]), selection: null },
		after: {
			version: i + 1,
			hash: hashSource(source),
			selection: caret(source.length),
			splice: spliceBetween(sources[i], source, text)
		},
		events: []
	}));
	return {
		format: INPUT_RECORDING_FORMAT,
		editor: { version: '0', presentationMode: 'source', caret: 'auto' },
		text,
		env: {
			userAgent: '',
			uaData: null,
			inputMethod: 'test',
			pointer: 'fine',
			viewport: [0, 0],
			dpr: 1
		},
		initial: {
			source: text ? sources[0] : undefined,
			hash: hashSource(sources[0]),
			selection: null
		},
		steps,
		expected: steps.map((s) => ({ hash: s.after.hash, selection: s.after.selection }))
	};
}

describe('splices', () => {
	it.each([
		['an insert', 'ab\n', 'aXb\n'],
		['a delete at the start', 'abc', 'bc'],
		['a replace inside a repeated run', 'aaaa', 'aXa'],
		['a surrogate pair typed after its twin half', 'x😀', 'x😀😀'],
		['no change', 'same', 'same']
	])('rebuild %s', (_, before, after) => {
		expect(applySplice(before, spliceBetween(before, after, true))).toBe(after);
	});

	it('carry only the inserted length without text', () => {
		expect(spliceBetween('ab', 'aXYb', false)).toEqual([1, 1, 2]);
	});
});

describe('chainBreaks', () => {
	it('passes a recording whose steps chain', () => {
		expect(chainBreaks(recording(['a\n', 'ab\n', 'a\n']))).toEqual([]);
	});

	it('names a step whose splice does not rebuild its hash', () => {
		const r = recording(['a\n', 'ab\n']);
		r.steps[0].after.splice = [1, 1, 'c'];
		expect(chainBreaks(r)).toEqual(['step 0: the splice does not rebuild after.hash']);
	});

	it("names a step whose before isn't the previous after, text or not", () => {
		const r = recording(['a\n', 'ab\n', 'abc\n'], false);
		r.steps[1].before.hash = 'stale';
		expect(chainBreaks(r)).toEqual(['step 1: before.hash is not the previous hash']);
	});

	it('names an expected list that misses a step', () => {
		const r = recording(['a\n', 'ab\n']);
		r.expected = [];
		expect(chainBreaks(r)).toEqual(['expected has 0 entries for 1 steps']);
	});
});

describe('readInputRecording', () => {
	it('reads the current format', () => {
		const r = recording(['a']);
		expect(readInputRecording(JSON.stringify(r))).toEqual(r);
	});

	it('refuses another version of the format in plain words', () => {
		expect(() => readInputRecording({ format: 'aragonite-input-recording/2' })).toThrow(
			'This recording is aragonite-input-recording/2, and this aragonite reads only aragonite-input-recording/1.'
		);
	});

	it('refuses something that is not a recording', () => {
		expect(() => readInputRecording('{"steps":[]}')).toThrow('Not an aragonite input recording');
	});
});

describe('comparing a replay', () => {
	it('matches on the bytes and the whole selection', () => {
		const expected = { hash: hashSource('ab'), selection: caret(2) };
		expect(matchesExpected(expected, { source: 'ab', selection: caret(2) })).toBe(true);
		expect(matchesExpected(expected, { source: 'ab', selection: caret(1) })).toBe(false);
		expect(matchesExpected(expected, { source: 'ba', selection: caret(2) })).toBe(false);
	});

	it("signs the events a driver reproduces, leaving out key-ups and a text step's 229", () => {
		const step: RecordedStep = {
			...recording(['a', 'ab']).steps[0],
			family: 'text',
			events: [
				{ type: 'keydown', dt: 0, trusted: true, keyCode: 229 },
				{ type: 'beforeinput', dt: 0, trusted: true, inputType: 'insertText' },
				{ type: 'compositionend', dt: 0, trusted: false },
				{ type: 'keyup', dt: 0, trusted: true }
			]
		};
		expect(eventSignature(step)).toEqual(['beforeinput:insertText', 'compositionend!untrusted']);
	});
});
