/**
 * G4.220: the editor writes the system clipboard outside a copy event in one place,
 * `editor-actions/system-clipboard.ts`, where a refused write resolves false instead of throwing.
 */

import { describeFileRules, type FileRule } from './file-rule';
import { collectEditorSources } from './scan-source';

const CLIPBOARD_WRITES: FileRule = {
	id: 'G4.220 a clipboard write outside a copy event goes through the system clipboard writer',
	matches: /\bclipboard\s*[!?]?\s*\.\s*write(?:Text)?\s*\(/,
	allowed: {
		'src/lib/editor-actions/system-clipboard.ts': 'the writer every route calls'
	},
	reason:
		'a webview without clipboard access refuses the write, and a call with no catch is an unhandled rejection: call writeClipboardText, or copyBlockToClipboard for a whole block, from editor-actions/system-clipboard.ts',
	hits: [
		'await navigator.clipboard.writeText(text);',
		'navigator.clipboard!.writeText(raw)',
		'navigator.clipboard.write([item]);'
	],
	misses: ['await writeClipboardText(text);', "e.clipboardData?.setData('text/plain', text);"]
};

describeFileRules([CLIPBOARD_WRITES], collectEditorSources());
