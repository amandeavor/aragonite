import type { Page } from '@playwright/test';
import { test, expect } from '../../fixtures';
import { PluginsPage, clickWidgetCenter, type Point } from './helpers';
import { textRunStart } from '../../text-runs';

/**
 * A press means what was under it when it went down. With a formula's source open, the press moves
 * the caret out of it, the formula folds back to its render, and the line reflows before the click
 * or the context menu is handled. The rendered formula here is far wider than its source, so a
 * point read against the folded line lands inside it whatever the fonts.
 */

const WIDE = '$\\Huge WWWWWWWWWW$';

interface Host {
	name: string;
	source: string;
	/** The block holding the formula, by CST path. */
	path: number[];
}

const PARAGRAPH: Host = {
	name: 'a paragraph',
	source: `Sum ${WIDE} and &copy; tail\n\nNext\n`,
	path: [0]
};
const CELL: Host = {
	name: 'a table cell',
	source: `| Sum ${WIDE} and &copy; tail |\n| - |\n\nNext\n`,
	path: [0]
};

async function openWideFormula(page: Page, host: Host): Promise<PluginsPage> {
	const editor = new PluginsPage(page);
	await editor.gotoPlugins('math-two');
	await editor.loadContent(host.source);
	const math = page.locator('.math-inline-widget');
	await expect(math).toHaveCount(1);
	await clickWidgetCenter(math.first());
	await expect(math).toHaveCount(0);
	await editor.waitForRenderFlush();
	return editor;
}

/** A press held as long as a person holds one, which lets the fold land before the release. */
async function heldPress(page: Page, at: Point, button: 'left' | 'right'): Promise<void> {
	await page.mouse.move(at.x, at.y);
	await page.mouse.down({ button });
	await page.waitForTimeout(150);
	await page.mouse.up({ button });
}

/** Types a marker byte where the caret is and returns the source, the formula checked untouched. */
async function typeMarker(page: Page, editor: PluginsPage): Promise<string> {
	await page.keyboard.type('Q');
	await expect.poll(() => editor.bridge.getSource()).toContain('Q');
	const source = await editor.bridge.getSource();
	expect(source).toContain(WIDE);
	return source;
}

for (const host of [PARAGRAPH, CELL]) {
	test(`a held click on text past the open formula in ${host.name} lands at the press`, async ({
		page
	}) => {
		const editor = await openWideFormula(page, host);
		await heldPress(page, await textRunStart(page, 'and', { path: host.path }), 'left');
		expect(await typeMarker(page, editor)).toContain('Qand');
	});
}

test('a right-click on a widget past the open formula puts the menu caret beside it', async ({
	page
}) => {
	const editor = await openWideFormula(page, PARAGRAPH);
	const entity = page.locator("[data-block-path='[0]'] [data-inline-widget]").last();
	const box = (await entity.boundingBox())!;
	await heldPress(page, { x: box.x + box.width - 1, y: box.y + box.height / 2 }, 'right');
	await page.keyboard.press('Escape');
	expect(await typeMarker(page, editor)).toMatch(/&copy;Q|Q&copy;/);
});

test('a right-click in the top padding over text past the open formula keeps its column', async ({
	page
}) => {
	const editor = await openWideFormula(page, PARAGRAPH);
	const surface = page.locator("[data-block-path='[0]'] [contenteditable='true']").first();
	const top = await surface.evaluate((el) => el.getBoundingClientRect().top + 1);
	const and = await textRunStart(page, 'and', { path: [0] });
	await heldPress(page, { x: and.x, y: top }, 'right');
	await page.keyboard.press('Escape');
	expect(await typeMarker(page, editor)).toContain('Qand');
});

test('a right-click on prose past the open formula puts the menu caret at the press', async ({
	page
}) => {
	const editor = await openWideFormula(page, PARAGRAPH);
	await heldPress(page, await textRunStart(page, 'and', { path: [0] }), 'right');
	await page.keyboard.press('Escape');
	expect(await typeMarker(page, editor)).toContain('Qand');
});
