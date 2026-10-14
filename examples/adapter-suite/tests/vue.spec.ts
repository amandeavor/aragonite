import { test, expect, caretAtEnd } from './fixtures';

// Vue reads an absent boolean prop as `false` unless told otherwise, which would switch the find
// bar off here.
test('a boolean option the app never passes keeps the editor default', async ({ page }) => {
	await page.goto('/');
	await caretAtEnd(page, 'Hello from the first note.');
	await page.keyboard.press('ControlOrMeta+f');

	await expect(page.getByRole('search')).toBeVisible();
});

// Without unwrapping, the first editor installs the plugin's Vue proxy and the second, handed the
// plugin itself, warns that a different plugin of that name is already installed.
test('a plugin held in reactive state is the plugin the app imported', async ({ page }) => {
	await page.goto('/?two-editors');

	await expect(page.locator('.editor')).toHaveCount(2);
	await expect(page.locator('.editor').nth(1)).toContainText('Passed as imported.');
});
