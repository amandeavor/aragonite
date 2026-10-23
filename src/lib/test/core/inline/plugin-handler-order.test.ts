// Which plugin inline syntax handler claims a trigger two of them match, read through the parse.
// Miss-analysis: the order was pinned only on the registry's internal sorted list, so a parse that
// consulted handlers in another order passed every test reaching the published entries.
import { describe, expect, it } from 'vitest';
import { parseInline, type InlineNode } from '#lib';
import {
	INLINE_PRIORITIES,
	registerInlineSyntax,
	type InlineSyntaxOptions,
	type InlineSyntaxRecognizer
} from '#lib/plugin.js';
import { resetPluginPlatformForTests } from '#lib/testing.js';

interface Handler {
	trigger: string;
	options: InlineSyntaxOptions;
	recognizer: InlineSyntaxRecognizer;
}

/** A handler that claims its own prefix, as a node of kind `name`. */
function claiming(name: string, trigger: string, options: InlineSyntaxOptions = {}): Handler {
	const prefix = options.prefix ?? trigger;
	return {
		trigger,
		options,
		recognizer: (raw, pos, end) =>
			raw.startsWith(prefix, pos) && pos + prefix.length <= end
				? { kind: name as InlineNode['kind'], start: pos, end: pos + prefix.length }
				: null
	};
}

const declining = (trigger: string, options: InlineSyntaxOptions = {}): Handler => ({
	trigger,
	options,
	recognizer: () => null
});

/** The kinds `raw` parses to with `handlers` registered in the given order. */
function kindsWith(raw: string, handlers: Handler[]): string[] {
	for (const { trigger, recognizer, options } of handlers) {
		registerInlineSyntax(trigger, recognizer, options);
	}
	return parseInline(raw, 0, raw.length).map((node) => node.kind);
}

const ORDERS = [
	['in registration order', (h: Handler[]) => h],
	['in reverse registration order', (h: Handler[]) => [...h].reverse()]
] as const;

describe.each(ORDERS)('two handlers matching one trigger, %s', (_name, order) => {
	it('the lower priority claims, even against a longer prefix', () => {
		const handlers = [
			claiming('pair', ':', { prefix: '::', priority: 60 }),
			claiming('single', ':', { priority: 50 })
		];
		expect(kindsWith('::x', order(handlers))).toEqual(['single', 'single', 'text']);
	});

	it('at equal priority, the longer prefix claims', () => {
		const handlers = [claiming('single', ':'), claiming('pair', ':', { prefix: '::' })];
		expect(kindsWith('::x', order(handlers))).toEqual(['pair', 'text']);
	});

	it('a declining handler hands the trigger to the next one in order', () => {
		const handlers = [
			declining(':', { prefix: '::', priority: 10 }),
			claiming('single', ':', { priority: 20 })
		];
		expect(kindsWith('::x', order(handlers))).toEqual(['single', 'single', 'text']);
	});

	it('every handler declining leaves the trigger as text', () => {
		const handlers = [declining(':', { prefix: '::' }), declining(':')];
		expect(kindsWith('::x', order(handlers))).toEqual(['text']);
	});
});

describe('a claiming handler and the bare urls around it', () => {
	it.each([
		['a www link', 'w', 'go www.a.co', ['text', 'mark', 'mark', 'mark', 'text']],
		['an email', '@', 'me@a.co', ['text', 'mark', 'text']]
	])('takes the bytes %s would have linked', (_name, trigger, raw, kinds) => {
		expect(kindsWith(raw, [claiming('mark', trigger)])).toEqual(kinds);
	});

	it('leaves a bare url outside its claim linked', () => {
		expect(kindsWith('$ www.a.co', [claiming('mark', '$')])).toEqual(['mark', 'text', 'autolink']);
	});
});

describe('a handler on a character the editor parses itself', () => {
	it('claims ahead of the built-in reading when its prefix matches', () => {
		const handler = claiming('note', '[', {
			prefix: '[^',
			priority: INLINE_PRIORITIES.prefixOverride
		});
		expect(kindsWith('[^x](u)', [handler])).toEqual(['note', 'text']);
	});

	it('leaves the built-in reading whole when it declines', () => {
		const raw = '[^x](u)';
		const builtIn = parseInline(raw, 0, raw.length);
		const handler = declining('[', { prefix: '[^', priority: INLINE_PRIORITIES.prefixOverride });
		registerInlineSyntax(handler.trigger, handler.recognizer, handler.options);
		expect(parseInline(raw, 0, raw.length)).toEqual(builtIn);
		expect(builtIn.map((node) => node.kind)).toEqual(['link']);
	});

	it('runs in priority order among other handlers on that character', () => {
		const handlers = [
			claiming('short', '[', { prefix: '[^', priority: 20 }),
			claiming('long', '[', { prefix: '[^x', priority: 30 })
		];
		for (const [, order] of ORDERS) {
			expect(kindsWith('[^x]', order(handlers))).toEqual(['short', 'text']);
			resetPluginPlatformForTests();
		}
	});
});
