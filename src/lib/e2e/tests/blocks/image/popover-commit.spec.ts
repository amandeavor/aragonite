import { test, expect } from '../../../fixtures';
import { EditorPage } from '../../../editor-page';
import { openImageField, undoDepth, waitForAllImagesLoaded } from './helpers';
import { edgeKey } from '../../../platform-keys';

test.describe('image popover commit', () => {
	let editor: EditorPage;

	test.beforeEach(async ({ page }) => {
		editor = new EditorPage(page);
		await editor.goto();
	});

	test('popover appears on selection and disappears on deselect', async ({ page }) => {
		await editor.loadContent('text\n\n![cat](/test-fixtures/sample.png)\n');
		const widget = page.locator('[data-image-widget]').first();
		await widget.click();
		await expect(page.locator('.md-image-properties')).toBeVisible();
		await page.locator('.paragraph-block').first().click();
		await expect(page.locator('.md-image-properties')).not.toBeVisible();
	});

	test('alt edit commits into source on blur', async ({ page }) => {
		// Lead with a non-image paragraph so the click-outside target is genuinely outside the
		// widget: clicking the image's own paragraph lands on the widget and (correctly) keeps the
		// popover open.
		await editor.loadContent('outside paragraph.\n\n![cat](/test-fixtures/sample.png)\n');
		const widget = page.locator('[data-image-widget]').first();
		await widget.click();
		const altInput = await openImageField(page);
		await altInput.fill('cat v2');
		await page.locator('.paragraph-block').first().click();
		await editor.bridge.waitForSourceContains('![cat v2](/test-fixtures/sample.png)');
	});

	test('popover commits an alt change for an image inside a list item', async ({ page }) => {
		await editor.loadContent('outside paragraph.\n\n- ![cat](/test-fixtures/sample.png)\n');
		const widget = page.locator('[data-image-widget]').first();
		await widget.click();
		const altInput = await openImageField(page);
		await altInput.fill('nested cat');
		await page.locator('.paragraph-block').first().click();
		await editor.bridge.waitForSourceContains('- ![nested cat](/test-fixtures/sample.png)');
	});

	// The URL has no field: retargeting an image is a source-mode edit.
	test('the toolbar offers no URL field', async ({ page }) => {
		await editor.loadContent('![cat](/test-fixtures/sample.png)\n');
		await page.locator('[data-image-widget]').first().click();
		const toolbar = page.locator('.md-image-properties');
		await expect(toolbar.getByRole('button')).toHaveCount(3);
		await expect(toolbar.getByRole('button', { name: 'Image URL' })).toHaveCount(0);
	});

	// An open field holds a copy of bytes the document can move past, and committing on dismiss
	// would put them back over the change.
	test('an undo taken while the popover is open closes it, and nothing stale is committed', async ({
		page
	}) => {
		const SOURCE = 'outside paragraph.\n\n![cat](/test-fixtures/sample.png)\n';
		await editor.loadContent(SOURCE);
		const widget = page.locator('[data-image-widget]').first();

		await widget.click();
		let altInput = await openImageField(page);
		await altInput.fill('cat v1');
		await page.locator('.paragraph-block').first().click();
		await editor.bridge.waitForSourceContains('![cat v1]');

		await widget.click();
		altInput = await openImageField(page);
		await expect(altInput).toHaveValue('cat v1');
		// Escape closes the field without a commit, so the undo chord reaches the editor rather
		// than the input's own history.
		await page.keyboard.press('Escape');
		await editor.undo();
		await editor.bridge.waitForSourceNotContains('cat v1');
		// The undo's caret ends the image, and the popover closing with it must not commit the
		// draft it held back over the undo.
		await expect(page.locator('.md-image-properties')).toHaveCount(0);
		await editor.waitForNoSourceMutation();
		expect(await editor.bridge.getSource()).toBe(SOURCE);
		await widget.click();
		altInput = await openImageField(page);
		await expect(altInput).toHaveValue('cat');
		await page.keyboard.press('Escape');

		await page.locator('.paragraph-block').first().click();
		// A click away from the popover, not a keystroke.
		await editor.waitForNoSourceMutation();
		expect(await editor.bridge.getSource()).not.toContain('cat v1');
	});

	// Reusing the popover across selection changes commits image 1's own state (`url`, `alt`, the
	// captured `initialBytes`) against image 2 and overwrites its source bytes.
	test('popover commit targets the image it opened on, not the live selection', async ({
		page
	}) => {
		await editor.loadContent(
			'![alt1|400](/test-fixtures/sample.png) ![alt2|600](/test-fixtures/sample.png)\n\nbelow.\n'
		);
		await waitForAllImagesLoaded(page);
		const widgets = page.locator('[data-image-widget]');
		const w1Box = await widgets.nth(0).boundingBox();
		const w2Box = await widgets.nth(1).boundingBox();
		if (!w1Box || !w2Box) throw new Error('widget boxes missing');
		await page.mouse.click(w1Box.x + w1Box.width / 2, w1Box.y + w1Box.height / 2);
		await (await openImageField(page)).fill('EDITED');
		// Switching to image 2 unmounts image 1's popover, which commits to image 1.
		await page.mouse.click(w2Box.x + w2Box.width / 2, w2Box.y + w2Box.height / 2);
		await page.locator('[contenteditable="true"]').last().click();
		await editor.bridge.waitForSourceContains('EDITED');
		const src = await editor.bridge.getSource();
		expect(src).toContain('![EDITED|400](/test-fixtures/sample.png)');
		expect(src).toContain('![alt2|600](/test-fixtures/sample.png)');
	});

	test('rapid switching between two image popovers without typing leaves both untouched', async ({
		page
	}) => {
		await editor.loadContent(
			'![alt1|400](/test-fixtures/sample.png) ![alt2|600](/test-fixtures/sample.png)\n\nbelow.\n'
		);
		await waitForAllImagesLoaded(page);
		const widgets = page.locator('[data-image-widget]');
		const w1Box = await widgets.nth(0).boundingBox();
		const w2Box = await widgets.nth(1).boundingBox();
		if (!w1Box || !w2Box) throw new Error('widget boxes missing');
		const initialSrc = await editor.bridge.getSource();
		for (let i = 0; i < 20; i++) {
			const target = i % 2 === 0 ? w1Box : w2Box;
			await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2);
		}
		await page.locator('[contenteditable="true"]').last().click();
		expect(await editor.bridge.getSource()).toBe(initialSrc);
	});

	test('the alt field commits into the hint-free alt on Enter', async ({ page }) => {
		await editor.loadContent('outside paragraph.\n\n![|300](/test-fixtures/sample.png)\n');
		await page.locator('[data-image-widget]').first().click();
		const altInput = await openImageField(page, 'Alt text');
		await expect(altInput).toHaveAttribute('placeholder', 'Describe the image');
		await altInput.fill('a cat');
		await page.keyboard.press('Enter');
		await editor.bridge.waitForSourceContains('![a cat|300](/test-fixtures/sample.png)');
		// Enter closes the field; the toolbar stays.
		await expect(page.locator('.md-image-properties input')).toHaveCount(0);
		await expect(page.locator('.md-image-properties')).toBeVisible();
	});

	test('the remove button deletes the image span', async ({ page }) => {
		await editor.loadContent('before ![cat](/test-fixtures/sample.png) after\n');
		await page.locator('[data-image-widget]').first().click();
		await page
			.locator('.md-image-properties')
			.getByRole('button', { name: 'Remove image' })
			.click();
		await editor.bridge.waitForSourceEquals('before  after\n');
		await expect(page.locator('[data-image-widget]')).toHaveCount(0);
	});

	for (const [where, source, left] of [
		['a link', 'x [![b](/test-fixtures/sample.png)](https://example.com) y\n', 'x  y\n'],
		['a bold run', 'a **![b](/test-fixtures/sample.png)** c\n', 'a  c\n']
	]) {
		test(`in live mode, removing the only content of ${where} takes its markers too`, async ({
			page
		}) => {
			await editor.loadContent(source);
			await editor.setPresentationMode('live');
			await page.locator('[data-image-widget]').first().click();
			await page
				.locator('.md-image-properties')
				.getByRole('button', { name: 'Remove image' })
				.click();
			await editor.bridge.waitForSourceEquals(left);
		});
	}

	// A replace from the find bar rewrites the image's bytes while the toolbar stays up, and an edit
	// in the alt field builds on the alt the document holds now.
	test('a replace from the find bar reseeds the open toolbar', async ({ page }) => {
		await editor.loadContent('![cat](/test-fixtures/sample.png)\n\nafter\n');
		const toolbar = page.locator('.md-image-properties');
		await page.locator('[data-image-widget]').first().click();
		await expect(toolbar).toBeVisible();

		// Keys only: a press anywhere in the bar is a press off the image, which ends it.
		await page.keyboard.press('ControlOrMeta+h');
		await page.keyboard.type('cat');
		const replace = page.getByRole('textbox', { name: 'Replace' });
		for (
			let i = 0;
			i < 8 && !(await replace.evaluate((el) => el === document.activeElement));
			i++
		) {
			await page.keyboard.press('Tab');
		}
		await expect(replace).toBeFocused();
		await page.keyboard.type('dog');
		await page.keyboard.press('Enter');
		await editor.bridge.waitForSourceContains('![dog]');
		await page.keyboard.press('Escape');
		await expect(toolbar).toBeVisible();

		const alt = await openImageField(page);
		await expect(alt).toHaveValue('dog');
		await alt.press(edgeKey('lineEnd'));
		await page.keyboard.type('!');
		await page.keyboard.press('Enter');
		await editor.bridge.waitForSourceContains('![dog!]');
	});

	test('no-op blur does not add undo entry', async ({ page }) => {
		await editor.loadContent('![cat](/test-fixtures/sample.png)\n');
		const widget = page.locator('[data-image-widget]').first();
		await widget.click();
		const undoLengthBefore = await undoDepth(page);
		await page.locator('.paragraph-block').first().click();
		expect(await undoDepth(page)).toBe(undoLengthBefore);
	});

	// Each way a crop ends, by key or by press. WebKit leaves a pressed button's focus on the
	// toolbar; no typing backs the editor's undo with the browser's own.
	const LOADED = 'text\n\n![cat|200x200](/test-fixtures/sample.png)\n';
	for (const [finish, writes] of [
		['the crop applied by Enter', true],
		['the crop applied by its tick', true],
		['the crop cancelled by Escape', false],
		['the crop cancelled by its cross', false]
	] as const) {
		test(`after ${finish}, Mod+Z undoes the last edit`, async ({ page }) => {
			await editor.loadContent(LOADED);
			await waitForAllImagesLoaded(page);
			const widget = page.locator('[data-image-widget]').first();
			const toolbar = page.locator('.md-image-properties');
			const button = (name: string) => toolbar.getByRole('button', { name, exact: true });
			const crop = page.locator('.md-image-crop-surface');
			await widget.click();
			if (!writes) {
				// A crop first, so the undo has an entry the finish itself doesn't write.
				await button('Crop image').click();
				await page.keyboard.press('Enter');
				await editor.bridge.waitForSourceMatches(/@50,50\]/);
				await widget.click();
			}
			await button('Crop image').click();
			await expect(crop).toBeVisible();
			if (finish.endsWith('Enter')) await page.keyboard.press('Enter');
			if (finish.endsWith('tick')) await button('Apply crop').click();
			if (finish.endsWith('Escape')) await page.keyboard.press('Escape');
			if (finish.endsWith('cross')) await button('Cancel crop').click();
			await expect(crop).toHaveCount(0);
			if (writes) await editor.bridge.waitForSourceMatches(/@50,50\]/);
			else await editor.waitForNoSourceMutation();
			await editor.undo();
			await editor.bridge.waitForSourceEquals(LOADED);
		});
	}

	// A host shortcut switches the mode with no press, so nothing clicks away from the field first.
	for (const [from, to] of [
		['source', 'live'],
		['live', 'source']
	] as const) {
		test(`a switch from ${from} to ${to} closes the alt field and saves its draft`, async ({
			page
		}) => {
			await editor.goto(`?presentationMode=${from}`);
			await editor.loadContent('![cat](/test-fixtures/sample.png)\n\nbelow.\n');
			await page.locator('[data-image-widget]').first().click();
			await (await openImageField(page)).fill('cat v2');

			await editor.setPresentationMode(to);

			await expect(page.locator('.md-image-properties input')).toHaveCount(0);
			await editor.bridge.waitForSourceEquals('![cat v2](/test-fixtures/sample.png)\n\nbelow.\n');
			// The caret the switch carried lands back on the image's paragraph.
			await expect
				.poll(async () => (await editor.bridge.getSelectionPaths())?.focus.path)
				.toEqual([0]);
		});
	}
});
