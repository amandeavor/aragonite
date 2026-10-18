import { test, type Page } from '@playwright/test';

/** Which browser is running, for the harness helpers whose path differs by engine (the clipboard,
 *  the IME driver, dropping the native caret). */
export function isWebKit(page: Page): boolean {
	return page.context().browser()?.browserType().name() === 'webkit';
}

/** Whether the page runs in Chromium, the one engine with a CDP session. */
export function isChromium(page: Page): boolean {
	return page.context().browser()?.browserType().name() === 'chromium';
}

/** Whether the page runs in Firefox, driven over WebDriver BiDi. */
export function isFirefox(page: Page): boolean {
	return page.context().browser()?.browserType().name() === 'firefox';
}

/** What a gesture needs from the driver or the engine, for specs that must skip where it is missing. */
export type EngineCapability =
	'cdp' | 'touch' | 'mediaEmulation' | 'caretScreenshot' | 'contextMenuKey' | 'insertWithoutScroll';

/** Firefox over BiDi has no CDP session, no touch emulation, no `emulateMedia` effect, no
 *  ContextMenu key, never draws its caret into a screenshot, and scrolls to the caret on any insert. */
export function engineSupports(page: Page, capability: EngineCapability): boolean {
	return capability === 'cdp' ? isChromium(page) : !isFirefox(page);
}

const SKIP_REASONS: Record<EngineCapability, string> = {
	cdp: 'needs a CDP session, Chromium only',
	touch: 'Firefox over BiDi emulates no touch input',
	mediaEmulation: 'Firefox over BiDi applies no emulated media features',
	caretScreenshot: 'the Firefox caret never reaches a BiDi screenshot',
	contextMenuKey: 'Firefox over BiDi has no ContextMenu key',
	insertWithoutScroll: 'Firefox scrolls an off-screen caret into view on every insert, keyed or not'
};

/** Skip the running test on an engine that lacks `capability`. */
export function skipUnlessSupported(page: Page, capability: EngineCapability): void {
	test.skip(!engineSupports(page, capability), SKIP_REASONS[capability]);
}
