import { test, expect } from '../../fixtures';
import { EditorPage } from '../../editor-page';
import { wholeBlockInput } from '../../whole-block-input';
import { RULE_DOC, focusTheRule, rule } from './whole-block-rule';

// Requirements: `e2e/requirements/text-editing/whole-block-printable-mint.md`.

test.describe('whole-block focus: a typed character creates a paragraph below', () => {
	let editor: EditorPage;

	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		await editor.goto();
		await editor.loadContent(RULE_DOC);
	});

	test('typing `x` then `y` leaves a paragraph `xy` between the rule and the block below', async ({
		page
	}) => {
		await focusTheRule(editor);

		await page.keyboard.press('x');
		await editor.bridge.waitForSourceContains('x');
		await page.keyboard.press('y');

		await editor.bridge.waitForSourceMatches(/---\n\nxy\n\nAfter/);
	});

	test('a space creates too, and the rule itself is unchanged', async ({ page }) => {
		await focusTheRule(editor);
		const countBefore = await editor.bridge.getBlockCount();

		await page.keyboard.press('Space');

		await editor.bridge.waitForBlockCount(countBefore + 1);
		expect(await editor.bridge.getSource()).toContain('---');
	});

	test('one Mod+Z restores the source from before: the new block is a single undo entry', async ({
		page
	}) => {
		const original = await editor.bridge.getSource();
		await focusTheRule(editor);

		await page.keyboard.press('x');
		await editor.bridge.waitForSourceContains('x');

		await page.keyboard.press('ControlOrMeta+z');

		await editor.bridge.waitForSourceEquals(original);
	});

	test('Mod+C while the block is focused creates nothing', async ({ page }) => {
		const original = await editor.bridge.getSource();
		await focusTheRule(editor);

		await page.keyboard.press('ControlOrMeta+c');

		// The whole-block input proxy is the focus target here, not an editable element.
		await editor.waitForNoSourceMutation();
		expect(await editor.bridge.getSource()).toBe(original);
	});
});

test.describe('whole-block focus in reading mode', () => {
	let editor: EditorPage;

	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		await editor.goto('?presentationMode=reading');
		await editor.loadContent(RULE_DOC);
	});

	test('reading mode: a printable at whole-block focus changes no byte', async ({ page }) => {
		const original = await editor.bridge.getSource();

		await rule(editor).click();
		await expect(wholeBlockInput(rule(editor))).toBeFocused();
		await page.keyboard.press('x');

		await editor.expectSurfaceInert();
		expect(await editor.bridge.getSource()).toBe(original);
	});
});
