/**
 * G4.216: every built-in kind whose keymap binds Enter binds Shift+Enter too, so the keydown decides
 * that key in every built-in surface and no engine's default input for it can drop it. Plugin kinds
 * are not held to this.
 */
// Miss-analysis: the code block and the table cell bound Enter and left Shift+Enter to its
// `insertLineBreak` input, which WebKit sends as `insertParagraph`, and no row read the keymaps.
import { describe, it, expect } from 'vitest';
import '#lib';
import { isBuiltinBlockKind } from '#lib/core/nodes.js';
import { getAllRegisteredKinds } from '#lib/schema/block-kind-descriptor.js';
import { kindKeymap } from '#lib/schema/commands.js';
import { normalizeChord, type KeyBinding } from '#lib/schema/keybindings.js';

function binds(keymap: readonly KeyBinding[], chord: string): boolean {
	return keymap.some((binding) => normalizeChord(binding.chord) === normalizeChord(chord));
}

/** The built-in kinds that bind Enter and leave Shift+Enter unbound. */
export function kindsMissingShiftEnter<K extends string>(
	kinds: readonly K[],
	keymapOf: (kind: K) => readonly KeyBinding[]
): K[] {
	return kinds.filter((kind) => {
		const keymap = keymapOf(kind);
		return binds(keymap, 'Enter') && !binds(keymap, 'Shift+Enter');
	});
}

describe('G4.216 Shift+Enter is bound wherever Enter is, in every built-in kind', () => {
	const builtIns = getAllRegisteredKinds().filter(isBuiltinBlockKind);

	it('holds over the registered built-in kinds', () => {
		expect(kindsMissingShiftEnter(builtIns, kindKeymap)).toEqual([]);
	});

	it('reads the three surfaces that give Enter a meaning', () => {
		const withEnter = builtIns.filter((kind) => binds(kindKeymap(kind), 'Enter'));
		expect(withEnter).toEqual(expect.arrayContaining(['paragraph', 'fencedCode', 'tableCell']));
	});

	it('names a kind that binds Enter alone', () => {
		const keymaps: Record<string, KeyBinding[]> = {
			bare: [{ chord: 'Enter', command: 'code.newline' }],
			paired: [
				{ chord: 'Enter', command: 'code.newline' },
				{ chord: 'Shift+Enter', command: 'code.softBreak' }
			]
		};
		expect(kindsMissingShiftEnter(['bare', 'paired'], (kind) => keymaps[kind])).toEqual(['bare']);
	});
});
