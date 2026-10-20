import { test, expect } from '../fixtures';
import { EditorPage } from '../editor-page';
import { freezeInPageClock } from '../page-probes';
import { openTypingBatchCount, releaseTypingPause } from '../typing-batch';

test.describe('where a test splits undo steps', () => {
	let editor: EditorPage;

	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		await editor.goto();
		await editor.loadContent('x\n');
		await editor.focusBlockEnd(0);
	});

	test('keys typed slower than the pause stay one undo step', async ({ page }) => {
		await page.keyboard.type('abc', { delay: 300 });
		await editor.bridge.waitForSourceContains('xabc');

		await editor.undo();
		await editor.bridge.waitForSourceEquals('x\n');
	});

	test('an ended batch splits even when the page timer never fires', async ({ page }) => {
		await freezeInPageClock(page);
		await page.keyboard.type('a');
		await editor.bridge.waitForSourceContains('xa');
		await editor.endTypingBatch();
		await page.keyboard.type('b');
		await editor.bridge.waitForSourceContains('xab');

		await editor.undo();
		await editor.bridge.waitForSourceEquals('xa\n');
		await editor.undo();
		await editor.bridge.waitForSourceEquals('x\n');
	});

	test('released, the real pause ends a batch on its own', async ({ page }) => {
		await releaseTypingPause(page);
		await page.keyboard.type('a');
		await editor.bridge.waitForSourceContains('xa');
		await expect.poll(() => openTypingBatchCount(page)).toBe(0);
		await page.keyboard.type('b');
		await editor.bridge.waitForSourceContains('xab');

		await editor.undo();
		await editor.bridge.waitForSourceEquals('xa\n');
	});
});
