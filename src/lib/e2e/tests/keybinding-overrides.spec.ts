import type { Page } from '@playwright/test';
import { test, expect } from '../fixtures';
import { EditorPage } from '../editor-page';
import { nextRow } from './presentation/helpers';
import type { KeybindingOverride } from '../../schema/keybinding-overrides';
import { edgeKey, WORD_MODIFIER } from '../platform-keys';
import { addReplaceIsland } from '../decoration-sources';

async function setKeybindings(editor: EditorPage, overrides: KeybindingOverride[] | undefined) {
	await editor.page.evaluate((ov) => (window as any).__test.setKeybindings(ov), overrides);
}

test.describe('keybinding-override prop', () => {
	let editor: EditorPage;

	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		await editor.goto();
	});

	test('rebind: Mod+Y mapped to undo undoes the last edit', async () => {
		await editor.loadContent('hello\n');
		await setKeybindings(editor, [{ chord: 'Mod+Y', command: 'history.undo' }]);
		await editor.page.locator('.text-editable-block').first().click();
		await editor.page.keyboard.press(edgeKey('lineEnd'));
		await editor.page.keyboard.type(' world');
		await expect.poll(() => editor.bridge.getSource()).toContain('hello world');
		await editor.page.keyboard.press('ControlOrMeta+y');
		await expect.poll(() => editor.bridge.getSource()).not.toContain('world');
	});

	test('disable: Mod+Z no longer undoes; clearing the prop restores it', async () => {
		await editor.loadContent('hello\n');
		await setKeybindings(editor, [{ chord: 'Mod+Z', command: null }]);
		await editor.page.locator('.text-editable-block').first().click();
		await editor.page.keyboard.press(edgeKey('lineEnd'));
		await editor.page.keyboard.type('X');
		await editor.page.keyboard.press('ControlOrMeta+z');
		await expect.poll(() => editor.bridge.getSource()).toContain('helloX');

		// Clearing the prop brings the built-in undo back, so overrides never changed the keymap.
		await setKeybindings(editor, undefined);
		await editor.page.keyboard.press('ControlOrMeta+z');
		await expect.poll(() => editor.bridge.getSource()).not.toContain('helloX');
	});

	// An override scoped to one block kind, resolved by `resolveBinding`. Mod+Alt+Y has no
	// binding of its own, so it fires only where the heading's override exists.
	test('per-kind scope: a heading override does not fire in a paragraph', async () => {
		await editor.loadContent('# title\n\npara\n');
		await setKeybindings(editor, [
			{ chord: 'Mod+Alt+Y', command: 'history.undo', kind: 'heading' }
		]);

		const heading = editor.page.locator('.text-editable-block', { hasText: 'title' });
		await heading.click();
		await editor.page.keyboard.press(edgeKey('lineEnd'));
		await editor.page.keyboard.type('Z');
		await expect.poll(() => editor.bridge.getSource()).toContain('titleZ');
		await editor.page.keyboard.press('ControlOrMeta+Alt+y');
		await expect.poll(() => editor.bridge.getSource()).not.toContain('titleZ');

		const para = editor.page.locator('.text-editable-block', { hasText: 'para' });
		await para.click();
		await editor.page.keyboard.press(edgeKey('lineEnd'));
		await editor.page.keyboard.type('Z');
		await expect.poll(() => editor.bridge.getSource()).toContain('paraZ');
		await editor.page.keyboard.press('ControlOrMeta+Alt+y'); // unbound here, so no undo
		await editor.bridge.waitForSourceContains('paraZ');
		expect(await editor.bridge.getSource()).toContain('paraZ');
	});
});

// A caret in a gap focuses a hidden host, so the root handler declines and the host resolves the
// binding itself; with no block or kind to fall back on, nothing else can run the rebound command.
test.describe('override fires where no block holds focus', () => {
	test('Mod+Alt+U undo fires at the gap caret between two blocks', async ({ page }) => {
		const editor = new EditorPage(page);
		await editor.goto();
		await editor.loadContent('| a | b |\n| - | - |\n| c | d |\n\n```\ncode\n```\n');
		await setKeybindings(editor, [{ chord: 'Mod+Alt+U', command: 'history.undo' }]);

		await editor.page.locator('.table-cell').nth(3).click();
		await editor.page.keyboard.press(edgeKey('lineEnd'));
		await editor.page.keyboard.type('Z');
		await expect.poll(() => editor.bridge.getSource()).toContain('dZ');

		await editor.page.keyboard.press('ArrowDown');
		await editor.bridge.waitForGapCaret({ parentPath: [], index: 1 });

		await editor.page.keyboard.press('ControlOrMeta+Alt+u');
		await expect.poll(() => editor.bridge.getSource()).not.toContain('dZ');
	});
});

