import { test, expect } from '../../../../fixtures';
import { EditorPage } from '../../../../editor-page';

test.describe('task checkbox: deleting a to-do’s text', () => {
	let editor: EditorPage;

	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		await editor.goto();
	});

	test('Backspace over the whole text leaves the marker and its box', async () => {
		await editor.loadContent('- [ ] pending\n');
		await editor.focusBlockAtPath([0, 0, 0], 0);
		await editor.page.keyboard.press('Shift+End');
		await editor.page.keyboard.press('Backspace');
		await editor.bridge.waitForSourceNotContains('pending', 5000);
		expect((await editor.bridge.getSource()).trim()).toBe('- [ ]');
	});
});
