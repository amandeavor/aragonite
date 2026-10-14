// @vitest-environment jsdom
import { defaultGrammarView } from '#lib/schema/block-openers.js';
import { describe, it, expect } from 'vitest';
import type { InlineNode } from '../../core/nodes';
import { registerInlineWidgetKind, isInlineWidget } from '../../core/inline/inline-widgets';
import { __resetSchemaRegistriesForTests } from '#lib/schema/registry-reset.js';

// A kind the registry has never seen, cast through the closed inline-kind union
// the way a real inline-widget plugin would.
const PLUGIN_KIND = 'test-inline-widget' as InlineNode['kind'];
const pluginNode = { kind: PLUGIN_KIND, start: 0, end: 3 } as InlineNode;
const imageNode: InlineNode = { kind: 'image', start: 0, end: 6, alt: '', url: 'x' };
const view = () => ({});

describe('registerInlineWidgetKind: register-once', () => {
	it('rejects re-registering the built-in image kind, leaving it intact', () => {
		expect(() => registerInlineWidgetKind('image', { isWidget: () => false, view })).toThrow(
			/register-once|already registered/i
		);
		// The rejected re-registration never took: image still recognizes as a widget.
		expect(isInlineWidget(imageNode, '![](x)', defaultGrammarView)).toBe(true);
	});

	it('registers a fresh plugin kind once, then rejects a duplicate', () => {
		registerInlineWidgetKind(PLUGIN_KIND, { isWidget: () => true, view });
		expect(isInlineWidget(pluginNode, 'xxx', defaultGrammarView)).toBe(true);
		expect(() => registerInlineWidgetKind(PLUGIN_KIND, { isWidget: () => false, view })).toThrow(
			/register-once|already registered/i
		);
	});
});

describe('__resetSchemaRegistriesForTests', () => {
	it('clears plugin kinds but keeps the built-ins', () => {
		registerInlineWidgetKind(PLUGIN_KIND, { isWidget: () => true, view });
		expect(isInlineWidget(pluginNode, 'xxx', defaultGrammarView)).toBe(true);

		__resetSchemaRegistriesForTests();

		expect(isInlineWidget(pluginNode, 'xxx', defaultGrammarView)).toBe(false);
		expect(isInlineWidget(imageNode, '![](x)', defaultGrammarView)).toBe(true);
	});
});
