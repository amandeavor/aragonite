/**
 * Reads for reading-mode keyboard specs: host buttons around the editor for a focus walk to leave
 * to, what holds focus, and whether the browser keeps a caret in the editor.
 */
import type { Page } from '@playwright/test';

/** Buttons the host puts before and after the editor, where a walk out of it lands. */
export async function addHostButtons(page: Page): Promise<void> {
	await page.evaluate(() => {
		const editor = document.querySelector('.editor')!;
		for (const [id, where] of [
			['host-before', 'beforebegin'],
			['host-after', 'afterend']
		] as const) {
			const button = document.createElement('button');
			button.id = id;
			button.textContent = id;
			editor.insertAdjacentElement(where, button);
		}
	});
}

/** The focused element, named by what it is and the block it sits in. */
export function focusName(page: Page): Promise<string> {
	return page.evaluate(() => {
		const active = document.activeElement as HTMLElement | null;
		if (!active || active === document.body) return 'body';
		if (active.id.startsWith('host-')) return active.id;
		const path = active.closest('[data-block-path]')?.getAttribute('data-block-path') ?? '?';
		return `${active.tagName.toLowerCase()}.${active.classList[0] ?? ''} ${path} "${active.textContent?.trim().slice(0, 12)}"`;
	});
}

/** Whether the browser holds a collapsed caret anywhere in the editor. */
export function holdsCaret(page: Page): Promise<boolean> {
	return page.evaluate(() => {
		const sel = getSelection();
		const editor = document.querySelector('.editor');
		return !!sel && sel.rangeCount > 0 && sel.isCollapsed && !!editor?.contains(sel.anchorNode);
	});
}
