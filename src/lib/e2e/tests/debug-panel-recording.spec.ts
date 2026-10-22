import { existsSync, readFileSync, rmSync } from 'node:fs';
import { test, expect } from '../fixtures';
import { EditorPage } from '../editor-page';
import { edgeKey } from '../platform-keys';

const TOGGLE_CHORD = 'ControlOrMeta+Shift+D';
const ROUTE = '/test/recordings';

test.describe('debug panel input recording', () => {
	let editor: EditorPage;

	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		await editor.goto();
		await editor.loadContent('alpha\n');
		await page.keyboard.press(TOGGLE_CHORD);
		await page
			.locator('.debug-section[data-section-title="Input recording"] .debug-section-header')
			.click();
	});

	function section() {
		return editor.page.locator('.debug-section[data-section-title="Input recording"]');
	}

	async function recordTyping(includeText: boolean): Promise<void> {
		if (includeText) await section().getByLabel('include text').check();
		await section().getByRole('button', { name: 'Record', exact: true }).click();
		await editor.clickBlock(0);
		await editor.page.keyboard.press(edgeKey('lineEnd'));
		await editor.page.keyboard.type('xy');
		await section().getByRole('button', { name: 'Stop', exact: true }).click();
	}

	test('Record, type, Stop, then Send saves the recording on the app server', async () => {
		await recordTyping(true);
		await expect(section()).toContainText('steps, with text');

		await section().getByRole('button', { name: 'Send', exact: true }).click();
		const status = section().locator('.recorder-note', { hasText: 'saved to' });
		await expect(status).toBeVisible();
		const saved = (await status.innerText()).replace('saved to ', '').trim();
		try {
			const file = JSON.parse(readFileSync(saved, 'utf8'));
			expect(file.format).toBe('aragonite-input-recording/1');
			expect(file.initial.source).toBe('alpha\n');
			expect(file.steps.at(-1).after.splice).toEqual([6, 6, 'y']);
		} finally {
			rmSync(saved, { force: true });
		}
		expect(existsSync(saved)).toBe(false);
	});

	test('Send downloads the recording where the dev route is missing', async ({ page }) => {
		await page.route(`**${ROUTE}`, (route) => route.fulfill({ status: 404 }));
		await recordTyping(false);
		await expect(section()).toContainText('steps');
		await expect(section()).not.toContainText('with text');

		const download = page.waitForEvent('download');
		await section().getByRole('button', { name: 'Send', exact: true }).click();
		const file = JSON.parse(readFileSync(await (await download).path(), 'utf8'));
		expect(file.text).toBe(false);
		expect(file.initial.source).toBeUndefined();
		await expect(section()).toContainText('HTTP 404');
	});

	test('the dev route refuses a recording in a format it does not read', async ({ page }) => {
		const response = await page.request.post(ROUTE, {
			data: { format: 'aragonite-input-recording/9' }
		});
		expect(response.status()).toBe(400);
		expect(await response.text()).toContain('this aragonite reads only');
	});
});
