import { test, expect } from '../../fixtures';
import { EditorPage } from '../../editor-page';
import { edgeKey } from '../../platform-keys';

// Deleting the rule between a paragraph and indented code leaves a blank line in its place, so the
// code stays a code block with every line it held.
// Requirements: `e2e/requirements/text-editing/delete-rule-above-code.md`.

for (const [label, whitespace] of [
	['two whitespace lines (#450)', '    \n    \n'],
	['three whitespace lines (#451)', '    \n    \n    \n']
] as const) {
	test(`Delete twice at the paragraph's end removes the rule and keeps the code: ${label}`, async ({
		page
	}) => {
		const editor = new EditorPage(page);
		await editor.goto();
		const tail = `    code\n${whitespace}\n\`\`\`\n\`\`\`\n`;
		await editor.loadContent(`para\n***\n${tail}`);
		await editor.clickBlock(0);
		await page.keyboard.press(edgeKey('lineEnd'));

		await page.keyboard.press('Delete');
		await page.keyboard.press('Delete');

		await expect.poll(() => editor.bridge.getSource()).toBe(`para\n\n${tail}`);
		expect(await editor.bridge.getBlockKind(1)).toBe('indentedCode');
		expect(await editor.parseConverged()).toBe(true);
	});
}
