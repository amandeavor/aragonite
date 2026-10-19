// @vitest-environment jsdom
// A key reads the caret only after a caret the browser left inside a widget has moved to the
// widget's edge, so the key types there instead of into the widget, where nothing lands.
// Miss-analysis: every typing row put the caret through the editor's writer, which never writes
// one inside a widget, so no key ever arrived ahead of the move off one.
import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import {
	destroyMountedEditors,
	installLayoutStubs,
	mountEditor,
	surfaceAt
} from '#lib/test/harness/mount-editor.svelte.js';
import { pressKey } from '#lib/test/harness/settle.js';
import {
	disablePerfInstruments,
	enablePerfInstruments,
	perfSnapshot,
	resetPerfInstruments
} from '#lib/perf/instruments.js';

beforeAll(installLayoutStubs);
afterEach(destroyMountedEditors);

describe('a key with the caret inside a widget', () => {
	it('types after the widget whose end the caret reads as', async () => {
		const editor = mountEditor({ source: 'a &amp;\n' });
		const el = surfaceAt(editor, [0]);
		el.focus();
		const inside = el.querySelector('[data-inline-widget]')!.firstChild!;
		window.getSelection()!.collapse(inside, 1);

		await pressKey(el, { key: 'Z' });
		await editor.settle();

		expect(editor.source()).toBe('a &amp;Z\n');
	});
});

describe('the caret check a key runs', () => {
	afterEach(disablePerfInstruments);

	it('climbs from a caret in plain text to its block once, with no walk', async () => {
		const editor = mountEditor({ source: 'plain text\n' });
		const el = surfaceAt(editor, [0]);
		el.focus();
		window.getSelection()!.collapse(el.firstChild!, 3);
		enablePerfInstruments();
		resetPerfInstruments();

		await pressKey(el, { key: 'ArrowLeft' });

		expect(perfSnapshot().caretCanonicalSteps).toBe(1);
		expect(perfSnapshot().caretCanonicalWalks).toBe(0);
	});
});
