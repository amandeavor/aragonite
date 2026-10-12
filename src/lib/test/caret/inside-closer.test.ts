// The caret Edit link leaves before a URL's hidden closer types inside the URL, letter after letter,
// until a move that isn't typing there ends it.
// Miss-analysis: Edit link's rows pressed ArrowLeft before typing, so no row typed at the caret it
// placed, where the next letter landed past the closing bracket.
import { describe, it, expect } from 'vitest';
import { createCaretMemory } from '#lib/caret/caret-memory.js';
import type { PlaceInsertion } from '#lib/caret/next-insertion.js';

// `<ab:c>` with the caret at 5, before the hidden `>`: the block's own rule moves a letter past it.
const BEFORE = '<ab:c>';
const pastCloser: PlaceInsertion = (before, edit, at) => ({
	text: before.slice(0, at + 1) + edit.text.slice(at, at + 1) + before.slice(at + 1),
	caretAfter: at + 2,
	crossed: []
});

function type(
	memory: ReturnType<typeof createCaretMemory>,
	block: object,
	before: string,
	at: number
) {
	const held = memory.holdInsertion(block, pastCloser);
	memory.noteTyping();
	const edit = { text: before.slice(0, at) + 'Z' + before.slice(at), caretAfter: at + 1 };
	const spent = held.spend(before, edit);
	held.finish(true);
	return spent;
}

describe('the caret inside a closer', () => {
	it('keeps every letter typed at it inside the construct', () => {
		const memory = createCaretMemory();
		const block = {};
		memory.insideCloser.forBlock(block).open(5);

		const first = type(memory, block, BEFORE, 5);
		expect(first.text).toBe('<ab:cZ>');
		expect(memory.insideCloser.forBlock(block).at()).toBe(6);
		expect(type(memory, block, first.text, 6).text).toBe('<ab:cZZ>');
	});

	it('ends at a navigation key, and the block decides again', () => {
		const memory = createCaretMemory();
		const block = {};
		memory.insideCloser.forBlock(block).open(5);
		memory.noteKey({ key: 'ArrowRight' }, null);
		expect(memory.insideCloser.forBlock(block).at()).toBeNull();
		expect(type(memory, block, BEFORE, 5).text).toBe('<ab:c>Z');
	});

	// The delete's own write ends it, and the block opens it again when the caret stays inside.
	it('outlives the keydown of a key that edits, which leaves it to the write', () => {
		const memory = createCaretMemory();
		const block = {};
		memory.insideCloser.forBlock(block).open(5);
		memory.noteKey({ key: 'Backspace' }, null);
		expect(memory.insideCloser.forBlock(block).at()).toBe(5);
	});

	it('ends at any other caret move, and belongs to its own block only', () => {
		const memory = createCaretMemory();
		const block = {};
		memory.insideCloser.forBlock(block).open(5);
		expect(memory.insideCloser.forBlock({}).at()).toBeNull();
		memory.forget();
		expect(memory.insideCloser.forBlock(block).at()).toBeNull();
	});
});
