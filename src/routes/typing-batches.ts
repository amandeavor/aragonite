/**
 * The e2e handle on the editor's typing batches, `window.__typingBatches`: every navigation
 * holds them (`src/lib/e2e/goto-ready.ts`), so a spec decides where undo steps split instead of
 * the page's 250 ms timer. Installed only where dev checks run, so a production build has none.
 */

import { devChecksOn } from '@voithos-labs/aragonite/dev-checks';
import {
	endTypingBatchesForTests,
	holdTypingPausesForTests,
	openTypingBatchCountForTests,
	releaseTypingPausesForTests
} from '#lib/editor-actions/commit/text-batch.js';
import type { TypingBatchHandle } from '#lib/e2e/typing-batch.js';

export function installTypingBatchHandle(): void {
	if (typeof window === 'undefined' || !devChecksOn) return;
	const handle: TypingBatchHandle = {
		hold: holdTypingPausesForTests,
		end: endTypingBatchesForTests,
		release: releaseTypingPausesForTests,
		openCount: openTypingBatchCountForTests
	};
	(window as unknown as { __typingBatches: TypingBatchHandle }).__typingBatches = handle;
}
