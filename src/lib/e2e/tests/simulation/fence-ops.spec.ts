import { test, expect } from '../../fixtures';
import { EditorPage } from '../../editor-page';
import { Gestures } from '../../simulation/gestures';
import { makeRng } from '../../simulation/rng';
import { assertCheckpoint } from '../../simulation/invariants';
import { makeSimContext } from './helpers';

// Three fences in a row, so a closer stranded by a typo on the first opener pairs with the bare
// opener of the second, and the closer that one leaves behind runs on to the third's.
const FENCE_DOC =
	'Intro\n\n```js\ncode\n```\n\nmiddle\n\n```\nbare\n```\n\nbetween\n\n```py\nlast\n```\n\nend\n';

test.describe('fence-ops simulation', () => {
	test('a typo on a fence opener and its fix keep every fence below paired as a reload pairs it', async ({
		page
	}) => {
		const editor = new EditorPage(page);
		await editor.goto();
		await editor.loadContent(FENCE_DOC);
		await editor.waitForRenderFlush();
		const ctx = await makeSimContext(page, editor, 'fence-ops');
		const g = new Gestures(ctx, makeRng(1));
		await assertCheckpoint(ctx, 'loaded');

		await g.breakFenceOpener(1);
		expect(await editor.bridge.getSource()).toBe(FENCE_DOC.replace('```js', '``js'));
		await assertCheckpoint(ctx, 'opener-broken');

		await g.retypeFenceBacktick();
		expect(await editor.bridge.getSource()).toBe(FENCE_DOC);
		await assertCheckpoint(ctx, 'opener-fixed');
	});
});
