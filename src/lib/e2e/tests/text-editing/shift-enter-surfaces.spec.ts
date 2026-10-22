import { test } from '../../fixtures';
import type { Page } from '@playwright/test';
import { EditorPage } from '../../editor-page';

/**
 * Shift+Enter writes its surface's line break whichever input the engine sends for it, and a
 * soft keyboard's `insertLineBreak` with no keydown writes the same one
 * (`requirements/text-editing/shift-enter-surfaces.md`).
 */

interface Surface {
	name: string;
	source: string;
	path: number[];
	at: number;
	/** The source after the break and a typed `Z`. */
	broken: string;
}

const SURFACES: Surface[] = [
	{
		name: 'a paragraph',
		source: 'abcd\n',
		path: [0],
		at: 2,
		broken: 'ab\\\nZcd\n'
	},
	{
		name: 'a code block',
		source: '```\nabcd\n```\n',
		path: [0],
		at: 6,
		broken: '```\nab\nZcd\n```\n'
	},
	{
		name: 'a table cell',
		source: '| H |\n| - |\n| abcd |\n',
		path: [0, 1, 0],
		at: 2,
		broken: '| H |\n| - |\n| ab<br>Zcd |\n'
	}
];

/** A soft keyboard's beforeinput `insertLineBreak`; `withKeydown` sends a Shift+Enter keydown
 *  first in the same task, the order an engine fires them in before the handler's awaits finish. */
async function sendLineBreakInput(page: Page, withKeydown: boolean): Promise<void> {
	await page.evaluate((withKeydown) => {
		const target = document.activeElement as HTMLElement;
		if (withKeydown) {
			target.dispatchEvent(
				new KeyboardEvent('keydown', {
					key: 'Enter',
					shiftKey: true,
					bubbles: true,
					cancelable: true
				})
			);
		}
		target.dispatchEvent(
			new InputEvent('beforeinput', {
				inputType: 'insertLineBreak',
				bubbles: true,
				cancelable: true
			})
		);
	}, withKeydown);
}

for (const surface of SURFACES) {
	test.describe(`Shift+Enter in ${surface.name}`, () => {
		let editor: EditorPage;

		test.beforeEach(async ({ page }) => {
			editor = new EditorPage(page);
			await editor.goto();
			await editor.loadContent(surface.source);
			await editor.focusBlockAtPath(surface.path, surface.at);
		});

		test('the key writes one line break', async ({ page }) => {
			await page.keyboard.press('Shift+Enter');
			await editor.typeText('Z');
			await editor.bridge.waitForSourceEquals(surface.broken);
		});

		test('a soft keyboard’s line break with no keydown writes the same one', async ({ page }) => {
			await sendLineBreakInput(page, false);
			await editor.typeText('Z');
			await editor.bridge.waitForSourceEquals(surface.broken);
		});

		test('a line-break input during the key’s own keydown writes nothing more', async ({
			page
		}) => {
			await sendLineBreakInput(page, true);
			await editor.typeText('Z');
			await editor.bridge.waitForSourceEquals(surface.broken);
		});
	});
}
