// @vitest-environment jsdom
// Block math's live preview beside a shown source follows the browser's own edits: a native input,
// and an IME commit whatever order its events arrive in.
// Miss-analysis: Chromium ends a commit on a composing input, and no row composed in a shown math source.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { installEditorDomStubsForTests } from '#lib/testing.js';
import { latexPlugin } from '#lib/plugins/latex/index.js';
import type { MathRenderer } from '#lib/plugins/latex/math-renderer.js';
import {
	destroyMountedEditors,
	mountEditor,
	placeCaret,
	type MountedEditor
} from '#lib/test/harness/mount-editor.svelte.js';

let rendered: string[] = [];
const renderer: MathRenderer = (source) => {
	rendered.push(source);
	return { dom: document.createElement('span') };
};

async function openSource(): Promise<{ editor: MountedEditor; el: HTMLElement }> {
	const editor = mountEditor({ source: '$$\nx\n$$\n', plugins: [latexPlugin({ renderer })] });
	await editor.settle();
	const render = editor.target.querySelector<HTMLElement>('.math-block-render')!;
	const at = { bubbles: true, cancelable: true };
	render.dispatchEvent(new PointerEvent('pointerdown', at));
	render.dispatchEvent(new MouseEvent('click', at));
	await editor.settle();
	return { editor, el: editor.target.querySelector<HTMLElement>('.math-block-source')! };
}

/** The body as an IME or a drop leaves it in the element, caret after it. */
function edit(el: HTMLElement, body: string): void {
	el.textContent = `$$\n${body}\n$$`;
	placeCaret(el, `$$\n${body}`.length);
}

const composition = (type: string) => new CompositionEvent(type, { bubbles: true });
const input = (inputType: string, isComposing = false) =>
	new InputEvent('input', { bubbles: true, inputType, isComposing });

beforeEach(() => {
	rendered = [];
	installEditorDomStubsForTests();
	// A press runs the editor root's hit test, which jsdom lacks.
	document.elementFromPoint ??= () => null;
});
afterEach(async () => {
	await destroyMountedEditors();
});

describe('block math’s preview while its source is shown', () => {
	it('draws the committed formula after an IME commit that ends on a composing input', async () => {
		const { editor, el } = await openSource();
		el.dispatchEvent(composition('compositionstart'));
		edit(el, 'xy');
		el.dispatchEvent(input('insertCompositionText', true));
		el.dispatchEvent(composition('compositionend'));
		await editor.settle();

		expect(rendered.at(-1)).toBe('xy');
	});

	it('draws the edited formula after a native input', async () => {
		const { editor, el } = await openSource();
		edit(el, 'xz');
		el.dispatchEvent(input('insertFromDrop'));
		await editor.settle();

		expect(rendered.at(-1)).toBe('xz');
	});
});
