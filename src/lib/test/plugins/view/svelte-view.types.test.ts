/**
 * Type pins: `svelteView` fits a component to any slot whose props cover the ones it declares, and
 * a component asking for a prop the slot never passes doesn't type-check.
 */
import { it, expect } from 'vitest';
import type { Component } from 'svelte';
import type {
	DecorationWidgetSpec,
	InlineMenuSource,
	InlineWidgetDescriptor,
	InlineWidgetComponentProps,
	InlineMenuRowProps,
	Decoration
} from '#lib/plugin.js';
import { svelteView } from '#lib/svelte.js';

const sourceOnly = null as unknown as Component<{ source: string }>;
const fullWidget = null as unknown as Component<InlineWidgetComponentProps>;
const overAsking = null as unknown as Component<InlineWidgetComponentProps & { extra: string }>;
const decorationWidget = null as unknown as Component<{ decoration: Decoration }>;
const row = null as unknown as Component<InlineMenuRowProps>;

export const subsetWidget: InlineWidgetDescriptor = {
	isWidget: () => true,
	view: svelteView(sourceOnly)
};

export const widget: InlineWidgetDescriptor = {
	isWidget: () => true,
	view: svelteView(fullWidget)
};

export const overAskingWidget: InlineWidgetDescriptor = {
	isWidget: () => true,
	// @ts-expect-error the slot never passes `extra`
	view: svelteView(overAsking)
};

export const decoration: DecorationWidgetSpec = { view: svelteView(decorationWidget) };

// @ts-expect-error a decoration widget gets `{ decoration }`, not an inline widget's props
export const wrongSlot: DecorationWidgetSpec = { view: svelteView(fullWidget) };

export const menuRow: InlineMenuSource['row'] = svelteView(row);

it('makes a view function from a component', () => {
	expect(typeof svelteView(sourceOnly)).toBe('function');
});
