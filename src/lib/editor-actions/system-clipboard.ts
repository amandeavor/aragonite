/**
 * The editor's writes to the system clipboard outside a copy event, and the text a whole block
 * copies as. A refused write (a webview without clipboard access, a denied permission) is the
 * host's business, so it resolves false and changes nothing.
 */

import { trimTrailingLineEnding } from '../core/lines';

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
