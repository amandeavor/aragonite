import { describe, it, expect } from 'vitest';
import {
	INPUT_RECORDING_FORMAT,
	readInputRecording,
	spliceBetween
} from '#lib/debug/input-recording.js';

// Miss-analysis: new module; the e2e replay and the recordings lint both trust these functions,
// so a wrong splice or a lax reader would pass every fixture silently.

describe('splices', () => {
	it.each([
		['an insert', 'ab\n', 'aXb\n'],
		['a delete at the start', 'abc', 'bc'],
		['a replace inside a repeated run', 'aaaa', 'aXa'],
		['a surrogate pair typed after its twin half', 'x😀', 'x😀😀'],
		['no change', 'same', 'same']
	])('rebuild %s', (_, before, after) => {
		const [from, to, inserted] = spliceBetween(before, after);
		expect(before.slice(0, from) + inserted + before.slice(to)).toBe(after);
	});
});

describe('readInputRecording', () => {
	it('reads the current format', () => {
		const r = { format: INPUT_RECORDING_FORMAT, steps: [] };
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
