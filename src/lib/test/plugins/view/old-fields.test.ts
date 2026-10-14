/**
 * Type pins: a plugin view has one shape in every slot, so the builder and component fields it
 * replaced don't type-check anymore. `npm run check` fails the day one of them comes back.
 */
import { it, expect } from 'vitest';
import type { Component } from 'svelte';
import type {
	DecorationWidgetSpec,
	InlineMenuSource,
	InlineWidgetDescriptor,
	InlineWidgetComponentProps,
	InlineMenuRowProps,
	PluginView
} from '#lib/plugin.js';

const widgetComponent = null as unknown as Component<InlineWidgetComponentProps>;
const rowComponent = null as unknown as Component<InlineMenuRowProps>;
const view: PluginView<InlineMenuRowProps> = () => ({});

export const inlineBuilder: InlineWidgetDescriptor = {
	isWidget: () => true,
	view: () => ({}),
	// @ts-expect-error an inline widget draws through `view`, not a builder
	view: () => ({})
};

export const inlineComponent: InlineWidgetDescriptor = {
	isWidget: () => true,
	view: () => ({}),
	// @ts-expect-error a Svelte widget goes through `svelteInlineWidget`
	component: widgetComponent
};

// @ts-expect-error a decoration widget draws through `view`, not a builder
export const decorationBuilder: DecorationWidgetSpec = { buildDom: () => document.body };

// @ts-expect-error a Svelte decoration widget goes through `svelteDecorationWidget`
export const decorationComponent: DecorationWidgetSpec = { component: widgetComponent };

// @ts-expect-error a Svelte row goes through `svelteMenuRow`
export const rowAsComponent: InlineMenuSource['row'] = rowComponent;

// @ts-expect-error a DOM row is a view, not a builder object
export const rowAsBuilder: InlineMenuSource['row'] = { buildDom: () => document.body };

export const rowAsView: InlineMenuSource['row'] = view;

it('keeps the builder-free descriptor usable', () => {
	expect(inlineBuilder.isWidget({} as never, '')).toBe(true);
});
