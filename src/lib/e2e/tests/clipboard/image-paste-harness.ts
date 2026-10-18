import { type Page } from '@playwright/test';
import { dispatchPaste } from '../../clipboard-arm';
import { EditorPage } from '../../editor-page';

/**
 * A real image cannot be written to the system clipboard from a spec, so these dispatch a
 * synthetic `paste` carrying real `File`s: the same `onPaste` entry a user's Ctrl+V reaches.
 * Caret placement, selection, undo and typing stay real user actions.
 */

export const PARAGRAPH = 'AB\n';
export const PNG = { name: 'shot.png', type: 'image/png' };

/** One hook answer per image, in clipboard order; the last entry repeats. */
export interface ImagePasteResponse {
	markdown?: string | null;
	reject?: boolean;
	/** Stay pending until `releaseImport`, so a spec can act mid-upload. */
	hold?: boolean;
}

export const setResponses = (page: Page, responses: ImagePasteResponse[]) =>
	page.evaluate((r) => (window as any).__test.imagePaste.setResponses(r), responses);

export const releaseImport = (page: Page) =>
	page.evaluate(() => (window as any).__test.imagePaste.release());

export const getCalls = (page: Page) =>
	page.evaluate(
		() =>
			(window as any).__test.imagePaste.getCalls() as {
				mimeType: string;
				suggestedName: string | null;
				bytes: number;
			}[]
	);

/** Open the harness with the host hook installed, responses cleared. */
export async function gotoWithHook(page: Page): Promise<EditorPage> {
	const editor = new EditorPage(page);
	await editor.goto('?imagePaste=on');
	await page.evaluate(() => (window as any).__test.imagePaste.reset());
	return editor;
}

/**
 * `at` picks the landing element: `'focused'` is the ordinary Ctrl+V, `'body'` stands in for
 * Chromium's retarget when the cross-block focus endpoint has nowhere to put a caret.
 */
export async function pasteFiles(
	page: Page,
	files: { name: string; type: string }[],
	text = '',
	at: 'focused' | 'body' = 'focused'
): Promise<void> {
	await dispatchPaste(page, { files, entries: text ? { 'text/plain': text } : {}, at });
}
