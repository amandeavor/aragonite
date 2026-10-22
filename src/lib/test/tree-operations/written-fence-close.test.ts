// A content write closes a fence it leaves open only when the write typed the opener and the bytes
// below don't close it already; a fence the write merely exposed reads on as a reload reads it.
// Miss-analysis (GH #768): the auto-close rows typed fresh openers only, so none retyped a broken
// opener whose old closer still stood below.
import { describe, it, expect } from 'vitest';
import { serialize } from '#lib/core/serializer.js';
import { docPathFrom } from '#lib/caret/coordinate-spaces.js';
import { createUndoController } from '#lib/editor-actions/commit/undo-controller.js';
import { createLeafTyping } from '#lib/editor-actions/leaf-write.js';
import { legalizeWrite } from '#lib/tree-operations/content-write.js';
import { makeEditorActionsDeps } from '#lib/test/harness/editor-actions.js';
import { expectParseConverged } from '#lib/test/harness/parse-converged.js';

/** A typing session over `source`: each call writes block `index` through the keystroke route. */
function typingOver(source: string) {
	const { deps } = makeEditorActionsDeps(source);
	const typing = createLeafTyping(deps, createUndoController(deps));
	const type = (index: number, text: string) => {
		const write = legalizeWrite(deps.doc, index, text, 'authored');
		expect(typing.writeLeafInPlace(docPathFrom([index]), write, 0).wrote).toBe(true);
		expectParseConverged(deps.doc);
		return serialize(deps.doc);
	};
	return { doc: deps.doc, type };
}

describe('closing a fence a write leaves open', () => {
	it('restores the document when a backspaced opener backtick is typed back', () => {
		const source = 'para\n\n```js\ncode\n```\n\nafter\n';
		const { doc, type } = typingOver(source);

		expect(type(1, '``js\ncode\n```\n')).toBe('para\n\n``js\ncode\n```\n\nafter\n');
		expect(type(1, '```js\ncode\n')).toBe(source);
		expect(doc.children.map((c) => c.kind)).toEqual(['paragraph', 'fencedCode', 'paragraph']);
	});

	it('still closes a fresh opener typed above other blocks', () => {
		const { type } = typingOver('para\n\nafter\n');

		expect(type(0, '```\n')).toBe('```\n```\n\nafter\n');
	});

	// The bare opener below would close the typed one and strand its own closer under `x`.
	it('still closes a fresh opener typed above a bare-fenced code block', () => {
		const { type } = typingOver('para\n\n```\nx\n```\n');

		expect(type(0, '```\n')).toBe('```\n```\n\n```\nx\n```\n');
	});
});

describe('a setext title blanked and typed back', () => {
	// Current behaviour: filling the blank line gives the kept underline its separator back (the
	// blank-run rule), so the two read as paragraphs, not the heading.
	it('keeps the underline, and the retyped title stays a paragraph above it (current behaviour)', () => {
		const { type } = typingOver('para\n\nTitle\n=====\n\nafter\n');

		expect(type(1, '\n=====\n')).toBe('para\n\n\n=====\n\nafter\n');
		expect(type(1, 'Title\n')).toBe('para\n\nTitle\n\n=====\n\nafter\n');
	});
});
