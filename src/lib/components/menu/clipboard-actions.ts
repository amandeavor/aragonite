/**
 * The clipboard rows a menu offers: cut and copy through the document's own command, so the
 * editor's copy handlers run as usual, and paste as the clipboard's text handed to the focused
 * block's paste step, as Markdown or as plain text, which the block escapes where it reads Markdown.
 */

import { readClipboardText } from '../../editor-actions/system-clipboard';
import type { AimedInsert } from '../editor-root/focused-surface';

export type ClipboardAction = 'cut' | 'copy' | 'paste' | 'paste-plain';

/** `paste` is null where the menu offers no Paste row. */
export async function runClipboardAction(
	action: ClipboardAction,
	paste: AimedInsert | null
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
			await (action === 'paste-plain' ? paste.plainText(text) : paste.markdown(text));
		}
	}
}
