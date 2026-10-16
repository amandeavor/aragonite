import { test, expect, caretAtEnd } from './fixtures';

// Vue reads an absent boolean prop as `false` unless told otherwise, which would switch the find
// bar off here.
test('a boolean option the app never passes keeps the editor default', async ({ page }) => {
	await page.goto('/');
	await caretAtEnd(page, 'Hello from the first note.');
	await page.keyboard.press('ControlOrMeta+f');

	await expect(page.getByRole('search')).toBeVisible();
});

// Vue reads a bare attribute as `true` only for a prop declared `Boolean`; any other prop gets `''`,
// which would switch the find bar off.
test('a boolean option passed as a bare attribute is on', async ({ page }) => {
	await page.goto('/?bare-boolean');
	await caretAtEnd(page, 'Searchable through a bare attribute.');
	await page.keyboard.press('ControlOrMeta+f');

	await expect(page.getByRole('search')).toBeVisible();
});

// A Vue proxy that reaches the editor counts as a second plugin of the same name, so a later editor
// warns that a different plugin by that name is already installed.
test('a plugin taken from reactive state is the plugin the app imported', async ({ page }) => {
	await page.goto('/?shared-plugin');

	await expect(page.locator('.editor')).toHaveCount(4);
	await expect(page.locator('.editor').nth(3)).toContainText('Passed as imported.');
});
