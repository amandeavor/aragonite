// @vitest-environment jsdom
// `searchChange` tells a host outside Svelte that what a find bar shows has changed: open or
// closed, the query, the options, the current match, the match count, the error or a replace's count.
import { describe, it, expect, afterEach } from 'vitest';
import { flushSync } from 'svelte';
import { createEditor, type EditorHandle } from '#lib/index.js';
import { installLayoutStubs, typeInFirstBlock } from '#lib/test/harness/mount-editor.svelte.js';
import { settleEditor } from '#lib/test/harness/settle.js';

installLayoutStubs();

const handles: EditorHandle[] = [];

afterEach(() => {
	for (const handle of handles.splice(0)) handle.destroy();
	document.body.replaceChildren();
});

function create(source: string) {
	const target = document.createElement('div');
	document.body.append(target);
	const editor = createEditor(target, { source });
	handles.push(editor);
	flushSync();
	const search = editor.getSearch();
	let fires = 0;
	editor.getEvents().on('searchChange', () => fires++);
	/** Fires since the last call, once Svelte has flushed. */
	const take = () => {
		flushSync();
		const n = fires;
		fires = 0;
		return n;
	};
	return { editor, target, search, take };
}

describe('searchChange', () => {
	it('fires once for each search action that changes what the bar shows', () => {
		const { search, take } = create('cat cat\n');

		search.open();
		expect(take()).toBe(1);
		search.setQuery('cat');
		expect(take()).toBe(1);
		search.setOptions({ caseSensitive: true });
		expect(take()).toBe(1);
		search.next();
		expect(take()).toBe(1);
		search.close();
		expect(take()).toBe(1);
	});

	it('stays quiet for an action that changes nothing', () => {
		const { search, take } = create('cat\n');
		search.open();
		search.setQuery('cat');
		search.setOptions({ wholeWord: true });
		take();

		search.setQuery('cat');
		search.setOptions({ wholeWord: true });
		expect(take()).toBe(0);
	});

	it('fires once for several actions in one turn', () => {
		const { search, take } = create('cat cat\n');
		search.open();
		take();

		search.setQuery('cat');
		search.next();
		expect(take()).toBe(1);
	});

	it('stays quiet for an edit that leaves the matches alone, and fires for one that adds one', async () => {
		const { search, target, take } = create('xyz\n\ncat cat\n');
		search.open();
		search.setQuery('cat');
		take();

		typeInFirstBlock(target, 'xyzw');
		await settleEditor();
		expect(take()).toBe(0);

		typeInFirstBlock(target, 'cat');
		await settleEditor();
		expect(search.matches).toHaveLength(3);
		expect(take()).toBe(1);
	});

	it('fires once for a replace-all that commits block by block, after the last block', async () => {
		const { search, take } = create('cat cat\n\ncat\n');
		search.open();
		search.setQuery('cat');
		take();

		search.setReplacement('dog');
		await search.replaceAll();
		await settleEditor();
		expect(search.matches).toHaveLength(0);
		expect(take()).toBe(1);
	});

	it('fires for a replace whose count the bar reads out, even when the matches stay', async () => {
		const { search, take } = create('cat cat\n');
		search.open();
		search.setQuery('cat');
		take();

		search.setReplacement('cats');
		await search.replaceCurrent();
		await settleEditor();
		expect(search.matches).toHaveLength(2);
		expect(search.replacedCount).toBe(1);
		expect(take()).toBe(1);
	});

	it('fires once when a source swap under the open bar moves the match count', async () => {
		const { editor, search, take } = create('cat cat\n');
		search.open();
		search.setQuery('cat');
		search.next();
		take();

		editor.update({ source: 'cat\n\ncat cat\n' });
		await settleEditor();
		expect(search.matches).toHaveLength(3);
		expect(search.activeIndex).toBe(0);
		expect(take()).toBe(1);
	});

	it('fires for a regex scan once its matches land, not while it runs', async () => {
		const { search, take } = create('cat cut\n');
		search.open();
		search.setQuery('c.t');
		expect(search.matches).toHaveLength(0);
		take();

		search.setOptions({ regex: true });
		expect(search.isScanning).toBe(true);
		expect(take()).toBe(0);
		await settleEditor();
		expect(search.matches).toHaveLength(2);
		expect(take()).toBe(1);
	});
});
