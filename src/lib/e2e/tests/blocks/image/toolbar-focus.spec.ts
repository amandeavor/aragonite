import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../../fixtures';
import { EditorPage } from '../../../editor-page';
import { waitForAllImagesLoaded } from './helpers';
import { focusWalkKey } from '../../../platform-keys';

// Every way an image toolbar sub-mode ends, then each key that must still reach the image: the
// end leaves the image selected with its paragraph focused, wherever the engine puts a pressed
// button's focus.
const LOADED = 'text\n\n![cat|200x200](/test-fixtures/sample.png)\n';
const CROPPED = /@50,50\]/;

const button = (page: Page, name: string) =>
	page.locator('.md-image-properties').getByRole('button', { name, exact: true });

interface SubModeEnd {
	name: string;
	/** Whether the end itself writes; an end that doesn't is staged after a crop that did. */
	writes: boolean;
	end(page: Page): Promise<void>;
}

const ENDS: SubModeEnd[] = [
	{
		name: 'the Alt field closed by its button',
		writes: true,
		async end(page) {
			await button(page, 'Alt text').click();
			await page.keyboard.type(' v2');
			await button(page, 'Alt text').click();
		}
	},
	{
		name: 'the Alt field closed by Enter',
		writes: true,
		async end(page) {
			await button(page, 'Alt text').click();
			await page.keyboard.type(' v2');
			await page.keyboard.press('Enter');
		}
	},
	{
		name: 'the Alt field closed by Escape',
		writes: false,
		async end(page) {
			await button(page, 'Alt text').click();
			await page.keyboard.type(' v2');
			await page.keyboard.press('Escape');
		}
	},
	{
		// Untyped, so the field closes with nothing to commit and only its focus hand-back is tested.
		name: 'the Alt field closed by starting a crop',
		writes: true,
		async end(page) {
			await button(page, 'Alt text').click();
			await button(page, 'Crop image').click();
			await page.keyboard.press('Enter');
		}
	},
	{
		name: 'the crop applied by Enter',
		writes: true,
		async end(page) {
			await button(page, 'Crop image').click();
			await page.keyboard.press('Enter');
		}
	},
	{
		name: 'the crop applied by its tick',
		writes: true,
		async end(page) {
			await button(page, 'Crop image').click();
			await button(page, 'Apply crop').click();
		}
	},
	{
		name: 'the crop cancelled by Escape',
		writes: false,
		async end(page) {
			await button(page, 'Crop image').click();
			await page.keyboard.press('Escape');
		}
	},
	{
		name: 'the crop cancelled by its cross',
		writes: false,
		async end(page) {
			await button(page, 'Crop image').click();
			await button(page, 'Cancel crop').click();
		}
	}
];

// Returns the bytes the end left, after the image is selected and the sub-mode has ended.
async function endSubMode(editor: EditorPage, page: Page, subMode: SubModeEnd): Promise<string> {
	await editor.loadContent(LOADED);
	await waitForAllImagesLoaded(page);
	const widget = page.locator('[data-image-widget]').first();
	await widget.click();
	if (!subMode.writes) {
		// A crop first, so the undo has an entry the end itself doesn't write.
		await button(page, 'Crop image').click();
		await page.keyboard.press('Enter');
		await editor.bridge.waitForSourceMatches(CROPPED);
	}
	const before = await editor.bridge.getSource();
	await subMode.end(page);
	await expect(page.locator('.md-image-crop-surface')).toHaveCount(0);
	await expect(page.locator('.md-image-properties input')).toHaveCount(0);
	if (subMode.writes) await editor.bridge.waitForSource((source) => source !== before);
	else await editor.waitForNoSourceMutation();
	return editor.bridge.getSource();
}

