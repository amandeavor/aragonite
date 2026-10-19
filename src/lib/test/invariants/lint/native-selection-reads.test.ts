/**
 * G4.222: the browser's selection is read in named modules only, the bridge readers in
 * `selection/native-bridge.ts` and the caret and selection internals below, so an engine quirk in
 * what the selection reports gets fixed in one place (`docs/design/editor.md` § Browser engines).
 */

import { describeFileRules, notUnder, under, type FileRule, type Probe } from './file-rule';
import { collectEditorSources } from './scan-source';
import { SOURCE, SOURCE_DIR } from './source-paths';

const NATIVE_SELECTION_READ =
	/\b(?:window|document|globalThis|defaultView|ownerDocument)\s*[?!]?\.\s*getSelection\s*(?:\?\.)?\s*\(/;

const inLibrary = (code: string): Probe => ({ relPath: `${SOURCE_DIR.library}probe.ts`, code });

const NATIVE_SELECTION_READS: FileRule = {
	id: 'G4.222 the browser selection is read through the bridge readers',
	population: (file) => under(SOURCE_DIR.library)(file) && notUnder(SOURCE_DIR.debug)(file),
	matches: NATIVE_SELECTION_READ,
	allowed: {
		[SOURCE.nativeBridge]: 'the readers every other file calls',
		'src/lib/caret/widget-offset.ts':
			'the caret writer, and `rawSelectionFocus`, which the bridge sits on',
		'src/lib/caret/text-seat.ts': 'whether the live caret sits in visible text',
		'src/lib/caret/focused-caret.ts': 'the caret a decoration rebuild keeps',
		'src/lib/caret/drawn-caret.svelte.ts': 'the drawn caret paints where the browser holds one',
		'src/lib/caret/sticky-measure.ts': "the moving end's column for vertical arrows",
		'src/lib/caret/visual-lines.ts': "the moving end's line for vertical arrows",
		'src/lib/selection/caret-landing.ts': "the caret's line box a landing scrolls to",
		'src/lib/selection/cross-block/keydown.ts': 'Tab over a range inside one block',
		'src/lib/selection/dead-space-caret.ts':
			"a margin drag that leaves a range keeps it, read off the root's own window",
		'src/lib/selection/selection-drop.ts': 'the range a drag carries',
		'src/lib/selection/widget-selection-paint.ts': 'the widgets a native range covers',
		'src/lib/schema/commands.ts':
			'a dev warning about a live range; selection imports the schema, so it cannot import back',
		'src/lib/invariants/landing-value.ts':
			"a dev check of the browser's own anchor around a landing; selection imports the invariants",
		[SOURCE.clipboardStep]: '`shownSelectionText`, the selection string G4.221 reads in one place'
	},
	reaches: [SOURCE.nativeBridge, SOURCE.clipboardStep],
	mustMatch: [SOURCE.nativeBridge],
	reason:
		'engines differ in what the selection reports (a caret inside a widget, an anchor inside a CRLF pair), so the editor reads it in one place: call `readNativeSelection`, `rawSelectionIn`, `nativeRangeIn` or `holdsNativeRange` from selection/native-bridge.ts, or `rawSelectionFocus` (`docs/design/editor.md` § Browser engines)',
	hits: [
		'const sel = window.getSelection();',
		'if (window.getSelection()?.isCollapsed) return;',
		'const s = document.getSelection();',
		'root.ownerDocument.defaultView?.getSelection();',
		'el.ownerDocument!.getSelection()',
		'if (globalThis.getSelection?.()?.isCollapsed !== false) return;'
	].map(inLibrary),
	misses: [
		...[
			'const focus = deps.getSelection()?.focus;',
			'read: () => getSelection(),',
			'export function getSelection(): EditorSelection | null {',
			'const sel = readNativeSelection();'
		].map(inLibrary),
		{ relPath: `${SOURCE_DIR.debug}probe.ts`, code: 'const sel = window.getSelection();' }
	]
};

describeFileRules([NATIVE_SELECTION_READS], collectEditorSources());
