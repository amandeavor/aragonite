/**
 * The e2e handle on the editor's typing batches, `window.__typingBatches`: every navigation
 * holds them (`src/lib/e2e/goto-ready.ts`), so a spec decides where undo steps split instead of
 * the page's 250 ms timer. Installed only where dev checks run, so a production build has none.
 */

import { isDevChecks } from '#lib/env.js';
import {
	endTypingBatchesForTests,
	holdTypingPausesForTests,
	openTypingBatchCountForTests
} from '#lib/editor-actions/commit/text-batch.js';
import type { TypingBatchHandle } from '#lib/e2e/typing-batch.js';

export function installTypingBatchHandle(): void {
	if (typeof window === 'undefined' || !isDevChecks()) return;
	const handle: TypingBatchHandle = {
		hold: () => holdTypingPausesForTests(true),
		end: endTypingBatchesForTests,
		release: () => void holdTypingPausesForTests(false),
		openCount: openTypingBatchCountForTests
	};
	(window as unknown as { __typingBatches: TypingBatchHandle }).__typingBatches = handle;
}
