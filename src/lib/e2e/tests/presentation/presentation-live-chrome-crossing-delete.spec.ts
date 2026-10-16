import { test, expect } from '../../fixtures';
import { PluginsPage } from '../plugins/helpers';
import { clickWordSettled, landAt } from './helpers';

// A delete that crosses a container's frame truncates its prose endpoints in place, with no join,
// so without the cleanup the cut would leave a delimiter run on screen; with it, the bold closes.
// Requirements: e2e/requirements/presentation/presentation-live-chrome-crossing-delete.md.

const DOC = ':::callout Title\nSome **bold** text\n:::\n\nBelow\n';

test('Backspace over a selection from inside bold out of the callout closes the bold on the half that stays', async ({
	page
}) => {
	const ep = new PluginsPage(page);
	await ep.gotoPlugins();
	await ep.loadContent(DOC);
	await ep.setPresentationMode('live');

	await clickWordSettled(ep, page, 'bold');
	await landAt(ep, page, 9);

	// Two keypresses: the first extends to the body's end, the second crosses out of the callout.
	await page.keyboard.press('Shift+ArrowDown');
	await ep.waitForRenderFlush();
	await page.keyboard.press('Shift+ArrowDown');
	await expect.poll(async () => (await ep.bridge.getSelectionPaths())?.focus.path).toEqual([1]);
	await page.keyboard.press('Backspace');
	await ep.bridge.waitForSourceContains('Some **bo**\n');
	await expect(ep.editorContainer).toContainText('Some bo', { useInnerText: true });
});
