import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../fixtures';
import { EditorPage } from '../../editor-page';
import { clickInPlace } from '../../click-in-place';
import { openImageField, waitForFirstImageLoaded } from '../blocks/image/helpers';
import { URL_FIELD, openCardOn } from '../presentation/link-card-helpers';

// The editor cancels Backspace's page default outside a field; every field the editor owns, and
// the host's own, still deletes on it. Requirements: `requirements/text-editing/backspace-in-fields.md`.

interface Field {
	name: string;
	mode: string;
	doc: string;
	/** The field, focused the way a user reaches it. */
	reach(editor: EditorPage, page: Page): Promise<Locator>;
}

async function openFind(page: Page): Promise<Locator> {
	await page.keyboard.press('ControlOrMeta+f');
	const field = page.locator('.search-bar .search-input').first();
	await expect(field).toBeFocused();
	return field;
}

const FIELDS: Field[] = [
	{
		name: "the find bar's field",
		mode: 'source',
		doc: 'one\n',
		reach: (_, page) => openFind(page)
	},
	{
		name: "the find bar's field in reading mode",
		mode: 'reading',
		doc: 'one\n',
		reach: (_, page) => openFind(page)
	},
	{
		name: "an image's alt field",
		mode: 'source',
		doc: '![cat](/test-fixtures/sample.png)\n',
		reach: async (_, page) => {
			await waitForFirstImageLoaded(page);
			await page.locator('[data-image-widget]').first().click();
			const field = await openImageField(page);
			await clickInPlace(field);
			return field;
		}
	},
	{
		name: "the link card's URL field",
		mode: 'live',
		doc: 'a [word](https://example.com) here\n',
		reach: async (editor, page) => {
			await openCardOn(editor, page, 'word');
			const field = page.locator(URL_FIELD);
			await clickInPlace(field);
			return field;
		}
	},
	{
		name: "a code block's language field",
		mode: 'live',
		doc: '```js\nlet x;\n```\n',
		reach: async (editor, page) => {
			await editor.getBlock(0).hover();
			await page.locator('.code-lang-button').click();
			const field = page.locator('.code-lang-picker input');
			await clickInPlace(field);
			return field;
		}
	},
	{
		name: "the host's own input beside the editor",
		mode: 'reading',
		doc: 'one\n',
		reach: async (_, page) => {
			await page.evaluate(() => {
				const input = document.createElement('input');
				input.id = 'host-field';
				document.querySelector('.editor')!.insertAdjacentElement('afterend', input);
			});
			const field = page.locator('#host-field');
			await field.click();
			return field;
		}
	}
];

for (const field of FIELDS) {
	test(`${field.name}: Backspace deletes a character`, async ({ page }) => {
		const editor = new EditorPage(page);
		await editor.goto(`?presentationMode=${field.mode}`);
		await editor.loadContent(field.doc);

		const input = await field.reach(editor, page);
		await expect(input).toBeFocused();
		await page.keyboard.press('ControlOrMeta+a');
		await page.keyboard.type('abc');
		await page.keyboard.press('Backspace');

		await expect(input).toHaveValue('ab');
	});
}
