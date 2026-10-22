/**
 * G4.230: editor chrome runs no undo or redo of its own. With focus on a toolbar button or a menu
 * item, the editor root's keydown answers Mod+Z in every engine, so a component that reads the
 * chord or calls the history itself would run it twice or in one engine only
 * (`docs/design/editor.md` § Browser engines).
 */

import { describeFileRules, under, type FileRule } from './file-rule';
import { collectEditorSources } from './scan-source';
import { SOURCE, SOURCE_DIR } from './source-paths';

const probe = (code: string) => ({ relPath: `${SOURCE_DIR.components}Probe.svelte`, code });

const HISTORY_CHORD_SITES: FileRule = {
	id: 'G4.230 the editor history runs only at its keydown sites',
	population: under(SOURCE_DIR.components, SOURCE_DIR.plugins),
	matches:
		/\b(?:runGlobalChord|runGlobalChordOnKind|requestUndo|requestRedo)\s*\(|['"]Mod\+(?:Shift\+)?[zZyY]['"]|['"]history\.(?:undo|redo)['"]/,
	allowed: {
		[SOURCE.editorRootKeydown]:
			'the editor root: undo and redo with no block focused, or with focus on chrome',
		'src/lib/components/GapCaret.svelte': "the gap caret's proxy, which holds focus of its own",
		'src/lib/components/blocks/editable/editable-surface.ts':
			"a text block's own history input, which the browser fires on the block",
		[SOURCE.editableLeaf]: "a code leaf's source history, stepped before the editor's"
	},
	reason:
		'focus on editor chrome reaches the history through the editor root (`chromeHoldsFocus` in `components/editor-root/keydown.ts`); a component that handles Mod+Z itself runs it twice, or in one engine only',
	reaches: [SOURCE.imageProperties, SOURCE.editorRootKeydown],
	hits: [
		probe('void history.requestUndo();'),
		{ relPath: `${SOURCE_DIR.plugins}x/X.svelte`, code: "if (chord === 'Mod+Z') undo();" },
		probe('runGlobalChord(chord, ctx);'),
		probe("run('history.redo');")
	],
	misses: [probe("if (chord === 'Mod+B') bold();"), probe('const undoLabel = "Undo";')]
};

describeFileRules([HISTORY_CHORD_SITES], collectEditorSources());
