// Miss-analysis: the one-character test lived as a code-unit count in the leaf, and no row typed an emoji.
import { describe, expect, it } from 'vitest';
import { isAtMostOneCharacter } from '#lib/core/text-units.js';

describe('isAtMostOneCharacter', () => {
	it('counts a user-perceived character, not code units', () => {
		for (const text of ['', 'a', '😀', '\u{1F468}‍\u{1F469}‍\u{1F467}', 'é', '\r\n']) {
			expect(isAtMostOneCharacter(text), JSON.stringify(text)).toBe(true);
		}
		for (const text of ['ab', '😀a', 'a\n']) {
			expect(isAtMostOneCharacter(text), JSON.stringify(text)).toBe(false);
		}
	});
});
