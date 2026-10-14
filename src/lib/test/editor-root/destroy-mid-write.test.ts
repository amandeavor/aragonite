// @vitest-environment jsdom
// Miss-analysis: every insertMarkdown test awaited the insert before tearing down, so a write still
// in flight when the editor unmounted, or when a swap replaced its document, was never made.
import { describe, it, expect, afterEach } from 'vitest';
import { flushSync } from 'svelte';
import {
	destroyMountedEditors,
	installLayoutStubs,
	mountWithCaret
} from '#lib/test/harness/mount-editor.svelte.js';
import type { InsertMarkdownOptions } from '#lib/editor-props.js';

installLayoutStubs();
afterEach(destroyMountedEditors);

describe.each<{ placement: InsertMarkdownOptions['placement'] }>([
	{ placement: 'caret' },
	{ placement: 'below' }
])('an insertMarkdown at $placement still in flight', ({ placement }) => {
	it('lands nowhere and reports nothing once the editor unmounts', async () => {
		const { editor } = mountWithCaret('hello\n', 2, 'source');
		await editor.settle();
		const heard: string[] = [];
		const events = editor.instance.getEvents();
		events.on('edit', () => heard.push('edit'));
		events.on('error', (e) => heard.push(`error ${e.origin}`));

		const inserted = editor.instance.insertMarkdown('**x**', { placement });
		await editor.destroy();

		expect(await inserted).toBe(false);
		await editor.settle();
		expect(heard).toEqual([]);
	});

	it('does not land in the document a source swap put in its place', async () => {
		const { editor } = mountWithCaret('hello\n', 2, 'source');
		await editor.settle();

		const inserted = editor.instance.insertMarkdown('**x**', { placement });
		editor.props.source = 'other\n';
		flushSync();

		expect(await inserted).toBe(false);
		await editor.settle();
		expect(editor.source()).toBe('other\n');
	});
});
