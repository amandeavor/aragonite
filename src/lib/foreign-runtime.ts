/**
 * Recognizes a plugin component compiled against another copy of Svelte, which fails as soon as
 * the editor mounts it, so a dev build can name that cause instead of a generic failure.
 */

import { devWarn } from './dev-warn';
import { isDevChecks } from './env';

// The second runtime never set up its DOM helpers, so a first mount calls `.call` on undefined and
// a later one reads `nodes` off no effect; worded as V8, SpiderMonkey and JavaScriptCore word it.
const NO_RUNTIME_STATE =
	/\(reading '(?:call|nodes|nodes_start)'\)|property "(?:call|nodes|nodes_start)"|\.(?:call|nodes|nodes_start)'\)/;

export function isForeignRuntimeError(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	// Thrown when the second runtime finds no effect in progress for the component's `$effect`.
	if (/\beffect_orphan\b/.test(error.message)) return true;
	return error.name === 'TypeError' && NO_RUNTIME_STATE.test(error.message);
}

/** In dev, the cause to show for a mount failure from another runtime; null otherwise. */
export function foreignRuntimeCause(error: unknown): string | null {
	return isDevChecks() && isForeignRuntimeError(error)
		? 'its component was compiled against a different Svelte runtime'
		: null;
}

/** Warns in dev when `subject` (what failed to mount, for the console) runs on another runtime. */
export function warnIfForeignRuntime(error: unknown, subject: string): void {
	const cause = foreignRuntimeCause(error);
	if (cause) devWarn('foreign-runtime', `${subject} failed to mount: ${cause}`);
}
