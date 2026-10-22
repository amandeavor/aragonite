import { test, expect } from '../../fixtures';
import { PluginsPage } from './helpers';

/**
 * A drawn plugin widget that never shows its source, selected whole by Mod+K beside it, then copied,
 * cut and pasted over, in a paragraph and in a table cell alike. The seed and the scenarios are in
 * e2e/requirements/plugins/chips.md.
 */

const SEED = 'Prose {{alpha}} here\n\n| Note | B |\n| --- | --- |\n| x {{beta}} y | z |\n\nAfter\n';

// Each chip's block and the offset just past its closing braces.
const HOSTS = [
	{ name: 'a paragraph', path: [0], after: 15, chip: '{{alpha}}' },
	{ name: 'a table cell', path: [1, 1, 0], after: 10, chip: '{{beta}}' }
];

test.describe('a chip selected by Mod+K', () => {
	let editor: PluginsPage;

	test.beforeEach(async ({ page }) => {
		editor = new PluginsPage(page);
		await editor.gotoPlugins('chips');
		await editor.waitForRenderFlush();
	});

	async function selectChip(path: number[], after: number): Promise<void> {
		await editor.page.evaluate(
			([p, offset]) => (window as any).__test.focusBlockComponent(p, offset),
			[path, after] as const
		);
		await editor.page.keyboard.press('ControlOrMeta+k');
		await editor.waitForRenderFlush();
	}

	for (const host of HOSTS) {
		test(`in ${host.name}, Ctrl+C copies the chip's bytes and changes nothing`, async ({
			page
		}) => {
			await selectChip(host.path, host.after);
			await editor.seedClipboard('');
			await page.keyboard.press('ControlOrMeta+c');

			await expect.poll(() => editor.readClipboard()).toBe(host.chip);
			expect(await editor.bridge.getSource()).toBe(SEED);
		});

		test(`in ${host.name}, Ctrl+X takes the chip out and carries its bytes`, async ({ page }) => {
			await selectChip(host.path, host.after);
			await editor.seedClipboard('');
			await page.keyboard.press('ControlOrMeta+x');

			await expect.poll(() => editor.readClipboard()).toBe(host.chip);
			await editor.bridge.waitForSourceContains(SEED.replace(` ${host.chip}`, ' '));
		});

		test(`in ${host.name}, Ctrl+V replaces the chip`, async () => {
			await selectChip(host.path, host.after);
			await editor.seedClipboard('Q');
			await editor.paste();

			await editor.bridge.waitForSourceContains(SEED.replace(host.chip, 'Q'));
		});
	}
});
