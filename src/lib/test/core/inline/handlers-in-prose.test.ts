import { describe, expect, it } from 'vitest';
import type { InlineNode } from '#lib/core/nodes.js';
import { registerInlineSyntax, type InlineSyntaxRecognizer } from '#lib/plugin.js';
import { parsed } from './scan/scan-test-helpers';

// The label-less `{…}` form holds nothing the parse reads by itself (`{`, `}`, `=`), so only
// the registered trigger can make it look. A `[label]` form would be read for its `[`.
const recognizer =
	(trigger: string): InlineSyntaxRecognizer =>
	(raw, pos, end) => {
		if (raw[pos] !== trigger) return null;
		const close = raw.indexOf('}', pos);
		if (close < 0 || close >= end) return null;
		return { kind: 'directiveText' as InlineNode['kind'], start: pos, end: close + 1 };
	};
const recognizeColon = recognizer(':');

// `:` matters to the parse only before `//`, so plain prose may skip it until a handler is on it.
describe('a registered ":" handler is asked in prose', () => {
	it('empty registry: ":x" stays one byte-identical text node', () => {
		expect(parsed(':x', 0, 2)).toEqual([{ kind: 'text', start: 0, end: 2, text: ':x' }]);
	});

	it('registered ":" recognizer is consulted; ":x{k=v}" is not skipped as text', () => {
		registerInlineSyntax(':', recognizeColon);
		const nodes = parsed(':x{k=v}', 0, 7);
		expect(nodes).not.toEqual([{ kind: 'text', start: 0, end: 7, text: ':x{k=v}' }]);
		expect(nodes.some((n) => n.kind === 'directiveText')).toBe(true);
	});
});

// `w` matters to the parse only before `ww.`, the same case as `:` above.
describe('a registered "w" handler is asked in prose', () => {
	it('empty registry: "wx" stays one byte-identical text node', () => {
		expect(parsed('wx', 0, 2)).toEqual([{ kind: 'text', start: 0, end: 2, text: 'wx' }]);
	});

	it('registered "w" recognizer is consulted: "w{k=v}" is not skipped as text', () => {
		registerInlineSyntax('w', recognizer('w'));
		const nodes = parsed('w{k=v}', 0, 6);
		expect(nodes).not.toEqual([{ kind: 'text', start: 0, end: 6, text: 'w{k=v}' }]);
		expect(nodes.some((n) => n.kind === 'directiveText')).toBe(true);
	});

	it('a registered "w" handler that declines leaves www. links alone', () => {
		registerInlineSyntax('w', recognizer('w'));
		const raw = 'see www.example.com now';
		const nodes = parsed(raw, 0, raw.length);
		expect(nodes.some((n) => n.kind === 'autolink')).toBe(true);
	});
});

// `!` is built in but matters only before `[`, so a prefix handler on it needs a check of its
// own: `!{k=v}` carries no `[`.
describe('a registered "!" prefix handler is asked in prose', () => {
	it('empty registry: "!{k=v}" stays one byte-identical text node', () => {
		expect(parsed('!{k=v}', 0, 6)).toEqual([{ kind: 'text', start: 0, end: 6, text: '!{k=v}' }]);
	});

	it('registered "!{" inline syntax handler is consulted: "!{k=v}" does not fast-bail to text', () => {
		registerInlineSyntax('!', recognizer('!'), { prefix: '!{', priority: 40 });
		const nodes = parsed('!{k=v}', 0, 6);
		expect(nodes).toEqual([{ kind: 'directiveText', start: 0, end: 6 }]);
	});

	it('a registered "!" inline syntax handler leaves prose exclamation marks alone', () => {
		registerInlineSyntax('!', recognizer('!'), { prefix: '!{', priority: 40 });
		const raw = 'wow! really';
		expect(parsed(raw, 0, raw.length)).toEqual([
			{ kind: 'text', start: 0, end: raw.length, text: raw }
		]);
	});
});
