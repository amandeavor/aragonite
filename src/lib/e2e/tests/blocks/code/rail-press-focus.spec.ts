import type { Page } from '@playwright/test';
import { test, expect } from '../../../fixtures';
import { EditorPage } from '../../../editor-page';

// A pointer press on the code block's side gutter leaves the keyboard in the block, wherever an
// engine would put a pressed button's focus. Requirements: `requirements/blocks/code/rail-press-focus.md`.

const SOURCE = '```js\nconst x = 1\n```\n\n# Heading\n';
const TYPED = '```js\nconst x = 1abc\n```\n\n# Heading\n';

const railButton = (page: Page, name: string) =>
	page.locator('.code-rail').getByRole('button', { name, exact: true });

const PRESSES: { name: string; press(page: Page): Promise<void> }[] = [
	{ name: 'copy', press: (page) => railButton(page, 'Copy code').click() },
	{ name: 'run', press: (page) => railButton(page, 'Run code block').click() },
	{
		name: 'the overflow button, opening and closing its menu',
		async press(page) {
			await railButton(page, 'Code block actions').click();
			await expect(page.locator('.code-rail-menu')).toBeVisible();
			await railButton(page, 'Code block actions').click();
			await expect(page.locator('.code-rail-menu')).toHaveCount(0);
		}
	},
	{
		name: 'an overflow menu item',
		async press(page) {
			await railButton(page, 'Code block actions').click();
			await page.getByRole('menuitem', { name: 'Run all above' }).click();
			await expect(page.locator('.code-rail-menu')).toHaveCount(0);
		}
	},
	{
		name: 'the language chip, opening and closing its picker',
		async press(page) {
			await railButton(page, 'Code language: js').click();
			await expect(page.locator('.code-lang-picker input')).toBeFocused();
			await railButton(page, 'Code language: js').click();
			await expect(page.locator('.code-lang-picker')).toHaveCount(0);
		}
	}
];

test.describe('code block: a press on the side gutter keeps the keyboard in the block', () => {
	let editor: EditorPage;

	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		// The run and overflow buttons show only where the host supplies their hooks.
		await editor.goto('?codeActions=on&presentationMode=live');
		await editor.loadContent(SOURCE);
		await editor.focusBlockEnd(0);
		await editor.typeText('abc');
		await editor.bridge.waitForSourceEquals(TYPED);
		await editor.getBlock(0).hover();
	});

	for (const { name, press } of PRESSES) {
		test(`after ${name}, typing lands in the code block`, async ({ page }) => {
			await press(page);
			await page.keyboard.type('Q');
			await editor.bridge.waitForSource((source) => /^```js\n[^`]*Q[^`]*\n```\n/.test(source));
		});

		test(`after ${name}, Mod+Z undoes the last edit`, async ({ page }) => {
			await press(page);
			await editor.undo();
			await editor.bridge.waitForSourceEquals(SOURCE);
		});
	}
});
