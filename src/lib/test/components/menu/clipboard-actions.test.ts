// @vitest-environment jsdom
// Miss-analysis: every menu Paste row ran in Chromium, which keeps `clipboardData` on a constructed paste event that Firefox empties.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runClipboardAction } from '#lib/components/menu/clipboard-actions.js';

function seedClipboard(text: string): void {
	Object.defineProperty(navigator, 'clipboard', {
		value: { readText: async () => text },
		configurable: true
	});
}

describe('a menu Paste hands the clipboard text to the paste step', () => {
	let events: Event[];
	const record = (e: Event) => void events.push(e);

	beforeEach(() => {
		events = [];
		document.addEventListener('paste', record, true);
	});
	afterEach(() => document.removeEventListener('paste', record, true));

	it('Paste passes the text as is and dispatches no paste event', async () => {
		seedClipboard('**a**\n# b');
		const pasted: string[] = [];
		await runClipboardAction('paste', async (text) => void pasted.push(text));
		expect(pasted).toEqual(['**a**\n# b']);
		expect(events).toEqual([]);
	});

	it('Paste as plain text passes the text with its Markdown escaped', async () => {
		seedClipboard('**a**\n# b\n1. c');
		const pasted: string[] = [];
		await runClipboardAction('paste-plain', async (text) => void pasted.push(text));
		expect(pasted).toEqual(['\\*\\*a\\*\\*\n\\# b\n1\\. c']);
		expect(events).toEqual([]);
	});

	it('an empty clipboard pastes nothing', async () => {
		seedClipboard('');
		const pasted: string[] = [];
		await runClipboardAction('paste', async (text) => void pasted.push(text));
		expect(pasted).toEqual([]);
	});
});
