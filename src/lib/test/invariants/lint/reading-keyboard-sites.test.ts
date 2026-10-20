/**
 * G4.235: in reading mode the page owns Tab. The keymaps' Tab chords are declined at the command
 * dispatcher in reading mode, so a keydown that compares the Tab key by hand is either chrome that
 * never opens there or the range keydown, which hands Tab back first (`docs/design/editor.md`
 * § Browser engines).
 */

import { describeFileRules, type FileRule } from './file-rule';
import { collectEditorSources } from './scan-source';
import { SOURCE } from './source-paths';

const HAND_TAB_SITES: FileRule = {
	id: 'G4.235 a keydown reads the Tab key by hand only where reading mode is settled',
	matches: /(?:\.key|\bchord)\s*[!=]==?\s*['"]Tab['"]|\bcase\s+['"]Tab['"]/,
	allowed: {
		[SOURCE.crossBlockKeydown]: "the range's Tab, which hands Tab back to the page in reading mode",
		'src/lib/components/blocks/table/TableActionMenu.svelte':
			"the open menu's focus trap; the menu never opens in reading mode",
		[SOURCE.linkCard]: "the open card's focus trap; the card never opens in reading mode",
		[SOURCE.imageProperties]: 'lets Tab through to the page while a crop is open',
		'src/lib/components/menu/InlineMenuHost.svelte':
			'commits the open row; an inline menu never opens in reading mode',
		[SOURCE.mermaidBlock]: "indents in the diagram's edit box, which reading mode never opens"
	},
	reason:
		'a block keydown that takes Tab itself skips the dispatcher, which leaves Tab to the page in reading mode: bind the key in the kind keymap instead',
	reaches: [SOURCE.crossBlockKeydown, SOURCE.linkCard],
	hits: [
		"if (e.key === 'Tab') move();",
		'if (e.key !== "Tab") return;',
		"switch (e.key) { case 'Tab': next(); }",
		"if (chord === 'Tab') commit();"
	],
	misses: [
		"{ chord: 'Tab', command: 'list.indent' }",
		"const label = 'Tab';",
		"if (e.key === 'Tabs') x();"
	]
};

describeFileRules([HAND_TAB_SITES], collectEditorSources());
