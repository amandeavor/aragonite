import { APPS, type AppName } from '../apps';
import { test, expect, caretAtEnd, FIRST, SECOND } from './fixtures';
import type { Page } from '@playwright/test';

const PARAGRAPH = 'Hello from the first note.';
const typedFirst = (typed: string) => FIRST.replace(PARAGRAPH, PARAGRAPH + typed);

async function expectMirror(page: Page, text: string): Promise<void> {
	await expect.poll(() => page.getByTestId('mirror').textContent()).toBe(text);
}

async function undo(page: Page, inBlock: string): Promise<void> {
	await caretAtEnd(page, inBlock);
	await page.keyboard.press('ControlOrMeta+z');
}

test.beforeEach(async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('.editor')).toBeVisible();
});

test('typing in the editor reaches the mirror', async ({ page }) => {
	await caretAtEnd(page, PARAGRAPH);
	await page.keyboard.type(' More.');

	await expectMirror(page, typedFirst(' More.'));
});

test('typing at full speed keeps every key, in order', async ({ page }) => {
	const sentence = ' The quick brown fox jumps over the lazy dog, twice over.';
	await caretAtEnd(page, PARAGRAPH);
	await page.keyboard.type(sentence, { delay: 0 });

	await expectMirror(page, typedFirst(sentence));
	await expect(page.locator('.editor')).toContainText(PARAGRAPH + sentence);
});

test('load after typing shows the second note, and undo changes nothing', async ({ page }) => {
	await caretAtEnd(page, PARAGRAPH);
	await page.keyboard.type(' Draft.');
	await page.getByTestId('load').click();

	await expect(page.locator('.editor')).toContainText('A different document.');
	await expectMirror(page, SECOND);
	await undo(page, 'A different document.');
	await expect(page.locator('.editor')).toContainText('A different document.');
	await expectMirror(page, SECOND);
});

test('revert after typing restores the loaded note', async ({ page }) => {
	await caretAtEnd(page, PARAGRAPH);
	await page.keyboard.type(' Draft.');
	await expectMirror(page, typedFirst(' Draft.'));
	await page.getByTestId('revert').click();

	await expectMirror(page, FIRST);
	await expect(page.locator('.editor')).not.toContainText('Draft.');
});

test('the theme flips live, and undo still takes back earlier typing', async ({ page }) => {
	const root = page.locator('.editor');
	await expect(root).toHaveAttribute('data-editor-theme', 'light');
	await caretAtEnd(page, PARAGRAPH);
	await page.keyboard.type(' Draft.');
	await page.getByTestId('theme').click();

	await expect(root).toHaveAttribute('data-editor-theme', 'dark');
	await undo(page, PARAGRAPH);
	await expectMirror(page, FIRST);
});

test('a prop the app stops passing goes back to its default', async ({ page }) => {
	const root = page.locator('.editor');
	await expect(root).toHaveAttribute('data-editor-theme', 'light');
	await page.getByTestId('drop-theme').click();

	await expect(root).toHaveAttribute('data-editor-theme', 'dark');
	await page.getByTestId('drop-theme').click();
	await expect(root).toHaveAttribute('data-editor-theme', 'light');
});

test('the header input keeps its keys, and the document stays put', async ({ page }) => {
	const input = page.getByTestId('header-input');
	await input.click();
	await page.keyboard.type('Title');
	await page.keyboard.press('Backspace');

	await expect(input).toHaveValue('Titl');
	await expectMirror(page, FIRST);
	await expect(page.locator('.editor')).toContainText(PARAGRAPH);
});

test('unmount leaves no editor behind, and mounting again shows the held value', async ({
	page
}) => {
	await caretAtEnd(page, PARAGRAPH);
	await page.keyboard.type(' Kept.');
	await page.getByTestId('unmount').click();

	await expect(page.locator('.editor')).toHaveCount(0);
	await expect(page.getByTestId('header-input')).toHaveCount(0);
	await page.getByTestId('unmount').click();
	await expect(page.locator('.editor')).toContainText(PARAGRAPH + ' Kept.');
});

test('one editor and one header on the page', async ({ page }) => {
	await expect(page.locator('.editor')).toHaveCount(1);
	await expect(page.getByTestId('header-input')).toHaveCount(1);
});

test('uncontrolled, the editor starts on its default and keeps typing across a re-render', async ({
	page
}) => {
	await page.goto('/?uncontrolled');
	await caretAtEnd(page, PARAGRAPH);
	await page.keyboard.type(' Mine.');
	await expectMirror(page, typedFirst(' Mine.'));
	await page.getByTestId('theme').click();

	await expect(page.locator('.editor')).toHaveAttribute('data-editor-theme', 'dark');
	await expect(page.locator('.editor')).toContainText(PARAGRAPH + ' Mine.');
});

test('the page runs on the React major its project names', async ({ page }, testInfo) => {
	const app = APPS[testInfo.project.name as AppName];
	await expect(page.getByTestId('react-version')).toHaveText(new RegExp(`^${app.reactMajor}\\.`));
});
