import { test } from '../../../../fixtures';
import { EditorPage } from '../../../../editor-page';
import { edgeKey } from '../../../../platform-keys';

test.describe('blockquote navigation: nested blockquote', () => {
	let editor: EditorPage;

	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		await editor.goto();
	});

	test('ArrowUp from outer inner paragraph into nested inner paragraph', async () => {
		await editor.loadContent('> > deep\n>\n> outer\n');
		const outer = editor.page.locator('[contenteditable="true"]', { hasText: /^outer$/ });
		await outer.click();
		await editor.page.keyboard.press(edgeKey('lineEnd'));
		await editor.page.keyboard.press('ArrowUp');
		await editor.typeText('Z');
		await editor.bridge.waitForSourceMatches(/^> > .*Z/m);
	});

	test('ArrowDown from nested inner paragraph to outer inner paragraph', async () => {
		await editor.loadContent('> > deep\n>\n> outer\n');
		const deep = editor.page.locator('[contenteditable="true"]', { hasText: /^deep$/ });
		await deep.click();
		await editor.page.keyboard.press(edgeKey('lineStart'));
		await editor.page.keyboard.press('ArrowDown');
		await editor.typeText('Z');
		await editor.bridge.waitForSourceMatches(/^> [^>].*Z/m);
	});
});
