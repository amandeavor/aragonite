import { test, expect } from './fixtures';

test('a server component renders the wrapper directly', async ({ page }) => {
	await page.goto('/server');

	await expect(page.locator('.editor')).toContainText('Rendered by a server component');
});
