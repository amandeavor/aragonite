/**
 * G4.231: every right-click menu listener is a declared one. The root's capture-phase listener
 * decides what Safari's right-click select leaves for the menu before any menu reads the caret, so
 * a new menu route is declared here with what it reads (`docs/design/editor.md` § Browser engines).
 */

import { describeManifests, under, type ManifestRule } from './file-rule';
import { collectEditorSources } from './scan-source';
import { SOURCE, SOURCE_DIR } from './source-paths';

const probe = (code: string, dir: string = SOURCE_DIR.components) => ({
	relPath: `${dir}Probe.svelte`,
	code
});

const CONTEXT_MENU_SITES: ManifestRule = {
	id: 'G4.231 a right-click menu listens only where it is declared',
	// The reference plugins too: their views render inside the editor as a bundled plugin's do.
	population: under(SOURCE_DIR.library, SOURCE_DIR.referencePlugins),
	matches: /\bon:?contextmenu\b|['"`]contextmenu['"`]/,
	declared: {
		[SOURCE.editorRootGestures]:
			"the root's capture phase: the caret the menus read, placed before either opens",
		[SOURCE.editorShell]: 'the block context menu, reading the caret the capture phase left',
		[SOURCE.tableBlock]: "a cell's menu, reading the caret the capture phase left in the cell"
	},
	reason:
		"a menu opened from its own `contextmenu` listener must read the caret the root's capture phase leaves (`placeCaretForMenu` in `components/editor-root/gestures.ts`), not the selection Safari makes under the press; declare it here once it does",
	reaches: [SOURCE.editorRootGestures, SOURCE.editorShell, SOURCE.tableBlock],
	hits: [
		probe('<div oncontextmenu={open}></div>'),
		probe("el.addEventListener('contextmenu', open);"),
		probe('<div on:contextmenu={open}></div>'),
		probe('<div on:contextmenu|preventDefault={open}></div>'),
		probe('el.addEventListener(`contextmenu`, open);'),
		probe('mount(view, { oncontextmenu });'),
		probe("const type = 'contextmenu';", SOURCE_DIR.referencePlugins)
	],
	misses: [
		probe('// a contextmenu fires after the press'),
		probe('const menu = openMenu();'),
		probe("if (e.key === 'ContextMenu') open();")
	]
};

describeManifests([CONTEXT_MENU_SITES], collectEditorSources());
