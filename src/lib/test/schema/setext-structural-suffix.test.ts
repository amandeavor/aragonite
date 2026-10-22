// A setext heading's bytes past its title: the structure every edit keeps after the title.
// Miss-analysis: every tested kind with bytes past its content was prose, never component-drawn.
import { describe, it, expect } from 'vitest';
import { structuralSuffix } from '../../core/inline';
import type { CstNode } from '../../core/nodes';
import { simpleLeafClosure } from '#lib/plugin.js';
import { testLeaf } from '#lib/test/harness/test-kinds.js';

const node = (kind: string, raw: string) => ({ kind, leadingTrivia: '', raw }) as CstNode;

describe('structuralSuffix', () => {
	it.each([
		['a setext underline', 'Plan\n===\n', '\n==='],
		['a CRLF setext underline', 'Plan\r\n---\r\n', '\r\n---'],
		['a two-line title', 'Plan\nmore\n---\n', '\n---']
	])('is %s', (_label, raw, suffix) => {
		expect(structuralSuffix(node('setextHeading', raw))).toBe(suffix);
	});

	it('is empty for a paragraph and an ATX heading', () => {
		expect(structuralSuffix(node('paragraph', 'Plan\n'))).toBe('');
		expect(structuralSuffix(node('heading', '# Plan\n'))).toBe('');
	});

	it('is empty for a kind that is not prose, whatever its content range', () => {
		const kind = testLeaf('short-range-leaf', {
			contentStart: { range: () => ({ start: 0, end: 2 }) },
			closure: simpleLeafClosure({
				focus: { mode: 'implemented', via: 'native caret in the raw-editable surface' },
				searchPaint: { mode: 'inherit-default' },
				undo: { mode: 'inherit-default' },
				simOracle: { mode: 'inherit-default' }
			})
		});

		expect(structuralSuffix(node(kind, '@@ one\n'))).toBe('');
	});
});
