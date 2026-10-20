/**
 * Where undo steps split in an e2e spec. Every navigation holds the page's typing batches, so
 * keys typed at any speed stay one undo step until the spec calls `endTypingBatch`; no fixed wait
 * decides it (G4.232). The page side is `src/routes/typing-batches.ts`.
 */

import type { Page } from '@playwright/test';

/** The page's handle, `window.__typingBatches`. */
export interface TypingBatchHandle {
	/** Typing batches stop ending on a pause; returns whether the hold took. */
	hold(): boolean;
	/** End every open batch now, the way a pause would. */
	end(): void;
	/** Back to the real pause, ending whatever the hold kept open. */
	release(): void;
	openCount(): number;
}

type HandleWindow = { __typingBatches?: TypingBatchHandle };

// The production preview the perf rows run against carries no handle, and its rows never undo.
const PRODUCTION_PREVIEW = !!process.env.PERF_PROD;

/** Called by every navigation once the route is ready, before the spec acts. */
export async function holdTypingBatches(page: Page): Promise<void> {
	const held = await page.evaluate(() => (window as HandleWindow).__typingBatches?.hold() ?? null);
	if (held || PRODUCTION_PREVIEW) return;
	throw new Error(
		held === null
			? `${page.url()}: no window.__typingBatches, so undo steps would split on wall time`
			: `${page.url()}: the typing-batch hold was refused outside dev checks`
	);
}

/** End the typing batch open now, so the next key starts its own undo step. */
export async function endTypingBatch(page: Page): Promise<void> {
	await page.evaluate(() => (window as HandleWindow).__typingBatches!.end());
}

/** Back to the editor's real 250 ms pause, for the one row that tests the pause itself. */
export async function releaseTypingPause(page: Page): Promise<void> {
	await page.evaluate(() => (window as HandleWindow).__typingBatches!.release());
}

export function openTypingBatchCount(page: Page): Promise<number> {
	return page.evaluate(() => (window as HandleWindow).__typingBatches!.openCount());
}
