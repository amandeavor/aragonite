import { describe, it, expect } from 'vitest';
import { inlineOf } from './inline-test-helpers';

describe('autolink interactions with other constructs', () => {
	it('autolink does not bleed into a following code span', () => {
		const raw = 'see https://example.com `code` end';
		const nodes = inlineOf(raw);
		const autolinks = nodes.filter((n) => n.kind === 'autolink');
		const codeSpans = nodes.filter((n) => n.kind === 'inlineCode');
		expect(autolinks).toHaveLength(1);
		expect(autolinks[0].url).toBe('https://example.com');
		expect(codeSpans).toHaveLength(1);
	});

	it('autolink does not start inside a code span', () => {
		// The code span takes those bytes, so no autolink starts inside them.
		const raw = 'pre `https://x.com` post';
		const nodes = inlineOf(raw);
		const autolinks = nodes.filter((n) => n.kind === 'autolink');
		const codeSpans = nodes.filter((n) => n.kind === 'inlineCode');
		expect(autolinks).toHaveLength(0);
		expect(codeSpans).toHaveLength(1);
	});

	it('entity inside angle-bracket inner is not interpreted', () => {
		// A failed angle form leaves its bytes to the rest of the parse, so `&copy;` decodes.
		const raw = 'see <foo&copy;bar> end';
		const nodes = inlineOf(raw);
		const autolinks = nodes.filter((n) => n.kind === 'autolink');
		expect(autolinks).toHaveLength(0);
		const refs = nodes.filter((n) => n.kind === 'entityReference');
		expect(refs).toHaveLength(1);
		expect(refs[0].decoded).toBe('©');
	});
});

describe('parseInline: plain prose around a url', () => {
	it('text, autolink, text reconstructs raw', () => {
		const input = 'pre https://example.com post';
		const nodes = inlineOf(input);
		expect(nodes.map((n) => n.kind)).toEqual(['text', 'autolink', 'text']);
		const reconstructed = nodes.map((n) => input.slice(n.start, n.end)).join('');
		expect(reconstructed).toBe(input);
	});
});
