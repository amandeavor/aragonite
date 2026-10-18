import { test, expect } from '../fixtures';
import { gotoReady } from '../goto-ready';
import { createClipboardArm } from '../clipboard-arm';

// The showcase's "report a bug" button. This route has no `window.__test` bridge, so the cases
// read the rendered page, the tab it opens and the clipboard.
// Requirements: e2e/requirements/showcase-report-bug.md.

test.describe('/ showcase report a bug', () => {
	test.beforeEach(async ({ page }) => {
		// The new tab never reaches GitHub; it only has to open with the right address.
		await page
			.context()
			.route('https://github.com/**', (route) =>
				route.fulfill({ contentType: 'text/html', body: '<title>bug form</title>' })
			);
		await gotoReady(page, '/');
	});

	test('asks before recording, and Cancel records nothing', async ({ page }) => {
		await page.getByTestId('report-bug').click();
		const card = page.getByTestId('report-card');
		await expect(card).toContainText("the whole document's text");
		await expect(card).toContainText('public');
		await card.getByRole('button', { name: 'Cancel' }).click();
		await expect(card).toHaveCount(0);
		await expect(page.getByTestId('report-bug')).toHaveText('report a bug');
	});

	test('records with text, then on stop opens the bug form with the recording on the clipboard', async ({
		page
	}) => {
		await page.getByTestId('report-bug').click();
		await page.getByRole('button', { name: 'Start recording' }).click();
		await expect(page.getByTestId('report-bug')).toContainText('stop and report');

		await page.locator('[data-block-kind="paragraph"]').first().click();
		await page.keyboard.press('End');
		await page.keyboard.type('zq');

		const tab = page.context().waitForEvent('page');
		await page.getByTestId('report-bug').click();
		const url = new URL((await tab).url());
		expect(url.origin + url.pathname).toBe('https://github.com/voithos-labs/aragonite/issues/new');
		expect(url.searchParams.get('template')).toBe('bug.yml');
		expect(url.searchParams.get('where')).toMatch(/^\d+\.\d+\.\d+, Chrome \d+ on \w+, live mode$/);
		// The demo document alone outgrows a link, so the recording rides the clipboard.
		expect(url.searchParams.get('recording')).toContain('on your clipboard');
		await expect(page.getByTestId('report-card')).toContainText('on your');

		// The system clipboard on Windows hands the line breaks back as CRLF.
		const clip = await createClipboardArm(page).read();
		const recording = JSON.parse(clip.replace(/^```json\r?\n|\r?\n```$/g, ''));
		expect(recording.text).toBe(true);
		expect(recording.steps.at(-1).after.splice[2]).toBe('q');
		expect(recording.editor.presentationMode).toBe('live');
	});
});
