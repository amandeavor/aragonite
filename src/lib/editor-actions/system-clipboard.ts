/**
 * The editor's reads and writes of the system clipboard outside a copy or paste event, and the text
 * a whole block copies as. A refused call (a webview without clipboard access, a denied permission,
 * a dismissed Paste prompt) is the host's business, so it resolves to nothing and changes nothing.
 */

import { tick } from 'svelte';
import { trimTrailingLineEnding } from '../core/lines';

/** The clipboard's text, or null when the read is refused. It reads once a menu that just closed
 *  has left the page, since Safari draws its Paste prompt over whatever still shows. */
export async function readClipboardText(): Promise<string | null> {
	await tick();
	try {
		return await navigator.clipboard.readText();
	} catch {
		return null;
	}
}

/** Whether `text` reached the clipboard. */
export async function writeClipboardText(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}

/** A block's Markdown on the clipboard, without the line ending that closes it, so every route
 *  that copies one block writes the same text. */
export function copyBlockToClipboard(raw: string): Promise<boolean> {
	return writeClipboardText(trimTrailingLineEnding(raw));
}
