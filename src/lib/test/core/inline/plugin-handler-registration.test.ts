// Which inline syntax registrations the published entry refuses, and what an accepted one does.
// Miss-analysis: the refusals were pinned through the registry's internal read-backs, so a rebuild
// that accepted a handler which can never fire passed every test reaching the published entries.
import { describe, expect, it } from 'vitest';
import { parseInline, type InlineNode } from '#lib';
import { INLINE_PRIORITIES, registerInlineSyntax } from '#lib/plugin.js';

const claimOne = (kind: string) => (_raw: string, pos: number) => ({
	kind: kind as InlineNode['kind'],
	start: pos,
	end: pos + 1
});

// Every character the editor parses itself: a plugin reaches one only through a prefix.
const BUILT_IN_TRIGGERS = ['\\', '`', '&', '\n', '*', '_', '~', '[', ']', '!', '<'];

describe('registerInlineSyntax refuses a handler it could never run', () => {
	it.each(['', 'ab'])('a trigger that is not one character (%j)', (trigger) => {
		expect(() => registerInlineSyntax(trigger, () => null)).toThrow(/registerInlineSyntax/);
	});

	it.each(['$', '%x'])('a prefix that is not the trigger plus more (%j)', (prefix) => {
		expect(() => registerInlineSyntax('$', () => null, { prefix })).toThrow(/prefix/);
	});

	it.each(BUILT_IN_TRIGGERS)('a bare handler on the built-in trigger %j', (trigger) => {
		expect(() => registerInlineSyntax(trigger, () => null)).toThrow(/registerInlineSyntax/);
	});

	it.each([INLINE_PRIORITIES.builtin, INLINE_PRIORITIES.plugin])(
		'a prefix handler on a built-in trigger at priority %i, not below the built-in reading',
		(priority) => {
			expect(() => registerInlineSyntax('[', () => null, { prefix: '[^', priority })).toThrow(
				/priority/
			);
		}
	);

	it('a prefix handler on "]", which plain prose never sends through the parse', () => {
		expect(() =>
			registerInlineSyntax(']', () => null, {
				prefix: ']]',
				priority: INLINE_PRIORITIES.prefixOverride
			})
		).toThrow(/registerInlineSyntax/);
	});

	it('autoPair together with a prefix', () => {
		expect(() => registerInlineSyntax('$', () => null, { prefix: '$$', autoPair: true })).toThrow(
			/autoPair/
		);
	});

	it('a second handler at the same trigger, prefix and priority', () => {
		registerInlineSyntax('$', () => null);
		expect(() => registerInlineSyntax('$', () => null)).toThrow(/already registered/);
		expect(() =>
			registerInlineSyntax('$', () => null, { priority: INLINE_PRIORITIES.plugin + 1 })
		).not.toThrow();
	});
});

describe('registerInlineSyntax accepts what can fire', () => {
	it.each(BUILT_IN_TRIGGERS.filter((trigger) => trigger !== ']'))(
		'a prefix handler below the built-in priority on %j, which then claims',
		(trigger) => {
			const prefix = trigger + '%';
			registerInlineSyntax(trigger, claimOne('mark'), {
				prefix,
				priority: INLINE_PRIORITIES.prefixOverride
			});
			const raw = `a ${prefix}`;
			expect(parseInline(raw, 0, raw.length).map((node) => node.kind)).toContain('mark');
		}
	);

	it('a bare handler on any other character, at any priority', () => {
		registerInlineSyntax('$', claimOne('dollar'), { priority: 1 });
		expect(parseInline('a$', 0, 2).map((node) => node.kind)).toEqual(['text', 'dollar']);
	});
});

describe('a recognizer that breaks its contract fails the parse', () => {
	it.each([
		['starts off the trigger', (_raw: string, pos: number) => ({ start: pos + 1, end: pos + 2 })],
		['does not advance', (_raw: string, pos: number) => ({ start: pos, end: pos })],
		['ends past the range', (_raw: string, pos: number) => ({ start: pos, end: pos + 5 })]
	])('a node that %s throws', (_name, span) => {
		registerInlineSyntax('$', (raw, pos) => ({ kind: 'text', ...span(raw, pos) }));
		expect(() => parseInline('a$bc', 0, 4)).toThrow(/"\$"/);
	});
});
