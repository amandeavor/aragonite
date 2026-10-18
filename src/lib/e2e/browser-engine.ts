import { type Page } from '@playwright/test';

/** Which browser is running, for the harness helpers whose path differs by engine (the clipboard,
 *  the IME driver, dropping the native caret). */
export function isWebKit(page: Page): boolean {
	return page.context().browser()?.browserType().name() === 'webkit';
}

/** Whether the page runs in Chromium, the one engine with a CDP session. */
export function isChromium(page: Page): boolean {
	return page.context().browser()?.browserType().name() === 'chromium';
}
