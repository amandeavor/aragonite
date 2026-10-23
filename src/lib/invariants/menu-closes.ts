/**
 * G1.121: a menu asked to close is gone a tick later. The editor's menus close through their own
 * callbacks, so one that ignores a cause would stay on screen after the editor closed it.
 */

import { type InvariantViolation } from '@voithos-labs/aragonite/dev-checks';

export function checkMenuClosed(stillMounted: boolean, cause: string): InvariantViolation | null {
	if (!stillMounted) return null;
	return {
		code: 'menu-stayed-open',
		message: `a menu asked to close (${cause}) is still mounted a tick later: its close callback ignored the cause`,
		detail: { cause }
	};
}
