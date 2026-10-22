// The showcase's switches live in its settings popover, so a spec opens the popover before it
// reaches one. Opening is idempotent: a popover already open stays open.
import { expect, type Locator, type Page } from '@playwright/test';
import { clickInPlace } from './click-in-place';

export async function openShowcaseSettings(page: Page): Promise<void> {
	const trigger = page.getByTestId('showcase-settings');
	if ((await trigger.getAttribute('aria-expanded')) !== 'true') await clickInPlace(trigger);
	await expect(trigger).toHaveAttribute('aria-expanded', 'true');
}

/** The settings row with `testId`, its popover open. */
export async function showcaseSetting(page: Page, testId: string): Promise<Locator> {
	await openShowcaseSettings(page);
	return page.getByTestId(testId);
}

export async function clickShowcaseSetting(page: Page, testId: string): Promise<void> {
	await clickInPlace(await showcaseSetting(page, testId));
}
