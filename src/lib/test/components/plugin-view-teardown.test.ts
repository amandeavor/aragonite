// @vitest-environment jsdom
// A plugin component that throws while it is torn down is reported on the editor's `error` channel
// like a mount failure, never left as an unhandled rejection.
// Miss-analysis: the plugin view routes were tested on mount only; no fixture threw on teardown.
import { it, expect, vi } from 'vitest';
import { flushSync, type Component } from 'svelte';
import { mountDecorationWidget } from '#lib/decorations/widget-dom.js';
import { createSvelteWidgetPool } from '#lib/components/blocks/widget-portal.js';
import { registerInlineWidgetKind } from '#lib/core/inline/inline-widgets.js';
import { declarePluginInlineKind } from '#lib/schema/plugin-kind.js';
import { bindActivationClick, createPressTracker } from '#lib/activation-click.js';
import { fixtureReading } from '#lib/test/harness/fixture-grammar.js';
import ThrowingTeardown from './fixtures/ThrowingTeardown.svelte';

const teardownError = new Error('teardown exploded');

it.each([
	[
		'an inline widget leaving the pool',
		(reportError: (error: unknown) => void) => {
			const kind = declarePluginInlineKind('throwingTeardownWidget');
			registerInlineWidgetKind(kind, {
				isWidget: () => true,
				component: ThrowingTeardown as Component as never
			});
			const reading = fixtureReading();
			const pool = createSvelteWidgetPool({
				reportError,
				getTheme: () => 'light',
				getDocument: () => undefined,
				getContentVersion: () => 0,
				navigateTo: async () => false,
				reading,
				activationClick: bindActivationClick(reading.mode, () => 'plain', createPressTracker())
			});
			pool.beginPass();
			pool.acquire(kind as never, { kind, start: 0, end: 2 } as never, '%%');
			pool.sweep();
			flushSync();
			pool.dispose();
		}
	],
	[
		'a decoration widget',
		(reportError: (error: unknown) => void) => {
			const spec = { component: ThrowingTeardown as Component as never };
			const handle = mountDecorationWidget(spec, { type: 'block', path: [0] }, reportError);
			flushSync();
			handle!.destroy();
		}
	]
])('%s reports a throw from its teardown', async (_route, mountAndTearDown) => {
	const reportError = vi.fn();
	mountAndTearDown(reportError);
	await Promise.resolve();
	expect(reportError.mock.calls).toEqual([[teardownError]]);
});