// Mod+Alt+U has no built-in binding, so undo fires only through this editor's override. Drives
// every editable block through its own dispatchKeyCommand call.
test.describe('override fires on every leaf dispatch surface', () => {
	const surfaces = [
		{ name: 'paragraph', content: 'para\n', focus: '.text-editable-block' },
		{ name: 'code', content: '```\ncode\n```\n', focus: '.code-block' },
		{
			name: 'table',
			content: '| a | b |\n| - | - |\n| c | d |\n',
			focus: '.table-block [contenteditable]'
		}
	];
	test('Mod+Alt+U undo fires in a paragraph, a code block and a table cell', async ({ page }) => {
		const editor = new EditorPage(page);
		await editor.goto();
		await setKeybindings(editor, [{ chord: 'Mod+Alt+U', command: 'history.undo' }]);
		for (const [i, s] of surfaces.entries()) {
			await test.step(s.name, async () => {
				if (i === 0) await editor.loadContent(s.content);
				else await nextRow(editor, s.content);
				await editor.page.locator(s.focus).first().click();
				await editor.page.keyboard.press(edgeKey('lineEnd'));
				await editor.page.keyboard.type('Z');
				await expect.poll(() => editor.bridge.getSource()).toContain('Z');
				await editor.page.keyboard.press('ControlOrMeta+Alt+u');
				await expect.poll(() => editor.bridge.getSource()).not.toContain('Z');
			});
		}
	});
});

/** A soft keyboard's Backspace: the `beforeinput` alone, with no keydown. */
async function sendKeylessBackspace(editor: EditorPage): Promise<void> {
	await editor.page.evaluate(() => {
		const init = { inputType: 'deleteContentBackward', bubbles: true, cancelable: true };
		document.activeElement!.dispatchEvent(new InputEvent('beforeinput', init));
	});
}

// Every delete at a block's edge runs what plain Backspace binds, so it follows a host's binding.
test.describe("a delete at a block's start follows the Backspace binding", () => {
	let editor: EditorPage;

	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		await editor.goto();
	});

	const routes = [
		{
			name: 'the word chord',
			send: () => editor.page.keyboard.press(`${WORD_MODIFIER}+Backspace`)
		},
		{ name: 'Shift+Backspace', send: () => editor.page.keyboard.press('Shift+Backspace') },
		{ name: 'a soft keyboard', send: () => sendKeylessBackspace(editor) }
	];
	const disables: [string, KeybindingOverride][] = [
		['everywhere', { chord: 'Backspace', command: null }],
		['on paragraphs', { chord: 'Backspace', command: null, kind: 'paragraph' }]
	];

	for (const [scope, override] of disables) {
		for (const route of routes) {
			test(`Backspace disabled ${scope}: ${route.name} joins nothing`, async () => {
				await editor.loadContent('abc\n\nnext\n');
				await setKeybindings(editor, [override]);
				await editor.focusBlockAtPath([1], 0);
				await route.send();
				await editor.page.keyboard.type('x');
				await editor.bridge.waitForSourceEquals('abc\n\nxnext\n');
			});
		}
	}

	for (const route of routes) {
		test(`Backspace rebound to a heading: ${route.name} makes one`, async () => {
			await editor.loadContent('abc\n\nnext\n');
			await setKeybindings(editor, [{ chord: 'Backspace', command: 'heading.cycle', arg: 1 }]);
			await editor.focusBlockAtPath([1], 0);
			await route.send();
			await editor.bridge.waitForSourceEquals('abc\n\n# next\n');
		});
	}
});

const IMAGE = '![x](/test-fixtures/sample.png)';

// A delete chord's own answers wait for the keymap, so a binding on the chord itself wins over them.
test.describe('a binding on a delete chord wins over what the chord would take', () => {
	const places = [
		{ name: 'beside an image', line: `${IMAGE} bb`, at: 31 },
		{
			name: 'beside a replace decoration',
			line: 'bbHIDDEN',
			at: 8,
			decorate: (page: Page) => addReplaceIsland(page, [1], 2, 8)
		},
		{ name: "at a paragraph's start", line: 'bb', at: 0 }
	];
	for (const chord of ['Shift+Backspace', 'Alt+Backspace']) {
		for (const place of places) {
			test(`${chord} ${place.name}`, async ({ page }) => {
				const editor = new EditorPage(page);
				await editor.goto();
				await place.decorate?.(page);
				await editor.loadContent(`aa\n\n${place.line}\n`);
				await setKeybindings(editor, [{ chord, command: 'heading.cycle', arg: 1 }]);
				await editor.focusBlockAtPath([1], place.at);
				await page.keyboard.press(chord);
				await editor.bridge.waitForSourceEquals(`aa\n\n# ${place.line}\n`);
				await editor.waitForRenderFlush();
				expect(await page.locator('[data-image-overlay], .md-widget-selected').count()).toBe(0);
				expect(await page.evaluate(() => window.getSelection()?.isCollapsed)).toBe(true);
			});
		}
	}
});
