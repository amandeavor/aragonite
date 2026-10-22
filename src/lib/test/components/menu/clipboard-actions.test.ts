// @vitest-environment jsdom
// Miss-analysis: every menu Paste row ran in Chromium, which keeps `clipboardData` on a constructed paste event that Firefox empties.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runClipboardAction } from '#lib/components/menu/clipboard-actions.js';
import type { AimedInsert } from '#lib/components/editor-root/focused-surface.js';

function seedClipboard(text: string): void {
	Object.defineProperty(navigator, 'clipboard', {
		value: { readText: async () => text },
		configurable: true
	});
}

/** Records which of the block's two entries each paste reached, with the text it was handed. */
function aimed(pasted: string[]): AimedInsert {
	return {
		markdown: async (md) => (pasted.push(`markdown:${md}`), true),
		plainText: async (text) => (pasted.push(`plain:${text}`), true)
	};
}

describe('a menu Paste hands the clipboard text to the paste step', () => {
	let events: Event[];
	const record = (e: Event) => void events.push(e);

	beforeEach(() => {
		events = [];
		document.addEventListener('paste', record, true);
	});
	afterEach(() => document.removeEventListener('paste', record, true));

	it('Paste passes the text as Markdown and dispatches no paste event', async () => {
		seedClipboard('**a**\n# b');
		const pasted: string[] = [];
		await runClipboardAction('paste', aimed(pasted));
		expect(pasted).toEqual(['markdown:**a**\n# b']);
		expect(events).toEqual([]);
	});

	// The block escapes it where it reads Markdown, so the menu passes it untouched.
	it('Paste as plain text passes the text unescaped to the plain-text entry', async () => {
		seedClipboard('**a**\n# b');
		const pasted: string[] = [];
		await runClipboardAction('paste-plain', aimed(pasted));
		expect(pasted).toEqual(['plain:**a**\n# b']);
		expect(events).toEqual([]);
	});

	it('an empty clipboard pastes nothing', async () => {
		seedClipboard('');
		const pasted: string[] = [];
		await runClipboardAction('paste', aimed(pasted));
		expect(pasted).toEqual([]);
	});
});
