// @vitest-environment jsdom
// An inline widget whose `isWidget` or `buildWidget` throws shows as its source, keeps its block
// and the caret working, and is reported.
// Miss-analysis: the component form had a mount catch and a test; the builder form's two callbacks
// were never handed a throw, so it escaped and failed the whole block.
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import type { EditorError } from '#lib/editor-events.js';
import { registerInlineSyntax } from '#lib/core/inline/scan/plugin-syntax.js';
import {
	registerInlineWidgetKind,
	type InlineWidgetDescriptor
} from '#lib/core/inline/inline-widgets.js';
import { declarePluginInlineKind } from '#lib/schema/plugin-kind.js';
import {
	blockHostAt,
	destroyMountedEditors,
	installLayoutStubs,
	mountEditor,
	placeCaret,
	surfaceAt
} from '#lib/test/harness/mount-editor.svelte.js';
import { pressKey } from '#lib/test/harness/settle.js';

beforeAll(installLayoutStubs);
afterEach(destroyMountedEditors);

const explode = (): never => {
	throw new Error('widget exploded');
};

describe.each<[string, InlineWidgetDescriptor]>([
	['buildWidget', { isWidget: () => true, buildWidget: explode }],
	['isWidget', { isWidget: explode, buildWidget: () => document.createElement('b') }]
])('a widget whose %s throws', (_callback, descriptor) => {
	beforeEach(() => {
		const kind = declarePluginInlineKind('throwingBuilderWidget');
		registerInlineSyntax('%', (raw, pos, end) => {
			if (!raw.startsWith('%%', pos)) return null;
			const close = raw.indexOf('%%', pos + 2);
			if (close < 0 || close + 2 > end) return null;
			return { kind, start: pos, end: close + 2, children: [] };
		});
		registerInlineWidgetKind(kind, descriptor);
	});

	describe.each([
		['a paragraph', 'x %%w%% y\n', [0]],
		['a table cell', '| a |\n| - |\n| x %%w%% y |\n', [0]]
	])('in %s', (_name, source, path) => {
		it('renders the construct as its source and reports the failure', async () => {
			const mounted = mountEditor({ source: '', presentationMode: 'live' });
			const errors: EditorError[] = [];
			mounted.instance.getEvents().on('error', (error) => errors.push(error));
			mounted.props.source = source;
			await mounted.settle();

			const host = blockHostAt(mounted, path);
			expect(host.querySelector('[data-failed-block]')).toBeNull();
			expect(host.textContent).toContain('x %%w%% y');
			expect(errors.length).toBeGreaterThan(0);
			expect(errors[0]).toMatchObject({ origin: 'render', error: new Error('widget exploded') });
		});
	});

	it('lets the caret walk across the construct without a throw', async () => {
		const mounted = mountEditor({ source: 'x %%w%% y\n', presentationMode: 'live' });
		await mounted.settle();
		const surface = surfaceAt(mounted, [0]);
		placeCaret(surface, 1);
		for (let i = 0; i < 6; i++) await pressKey(surface, { key: 'ArrowRight' });
		expect(blockHostAt(mounted, [0]).querySelector('[data-failed-block]')).toBeNull();
	});
});
