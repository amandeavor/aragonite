// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { isPlainTypingKey } from '#lib/components/blocks/text/click-snap-guard.js';

describe('isPlainTypingKey', () => {
	const key = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init);

	it('accepts a single printable character with no modifier', () => {
		for (const k of ['a', 'Z', '3', ' ', '$']) {
			expect(isPlainTypingKey(key({ key: k }))).toBe(true);
		}
	});

	it('accepts a shifted character: Shift is not a command modifier', () => {
		expect(isPlainTypingKey(key({ key: 'A', shiftKey: true }))).toBe(true);
	});

	it('rejects a single character held under ctrl/meta/alt (a command chord)', () => {
		expect(isPlainTypingKey(key({ key: 'a', ctrlKey: true }))).toBe(false);
		expect(isPlainTypingKey(key({ key: 'a', metaKey: true }))).toBe(false);
		expect(isPlainTypingKey(key({ key: 'a', altKey: true }))).toBe(false);
	});

	it('rejects multi-character named keys', () => {
		for (const k of ['Enter', 'ArrowLeft', 'Backspace', 'Delete', 'Tab', 'Escape']) {
			expect(isPlainTypingKey(key({ key: k }))).toBe(false);
		}
	});

	// An astral glyph is one typed character in two UTF-16 units.
	it('accepts an astral-plane character', () => {
		expect(isPlainTypingKey(key({ key: '😀' }))).toBe(true);
		expect(isPlainTypingKey(key({ key: '𝓐' }))).toBe(true);
	});
});
