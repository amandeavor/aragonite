/**
 * The clipboard rows a menu offers: cut and copy through the document's own command, so the
 * editor's copy handlers run as usual, and paste as the clipboard's text handed to the focused
 * block's paste step, as is or escaped so Markdown syntax arrives as literal text.
 */

import { readClipboardText } from '../../editor-actions/system-clipboard';

export type ClipboardAction = 'cut' | 'copy' | 'paste' | 'paste-plain';

/** The focused block's paste step, the one a keyboard paste runs (`insertMarkdown`). */
export type PasteText = (text: string) => Promise<unknown>;

/** Markdown-significant bytes, escaped so pasted text reads back exactly as pasted. */
function escapeMarkdownLiteral(text: string): string {
	return text
		.replace(/[\\`*_[\]<>|~]/g, '\\$&')
		.replace(/^([ \t]*)([#>+-])/gm, '$1\\$2')
		.replace(/^([ \t]*)(\d+)([.)])/gm, '$1$2\\$3');
}

/** `paste` is null where the menu offers no Paste row. */
export async function runClipboardAction(
	action: ClipboardAction,
	paste: PasteText | null
): Promise<void> {
	switch (action) {
		case 'cut':
		case 'copy':
			document.execCommand(action);
			return;
		case 'paste':
		case 'paste-plain': {
			if (!paste) return;
			const text = await readClipboardText();
			if (!text) return;
			await paste(action === 'paste-plain' ? escapeMarkdownLiteral(text) : text);
		}
	}
}
