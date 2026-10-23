// Plain prose parses the same whether or not the parser takes a shortcut past it. A handler that
// declines everything changes no parse, but it does force a full read of every span holding its
// trigger, so the parse without it must match the parse with it.
// Miss-analysis: only the perf gate watched the shortcut, so a shortcut that skipped a span
// holding a bare url or an email passed every unit test.
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { parseInline } from '#lib';
import { INLINE_PRIORITIES, registerInlineSyntax } from '#lib/plugin.js';
import { resetPluginPlatformForTests } from '#lib/testing.js';
import { freshOrFixedSeed } from '../../invariants/arbitraries/property-seed';

const PARAMS = { numRuns: 2000, seed: freshOrFixedSeed(20261024) } as const;

// Prose characters, the ones next to a bare url, a www link or an email, and a few rare
// characters the parser always reads.
const PROSE = [...'aehilmoptwxHW .,:;/@-_#=0'.split(''), 'é', '中', '😀', '\u00a0', '\t', '\n'];
const SHARP = ['!', ']', '*', '[', '<', '&', '`', '\\', '~'];

// The characters a bare handler may not take, since the parser reads them itself.
const BUILT_IN = new Set(['\\', '`', '&', '\n', '*', '_', '~', '[', ']', '!', '<']);

// Every other one-unit character above, plus `!` through a prefix.
function forceFullReads(): void {
	for (const char of PROSE) {
		if (char.length === 1 && !BUILT_IN.has(char)) registerInlineSyntax(char, () => null);
	}
	registerInlineSyntax('!', () => null, {
		prefix: '!!',
		priority: INLINE_PRIORITIES.prefixOverride
	});
}

function agree(raw: string): void {
	resetPluginPlatformForTests();
	const plain = parseInline(raw, 0, raw.length);
	forceFullReads();
	expect(parseInline(raw, 0, raw.length)).toEqual(plain);
}

const arbProse = fc
	.array(
		fc.oneof(
			{ arbitrary: fc.constantFrom(...PROSE), weight: 20 },
			{ arbitrary: fc.constantFrom('http://', 'https://', 'www.', 'HTTP://', 'WWW.'), weight: 3 },
			{ arbitrary: fc.constantFrom(...SHARP), weight: 1 }
		),
		{ maxLength: 40 }
	)
	.map((parts) => parts.join(''));

describe('a span the parser may skip', () => {
	it.each([
		'plain words only',
		'see http://a.co today',
		'see https://a.co today',
		'visit www.a.co now',
		'mail me@x.co',
		'mailto:me@x.co',
		'xmpp:me@x.co/home',
		'Hello! World!',
		'a] b',
		'café 中文 😀',
		'ab:cd w.w www',
		'http:/a.co'
	])('%j parses alike with and without the shortcut', (raw) => agree(raw));

	it('parses alike with and without the shortcut, for any prose', () => {
		fc.assert(fc.property(arbProse, agree), PARAMS);
	});
});
