// A content write closes a fence it leaves open only when the write typed the opener and the bytes
// below don't close it already; a fence the write merely exposed reads on as a reload reads it.
// Miss-analysis (GH #768): the auto-close rows typed fresh openers only, so none retyped a broken
// opener whose old closer still stood below.
import { describe, it, expect, beforeEach } from 'vitest';
import { registerMathBlock } from '#lib/plugins/latex/latex-kind.js';
import { registerMermaidKind } from '#lib/plugins/mermaid/mermaid-kind.js';
import { testView } from '#lib/test/support/test-view.js';
import { typingOver } from '#lib/test/harness/typing.js';

beforeEach(() => {
	registerMathBlock(testView());
	registerMermaidKind(testView());
});

describe('closing a fence a write leaves open', () => {
	// Each fence kind, and the `$$` block, loses its opener's first marker byte and gets it back.
	const RESTORES: Array<[kind: string, raw: string]> = [
		['fencedCode', '```js\ncode\n```\n'],
		['fencedCode', '~~~js\ncode\n~~~\n'],
		['mathFence', '```math\nx\n```\n'],
		['mermaid', '```mermaid\nA\n```\n'],
		['mathBlock', '$$\nx\n$$\n']
	];
	for (const [kind, raw] of RESTORES) {
		it(`restores ${kind} (${raw.slice(0, 3)}) when its opener's backspaced marker is typed back`, () => {
			const source = `para\n\n${raw}\nafter\n`;
			const opened = raw.slice(0, raw.lastIndexOf('\n', raw.length - 2) + 1);
			const { doc, type } = typingOver(source);

			expect(type(1, raw.slice(1))).toBe(`para\n\n${raw.slice(1)}\nafter\n`);
			expect(type(1, opened)).toBe(source);
			expect(doc.children[1].kind).toBe(kind);
		});
	}

	it('still closes a fresh opener typed above other blocks', () => {
		const { type } = typingOver('para\n\nafter\n');

		expect(type(0, '```\n')).toBe('```\n```\n\nafter\n');
	});

	// The bare opener below would close the typed one and strand its own closer under `x`.
	it('still closes a fresh opener typed above a bare-fenced code block', () => {
		const { type } = typingOver('para\n\n```\nx\n```\n');

		expect(type(0, '```\n')).toBe('```\n```\n\n```\nx\n```\n');
	});

	// The closer of the block below would close the typed fence, taking that block in as its body.
	it('still closes a fresh opener typed above a code block with a language', () => {
		const { type } = typingOver('para\n\n```js\ncode\n```\n');

		expect(type(0, '```\n')).toBe('```\n```\n\n```js\ncode\n```\n');
	});
});
