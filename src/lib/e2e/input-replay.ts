/**
 * Replays a recorded input step through the real input primitives: key presses, inserted text,
 * the shared IME driver and the shared clipboard helper. A pointer step is setup only: its caret
 * depends on fonts and viewport, so the replay puts back the selection it left.
 */
import type { Page } from '@playwright/test';
import type { EditorPage } from './editor-page';
import { attachIme } from './simulation/ime';
import { pressedKeydown, type ExpectedState, type RecordedStep } from '../debug/input-recording';
import type { EditorSelection } from '../selection/primitives';

export async function replayStep(editor: EditorPage, step: RecordedStep): Promise<void> {
	const page = editor.page;
	switch (step.family) {
		case 'pointer':
			await editor.bridge.setSelection(step.after.selection as EditorSelection);
			return;
		case 'key':
			await page.keyboard.press(chordOf(step));
			return;
		case 'text':
			for (const e of step.events.filter((e) => e.type === 'beforeinput')) {
				await page.keyboard.insertText(String(e.data ?? ''));
			}
			return;
		case 'paste': {
			const clipboard = step.events.find((e) => e.type === 'paste')?.clipboard ?? {};
			const payload = Object.fromEntries(
				Object.entries(clipboard).filter(([, text]) => typeof text === 'string')
			);
			await editor.seedClipboard(payload);
			await editor.paste();
			return;
		}
		case 'composition':
			await replayComposition(page, step);
			return;
		default:
			throw new Error(`no replay for a ${step.family} step`);
	}
}

/** The step's key with its held modifiers; Ctrl and Cmd both become the platform's own. */
function chordOf(step: RecordedStep): string {
	const down = pressedKeydown(step);
	if (!down?.key) throw new Error('a key step with no key to press');
	const mods = down.mods ?? '';
	const held = [
		/[CM]/.test(mods) ? 'ControlOrMeta' : '',
		mods.includes('A') ? 'Alt' : '',
		// A printable key already carries its shifted form.
		mods.includes('S') && down.key.length > 1 ? 'Shift' : ''
	].filter(Boolean);
	return [...held, down.key].join('+');
}

// The commit fires its own last update, so a recorded update equal to the commit is the commit's.
async function replayComposition(page: Page, step: RecordedStep): Promise<void> {
	const ime = await attachIme(page);
	const end = String(step.events.find((e) => e.type === 'compositionend')?.data ?? '');
	const updates = step.events
		.filter((e) => e.type === 'compositionupdate')
		.map((e) => String(e.data ?? ''));
	if (updates.at(-1) === end) updates.pop();
	for (const text of updates) await ime.compose(text);
	await ime.commit(end);
}

/** Waits for the bytes and selection a step should leave; false when they never arrive. */
export async function reachesExpected(page: Page, expected: ExpectedState): Promise<boolean> {
	return page
		.waitForFunction(
			({ hash, selection }) => {
				const t = (window as any).__test;
				const key = (s: EditorSelection | null) =>
					s && [s.anchor, s.focus].map((p) => [p.path, p.offset, !!p.cellCoordinate]);
				return (
					t.getSourceHash() === hash &&
					JSON.stringify(key(t.getSelection())) === JSON.stringify(key(selection))
				);
			},
			expected,
			{ timeout: 3000, polling: 16 }
		)
		.then(
			() => true,
			() => false
		);
}
