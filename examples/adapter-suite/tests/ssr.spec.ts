import { test, expect } from './fixtures';

// A hydration mismatch fails the test through the fixture: React reports it as a page error, Vue
// as a console error.
test('the page renders on the server without the editor, and hydrates with no warning', async ({
	page,
	request
}) => {
	const html = await (await request.get('/')).text();
	expect(html).toContain('data-testid="mirror"');
	expect(html).not.toContain('contenteditable');

	await page.goto('/');
	await expect(page.locator('.editor')).toContainText('Hello from the first note.');
});
