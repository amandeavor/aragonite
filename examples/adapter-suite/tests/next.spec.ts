import { test, expect } from './fixtures';

// A hydration mismatch fails the test through the fixture: React reports it as a page error.
test('the page renders on the server and hydrates with no warning', async ({ page, request }) => {
	const html = await (await request.get('/')).text();
	expect(html).toContain('data-testid="mirror"');

	await page.goto('/');
	await expect(page.locator('.editor')).toContainText('Hello from the first note.');
});

test('a server component renders the wrapper directly', async ({ page }) => {
	await page.goto('/server');

	await expect(page.locator('.editor')).toContainText('Rendered by a server component');
});
