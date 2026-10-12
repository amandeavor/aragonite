import { test, expect } from '../../fixtures';
import type { Page } from '@playwright/test';
import { EditorPage } from '../../editor-page';

/**
 * Mark activation from the keyboard (requirements/decorations/mark-activate.md). Each source
 * records its `onActivate` calls on `window.__activations`, the anchor as plain numbers.
 */

const ACTIVATE = 'decorations.activateAtCaret';
const CHORD = 'Alt+Enter';

type Activation = { cls: string; anchor: { left: number; top: number; width: number } };

interface MarkSpec {
	path: number[];
	start: number;
	end: number;
	cls: string;
}

async function addActivateSource(page: Page, name: string, marks: MarkSpec[]): Promise<void> {
	await page.evaluate(
		({ name, marks }) => {
			const w = window as any;
			w.__activations ??= [];
			w.__test.decorations.addSource({
				name,
				provide: () =>
					marks.map((m) => ({
						type: 'mark',
						path: m.path,
						start: m.start,
						end: m.end,
						class: m.cls,
						interactive: {
							onActivate: (dec: { class: string }, ctx: { anchor: DOMRect }) => {
								w.__activations.push({
									cls: dec.class,
									anchor: { left: ctx.anchor.left, top: ctx.anchor.top, width: ctx.anchor.width }
								});
							}
						}
					}))
			});
		},
		{ name, marks }
	);
}

function activations(page: Page): Promise<Activation[]> {
	return page.evaluate(() => [...((window as any).__activations ?? [])]);
}

function canRun(page: Page): Promise<boolean> {
	return page.evaluate((id) => (window as any).__test.canRunCommand(id), ACTIVATE);
}

function runActivate(page: Page): Promise<boolean> {
	return page.evaluate((id) => (window as any).__test.runCommand(id), ACTIVATE);
}

test.describe('mark activation from the keyboard', () => {
	let editor: EditorPage;

	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		await editor.goto();
		await page.evaluate(
			({ chord, command }) => (window as any).__test.setKeybindings([{ chord, command }]),
			{ chord: CHORD, command: ACTIVATE }
		);
	});

	test('the bound chord runs the mark under the caret once, anchored on its rect', async ({
		page
	}) => {
		await editor.loadContent('look up this word\n');
		await addActivateSource(page, 'kbd', [{ path: [0], start: 13, end: 17, cls: 'ac-word' }]);
		const box = (await page.locator('.decoration-overlay.ac-word').boundingBox())!;

		await editor.focusBlock(0, 15);
		await page.keyboard.press(CHORD);

		await expect.poll(() => activations(page)).toHaveLength(1);
		const [only] = await activations(page);
		expect(only).toEqual({
			cls: 'ac-word',
			anchor: {
				left: expect.closeTo(box.x, 0),
				top: expect.closeTo(box.y, 0),
				width: expect.closeTo(box.width, 0)
			}
		});
		expect(await page.evaluate(() => (window as any).__test.getSource())).toBe(
			'look up this word\n'
		);
	});

	test('the host runs it with runCommand, which answers true', async ({ page }) => {
		await editor.loadContent('look up this word\n');
		await addActivateSource(page, 'door', [{ path: [0], start: 13, end: 17, cls: 'ac-door' }]);
		// The mark's far edge counts as inside it.
		await editor.focusBlock(0, 17);

		expect(await canRun(page)).toBe(true);
		expect(await runActivate(page)).toBe(true);
		expect((await activations(page)).map((a) => a.cls)).toEqual(['ac-door']);
	});

	test('a mark in a table cell activates, anchored on the cell', async ({ page }) => {
		await editor.loadContent('| Name | Role |\n| :--- | :--- |\n| Ada | dev |\n');
		await addActivateSource(page, 'cell', [{ path: [0, 1, 0], start: 0, end: 3, cls: 'ac-cell' }]);
		const box = (await page.locator('.decoration-overlay.ac-cell').boundingBox())!;

		await editor.focusBlockAtPath([0, 1, 0], 1);
		await page.keyboard.press(CHORD);

		await expect.poll(() => activations(page)).toHaveLength(1);
		const [only] = await activations(page);
		expect(only.anchor).toEqual({
			left: expect.closeTo(box.x, 0),
			top: expect.closeTo(box.y, 0),
			width: expect.closeTo(box.width, 0)
		});
	});

	test('of two overlapping marks, the inner one runs', async ({ page }) => {
		await editor.loadContent('look up this word\n');
		await addActivateSource(page, 'outer', [{ path: [0], start: 0, end: 17, cls: 'ac-outer' }]);
		await addActivateSource(page, 'inner', [{ path: [0], start: 13, end: 17, cls: 'ac-inner' }]);

		await editor.focusBlock(0, 15);
		await page.keyboard.press(CHORD);

		await expect.poll(() => activations(page)).toHaveLength(1);
		expect((await activations(page)).map((a) => a.cls)).toEqual(['ac-inner']);
	});

	test('of two marks over the same range, the earlier source runs', async ({ page }) => {
		await editor.loadContent('look up this word\n');
		await addActivateSource(page, 'first', [{ path: [0], start: 13, end: 17, cls: 'ac-first' }]);
		await addActivateSource(page, 'second', [{ path: [0], start: 13, end: 17, cls: 'ac-second' }]);

		await editor.focusBlock(0, 15);
		expect(await runActivate(page)).toBe(true);
		expect((await activations(page)).map((a) => a.cls)).toEqual(['ac-first']);
	});

	test('with no mark under the caret, it cannot run and runs nothing', async ({ page }) => {
		await editor.loadContent('look up this word\n');
		await addActivateSource(page, 'none', [{ path: [0], start: 13, end: 17, cls: 'ac-none' }]);

		await editor.focusBlock(0, 2);
		expect(await canRun(page)).toBe(false);
		expect(await runActivate(page)).toBe(false);
		expect(await activations(page)).toHaveLength(0);
	});

	test('a throwing onActivate reaches the error event', async ({ page }) => {
		await editor.loadContent('look up this word\n');
		await page.evaluate(() => {
			const w = window as any;
			w.__test.startErrorCapture();
			w.__test.decorations.addSource({
				name: 'boom',
				provide: () => [
					{
						type: 'mark',
						path: [0],
						start: 13,
						end: 17,
						class: 'ac-boom',
						interactive: {
							onActivate: () => {
								throw new Error('plugin onActivate blew up');
							}
						}
					}
				]
			});
		});

		await editor.focusBlock(0, 15);
		await page.keyboard.press(CHORD);
		await expect
			.poll(() => page.evaluate(() => (window as any).__test.getCapturedErrors()))
			.toEqual(['decoration']);
	});
});
