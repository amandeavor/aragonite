import { test, expect } from './fixtures';

// The React and Vue showcases mount the shared top bar and own its state, so these cases check the
// loop the Svelte showcase's own specs cannot: a click in the bar changes the host's state, and the
// host hands that state back to the bar. Requirements: requirements/showcase.md.

test.beforeEach(async ({ page }) => {
	await page.goto('/showcase.html');
	await expect(page.locator('.showcase-bar')).toBeVisible();
});

test('a settings switch flips the host state and shows it pressed', async ({ page }) => {
	await page.getByTestId('showcase-settings').click();
	const theme = page.getByTestId('theme-toggle');
	await expect(theme).toHaveAttribute('aria-pressed', 'false');

	await theme.click();
	await expect(page.locator('.editor')).toHaveAttribute('data-editor-theme', 'dark');
	await expect(theme).toHaveAttribute('aria-pressed', 'true');

	await page.getByTestId('source-toggle').click();
	await expect(page.getByTestId('source-view')).toBeVisible();
	await expect(page.getByTestId('source-toggle')).toHaveAttribute('aria-pressed', 'true');
});

test('a mode segment switches the editor and moves the pressed segment', async ({ page }) => {
	const reading = page.locator('.showcase-mode[data-mode="reading"]');
	await reading.click();
	await expect(page.locator('.editor')).toHaveAttribute('data-presentation', 'reading');
	await expect(reading).toHaveAttribute('aria-pressed', 'true');
	await expect(page.locator('.showcase-mode[data-mode="live"]')).toHaveAttribute(
		'aria-pressed',
		'false'
	);
});

test('the wordmark names the framework and links to the repository', async ({ page }) => {
	const wordmark = page.getByRole('link', { name: 'aragonite on GitHub' });
	await expect(wordmark).toHaveAttribute('href', 'https://github.com/voithos-labs/aragonite');
	await expect(wordmark).toContainText(/in (React|Vue)/);
});
