import { describe, it, expect } from 'vitest';
import { parseInline } from '#lib';
import fc from 'fast-check';
import { INLINE_PRIORITIES, registerInlineSyntax } from '#lib/plugin.js';
import { resetPluginPlatformForTests } from '#lib/testing.js';
import { arbInlineSource } from '../../invariants/arbitraries/inline';
import { freshOrFixedSeed } from '../../invariants/arbitraries/property-seed';

// Plugin-trigger tokens interleaved with adversarial content: arbInlineSource alone rarely
// emits `[^` (rules.md: a generator that cannot produce the bug class proves nothing), and a
// registered `!` handler defeats the fast bail, forcing the full scan loop `[` skips.
const ladderToken = fc.constantFrom(
	'[^1]',
	'[^',
	'[^note]',
	':',
	'::',
	':smile:',
	'[^x]tail',
	'!',
	'![[',
	'![[a.png]]',
	'![[a]](u)'
);
const arbLadderSource = fc
	.tuple(arbInlineSource, ladderToken, arbInlineSource)
	.map(([before, token, after]) => before + token + after);

const PARAMS = { numRuns: 1000, seed: freshOrFixedSeed(717171) } as const;

describe('inline priority order: all-decline recognizers leave parseInline byte-identical', () => {
	it('bare-`:`, `[^`-prefix and `![[`-prefix decliners never perturb the scan output', () => {
		fc.assert(
			fc.property(arbLadderSource, (source) => {
				resetPluginPlatformForTests();
				const clean = parseInline(source, 0, source.length);
				registerInlineSyntax(':', () => null);
				registerInlineSyntax('[', () => null, {
					prefix: '[^',
					priority: INLINE_PRIORITIES.prefixOverride
				});
				registerInlineSyntax('!', () => null, {
					prefix: '![[',
					priority: INLINE_PRIORITIES.prefixOverride
				});
				expect(parseInline(source, 0, source.length)).toEqual(clean);
			}),
			PARAMS
		);
	});
});
