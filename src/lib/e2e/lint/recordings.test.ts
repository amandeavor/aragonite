/**
 * Every checked-in input recording is replayed by the e2e spec or marked `diagnosticOnly`
 * (G4.213). A replayed one holds its text, chains step to step, and has a primitive for every
 * step in each browser it names; any recording's `expected` covers every step.
 */
import { describe, it, expect } from 'vitest';
import { chainBreaks } from '../../debug/input-recording';
import { recordingFixtures, replayProblems, enginesOf } from '../recording-fixtures';
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
