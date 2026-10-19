import { test, expect } from '../../fixtures';
import { EditorPage } from '../../editor-page';

// The right-click menu's Cut and Copy write what Ctrl+X and Ctrl+C write for the same selection,
// and its Paste as plain text escapes Markdown only where the block reads Markdown.
// Requirements: `e2e/requirements/clipboard/menu-clipboard.md`.

const BLOCKS = [
	{ name: 'a paragraph', doc: 'abcd efgh\n', start: 0, left: ' efgh\n' },
	{ name: 'a code block', doc: '```\nabcd efgh\n```\n', start: 4, left: '```\n efgh\n```\n' }
];

/** Selects `abcd` by keyboard from `start` of the block at `path`, then right-clicks inside it. */
async function openMenuOverSelection(
	editor: EditorPage,
	start: number,
	path: number[] = [0]
): Promise<void> {
	await editor.focusBlockAtPath(path, start);
	for (let i = 0; i < 4; i++) await editor.page.keyboard.press('Shift+ArrowRight');
	const box = await editor.page.evaluate(() => {
		const rect = window.getSelection()!.getRangeAt(0).getBoundingClientRect();
		return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
	});
	await editor.page.mouse.click(box.x, box.y, { button: 'right' });
	await expect(editor.page.getByRole('menu', { name: 'Block actions' })).toBeVisible();
}

test.describe('the right-click menu’s clipboard rows', () => {
	let editor: EditorPage;

	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		await editor.goto();
		await editor.seedClipboard('');
	});

	for (const block of BLOCKS) {
		test(`Cut in ${block.name} puts the selection on the clipboard and removes it`, async ({
			page
		}) => {
			await editor.loadContent(block.doc);
			await openMenuOverSelection(editor, block.start);

			await page.getByRole('menuitem', { name: 'Cut' }).click();

			await editor.bridge.waitForSourceEquals(block.left);
			expect(await editor.readClipboard()).toBe('abcd');
		});

		test(`Copy in ${block.name} puts the selection on the clipboard and leaves the bytes`, async ({
			page
		}) => {
			await editor.loadContent(block.doc);
			await openMenuOverSelection(editor, block.start);

			await page.getByRole('menuitem', { name: 'Copy' }).click();

			await expect.poll(() => editor.readClipboard()).toBe('abcd');
			expect(await editor.bridge.getSource()).toBe(block.doc);
		});
	}

	const PLAIN_TARGETS = [
		{ name: 'a paragraph', doc: 'abcd efgh\n', path: [0], start: 0, landed: '\\*a\\* # b efgh\n' },
		{
			name: 'a code block',
			doc: '```\nabcd efgh\n```\n',
			path: [0],
			start: 4,
			landed: '```\n*a* # b efgh\n```\n'
		},
		{
			name: 'a code block in a list item',
			doc: '- item\n\n  ```\n  abcd efgh\n  ```\n',
			path: [0, 0, 1],
			start: 4,
			landed: '- item\n\n  ```\n  *a* # b efgh\n  ```\n'
		}
	];
	for (const target of PLAIN_TARGETS) {
		test(`Paste as plain text over a selection in ${target.name}`, async ({ page }) => {
			await editor.seedClipboard('*a* # b');
			await editor.loadContent(target.doc);
			await openMenuOverSelection(editor, target.start, target.path);

			await page.getByRole('menuitem', { name: 'Paste as plain text' }).click();

			await editor.bridge.waitForSourceEquals(target.landed);
		});
	}
});