test.describe('image toolbar focus', () => {
	let editor: EditorPage;

	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		await editor.goto();
	});

	for (const subMode of ENDS) {
		test(`after ${subMode.name}, Mod+Z undoes the last edit and Mod+Shift+Z redoes it`, async ({
			page
		}) => {
			const after = await endSubMode(editor, page, subMode);
			// Either way the last edit started from the loaded bytes.
			await editor.undo();
			await editor.bridge.waitForSourceEquals(LOADED);
			await editor.redo();
			await editor.bridge.waitForSourceEquals(after);
		});

		test(`after ${subMode.name}, Escape dismisses the image`, async ({ page }) => {
			await endSubMode(editor, page, subMode);
			await expect(page.locator('.md-image-properties')).toBeVisible();
			await page.keyboard.press('Escape');
			await expect(page.locator('.md-image-properties')).toHaveCount(0);
		});
	}

	for (const fieldOpen of [false, true]) {
		test(`Remove with the Alt field ${fieldOpen ? 'open' : 'closed'} leaves typing where the image was`, async ({
			page
		}) => {
			// Mid-line, so a caret anywhere but the image's spot types somewhere else.
			await editor.loadContent('text\n\na ![cat|200x200](/test-fixtures/sample.png) b\n');
			await waitForAllImagesLoaded(page);
			await page.locator('[data-image-widget]').first().click();
			if (fieldOpen) {
				await button(page, 'Alt text').click();
				await expect(page.locator('.md-image-properties input')).toBeFocused();
			}
			await button(page, 'Remove image').click();
			await editor.bridge.waitForSourceEquals('text\n\na  b\n');
			await page.keyboard.type('Q');
			await editor.bridge.waitForSourceEquals('text\n\na Q b\n');
		});
	}
});

// The toolbar's buttons are reached by keyboard from the open Alt field, going back with Shift+Tab.
const MID_LINE = 'text\n\na ![cat|200x200](/test-fixtures/sample.png) b\n';

interface KeyboardAction {
	label: string;
	/** Typed into the Alt field first, so the action has a write to undo. */
	draft: string;
	/** What finishes the action once its button is pressed. */
	finish?: (page: Page) => Promise<void>;
}

const KEYBOARD_ACTIONS: KeyboardAction[] = [
	{ label: 'Alt text', draft: ' v2' },
	{ label: 'Crop image', draft: '', finish: (page) => page.keyboard.press('Enter') },
	{ label: 'Remove image', draft: '' }
];

interface AfterKey {
	name: string;
	check(editor: EditorPage, page: Page): Promise<void>;
}

const AFTER_KEYS: AfterKey[] = [
	{
		name: 'a typed letter lands where the image is',
		async check(editor, page) {
			await page.keyboard.type('Q');
			await editor.bridge.waitForSourceEquals('text\n\na Q b\n');
		}
	},
	{
		name: 'Mod+Z undoes the action',
		async check(editor) {
			await editor.undo();
			await editor.bridge.waitForSourceEquals(MID_LINE);
		}
	},
	{
		name: "Escape leaves the toolbar closed and the next letter in the image's line",
		async check(editor, page) {
			await page.keyboard.press('Escape');
			await expect(page.locator('.md-image-properties')).toHaveCount(0);
			await page.keyboard.type('Q');
			await editor.bridge.waitForSource((source) => /\n\na [^\n]*Q[^\n]* b\n$/.test(source));
		}
	}
];

test.describe('image toolbar buttons reached by keyboard', () => {
	for (const action of KEYBOARD_ACTIONS) {
		for (const activate of ['Enter', 'Space']) {
			for (const after of AFTER_KEYS) {
				test(`${action.label} by Shift+Tab and ${activate}: ${after.name}`, async ({ page }) => {
					const editor = new EditorPage(page);
					await editor.goto();
					await editor.loadContent(MID_LINE);
					await waitForAllImagesLoaded(page);
					await page.locator('[data-image-widget]').first().click();
					await button(page, 'Alt text').click();
					await page.keyboard.type(action.draft);
					const target = button(page, action.label);
					for (let i = 0; i < 3 && !(await isFocused(target)); i++) {
						await page.keyboard.press(focusWalkKey({ backward: true }));
					}
					await expect(target).toBeFocused();
					const before = await editor.bridge.getSource();
					await page.keyboard.press(activate);
					await action.finish?.(page);
					await editor.bridge.waitForSource((source) => source !== before);
					await after.check(editor, page);
				});
			}
		}
	}
});

function isFocused(target: Locator): Promise<boolean> {
	return target.evaluate((el) => el === document.activeElement);
}
