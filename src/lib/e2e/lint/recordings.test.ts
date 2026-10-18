/**
 * Every checked-in input recording is replayed by the e2e spec or marked `diagnosticOnly`
 * (G4.213). A replayed one holds its text, chains step to step, and has a primitive for every
 * step in each browser it names; any recording's `expected` covers every step.
 */
import { describe, it, expect } from 'vitest';
import type { RecordedStep } from '../../debug/input-recording';
import {
	chainBreaks,
	enginesOf,
	eventSignature,
	recordingFixtures,
	replayProblems
} from '../recording-fixtures';
import { listPlaywrightTests } from './playwright-list';

const fixtures = recordingFixtures();

describe('G4.213 checked-in input recordings', () => {
	it('has at least one, so the rows below run', () => {
		expect(fixtures.length).toBeGreaterThan(0);
	});

	it.each(fixtures.map((f) => [f.name, f] as const))('%s chains and replays', (_, fixture) => {
		expect(chainBreaks(fixture.recording)).toEqual([]);
		expect(replayProblems(fixture.recording)).toEqual([]);
	});

	const titles = listPlaywrightTests()
		.tests.filter((t) => t.project === 'e2e-recordings')
		.map((t) => t.title);

	it('every recording that is not diagnosticOnly has a test in the replay project', () => {
		const unreplayed = fixtures
			.filter((f) => enginesOf(f.recording).length > 0)
			.filter((f) => !titles.some((title) => title.includes(`> ${f.name} replays`)))
			.map((f) => f.file);
		expect(unreplayed).toEqual([]);
	});
});

describe('replayProblems', () => {
	const [{ recording }] = fixtures;

	it('refuses a replayed recording without text', () => {
		expect(replayProblems({ ...recording, text: false })).toContain(
			'a recording without text can only be diagnosticOnly'
		);
	});

	it('refuses a family the browser has no primitive for, and a browser with no replay', () => {
		const steps = recording.steps.map((s, i) =>
			i === 1 ? { ...s, family: 'rewrite' as const } : s
		);
		expect(replayProblems({ ...recording, steps })).toContain(
			'step 1: chromium has no primitive for a rewrite step'
		);
		expect(replayProblems({ ...recording, engines: ['webkit'] })).toContain(
			'no replay for webkit yet'
		);
	});

	it('leaves a diagnosticOnly recording alone', () => {
		expect(replayProblems({ ...recording, text: false, diagnosticOnly: true })).toEqual([]);
	});
});

describe('chainBreaks', () => {
	const [{ recording }] = fixtures;
	const clone = () => structuredClone(recording);

	it('names a step whose before is not the previous after', () => {
		const r = clone();
		r.steps[1].before.hash = 'stale';
		expect(chainBreaks(r)).toEqual(['step 1: before.hash is not the previous hash']);
	});

	it('names a step whose splice does not rebuild its hash', () => {
		const r = clone();
		const last = r.steps.length - 1;
		r.steps[last].after.splice = [0, 0, 'x'];
		expect(chainBreaks(r)).toEqual([`step ${last}: the splice does not rebuild after.hash`]);
	});

	it('names an expected list that misses a step', () => {
		const r = clone();
		r.expected.pop();
		expect(chainBreaks(r)).toEqual([
			`expected has ${r.steps.length - 1} entries for ${r.steps.length} steps`
		]);
	});
});

describe('eventSignature', () => {
	it("leaves out key-ups and a text step's 229, and marks an untrusted event", () => {
		const step = {
			family: 'text',
			events: [
				{ type: 'keydown', dt: 0, trusted: true, keyCode: 229 },
				{ type: 'beforeinput', dt: 0, trusted: true, inputType: 'insertText' },
				{ type: 'compositionend', dt: 0, trusted: false },
				{ type: 'keyup', dt: 0, trusted: true }
			]
		} as RecordedStep;
		expect(eventSignature(step)).toEqual(['beforeinput:insertText', 'compositionend!untrusted']);
	});
});
