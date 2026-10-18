/**
 * The checked-in input recordings and the rule each one follows: the e2e spec replays it, or it
 * says it's only for reading (`diagnosticOnly`). The replay spec and the recordings lint (G4.213)
 * both read this list, so a recording can't sit in the folder run by neither.
 */
import { readdirSync, readFileSync } from 'node:fs';
import {
	chainBreaks,
	pressedKeydown,
	readInputRecording,
	type InputRecording,
	type StepFamily
} from '../debug/input-recording';

export const RECORDINGS_DIR = 'src/lib/e2e/recordings';

/** The step families each engine reproduces through a real input primitive. A browser joins only
 *  after one green run of every recording that names it. */
export const REPLAYABLE: Record<string, readonly StepFamily[]> = {
	chromium: ['pointer', 'key', 'text', 'composition', 'paste']
};

export interface RecordingFixture {
	name: string;
	file: string;
	recording: InputRecording;
}

export function recordingFixtures(): RecordingFixture[] {
	return readdirSync(RECORDINGS_DIR)
		.filter((file) => file.endsWith('.json'))
		.map((file) => {
			const full = `${RECORDINGS_DIR}/${file}`;
			return {
				name: file.replace(/\.json$/, ''),
				file: full,
				recording: readInputRecording(readFileSync(full, 'utf8'))
			};
		});
}

export function enginesOf(recording: InputRecording): string[] {
	return recording.diagnosticOnly ? [] : (recording.engines ?? ['chromium']);
}

/** Why the e2e replay can't run this recording, one message per problem; empty when it can. */
export function replayProblems(recording: InputRecording): string[] {
	if (recording.diagnosticOnly) return [];
	const problems = chainBreaks(recording);
	if (!recording.text) problems.push('a recording without text can only be diagnosticOnly');
	for (const engine of enginesOf(recording)) {
		const families = REPLAYABLE[engine];
		if (!families) {
			problems.push(`no replay for ${engine} yet`);
			continue;
		}
		recording.steps.forEach((step, i) => {
			if (!families.includes(step.family)) {
				problems.push(`step ${i}: ${engine} has no primitive for a ${step.family} step`);
			} else if (step.family === 'pointer' && step.before.hash !== step.after.hash) {
				problems.push(`step ${i}: a pointer step that changes bytes needs a real click`);
			} else if (step.family === 'key' && pressedKeydown(step)?.key === undefined) {
				problems.push(`step ${i}: a key step with no key to press`);
			}
		});
	}
	return problems;
}
