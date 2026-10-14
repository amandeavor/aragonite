// @vitest-environment jsdom
// A plugin's inline widget builder that throws costs only its widget: the construct shows as its
// source, the block around it keeps rendering, and the failure is reported.
// Miss-analysis: the component form had a mount catch and a test; the builder form was never
// handed a throwing builder, so its throw escaped and failed the whole block.
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import type { EditorError } from '#lib/editor-events.js';
import { registerInlineSyntax } from '#lib/core/inline/scan/plugin-syntax.js';
import { registerInlineWidgetKind } from '#lib/core/inline/inline-widgets.js';
import { declarePluginInlineKind } from '#lib/schema/plugin-kind.js';
import {
	blockHostAt,
	destroyMountedEditors,
	installLayoutStubs,
	mountEditor
} from '#lib/test/harness/mount-editor.svelte.js';

beforeAll(installLayoutStubs);
afterEach(destroyMountedEditors);

beforeEach(() => {
	const kind = declarePluginInlineKind('throwingBuilderWidget');
	registerInlineSyntax('%', (raw, pos, end) => {
		if (!raw.startsWith('%%', pos)) return null;
		const close = raw.indexOf('%%', pos + 2);
		if (close < 0 || close + 2 > end) return null;
		return { kind, start: pos, end: close + 2, children: [] };
	});
	registerInlineWidgetKind(kind, {
		isWidget: () => true,
		buildWidget: () => {
			throw new Error('builder exploded');
		}
	});
});

describe.each([
	['a paragraph', 'x %%w%% y\n', [0]],
	['a table cell', '| a |\n| - |\n| x %%w%% y |\n', [0]]
])('a throwing widget builder in %s', (_name, source, path) => {
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
		expect(errors[0]).toMatchObject({ origin: 'render', error: new Error('builder exploded') });
	});
});
