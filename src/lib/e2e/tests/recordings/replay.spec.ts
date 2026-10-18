import { writeFileSync } from 'node:fs';
import { test, expect } from '../../fixtures';
import { EditorPage } from '../../editor-page';
import { reachesExpected, replayStep } from '../../input-replay';
import { enginesOf, eventSignature, recordingFixtures } from '../../recording-fixtures';
import {
	spliceBetween,
	type ExpectedState,
	type InputRecording
} from '../../../debug/input-recording';

// `RECORDINGS_BLESS=1` rewrites a recording's `expected` from this replay and nothing else, so the
// git diff of the file is the review.
const BLESS = !!process.env.RECORDINGS_BLESS;

for (const { name, file, recording } of recordingFixtures()) {
	test(`${name} replays to the bytes and selection it recorded`, async ({ page, browserName }) => {
		test.skip(!enginesOf(recording).includes(browserName), `not replayed in ${browserName}`);
		const editor = new EditorPage(page);
		await editor.goto(`?presentationMode=${recording.editor.presentationMode}`);
		await editor.loadContent(recording.initial.source ?? '');
		if (recording.initial.selection) await editor.bridge.setSelection(recording.initial.selection);
		await page.evaluate(() => (window as any).__test.startInputRecording({ includeText: true }));

		const reached: ExpectedState[] = [];
		let source = await editor.bridge.getSource();
		for (const [i, step] of recording.steps.entries()) {
			await replayStep(editor, step);
			const expected = recording.expected[i];
			const arrived = await reachesExpected(page, expected);
			const now = await page.evaluate(() => ({
				source: (window as any).__test.getSource() as string,
				hash: (window as any).__test.getSourceHash() as string,
				selection: (window as any).__test.getSelection()
			}));
			reached.push({ hash: now.hash, selection: now.selection });
			if (!arrived && !BLESS) {
				// The first divergence fails: every later step would only cascade from it.
				const recorded = JSON.stringify(step.after.splice);
				const replayed = JSON.stringify(spliceBetween(source, now.source));
				expect(
					{ hash: now.hash, selection: now.selection },
					`step ${i} (${step.family}) left other bytes or another selection than expected; recorded splice ${recorded}, replay ${replayed}`
				).toEqual(expected);
			}
			source = now.source;
		}
		const replayed: InputRecording = await page.evaluate(() =>
			(window as any).__test.stopInputRecording()
		);

		if (BLESS) {
			writeFileSync(file, JSON.stringify({ ...recording, expected: reached }, null, '\t') + '\n');
			return;
		}
		// A driver that drifted from the recorded events reds here, apart from the bytes check.
		const recorded = recording.steps.filter((s) => s.family !== 'pointer').map(eventSignature);
		expect(
			replayed.steps.map(eventSignature),
			'the replay drifted from the recorded events'
		).toEqual(recorded);
	});
}
