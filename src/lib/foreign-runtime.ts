/**
 * Recognizes a plugin component compiled against another copy of Svelte, which fails as soon as
 * the editor mounts it, so a dev build can name that cause instead of a generic failure.
 */

import { devWarn } from './dev-warn';
import { isDevChecks } from './env';

// A second runtime's first mount calls `.call` on its unset `*_getter`, a later one reads `nodes`
// off a null effect; V8 names no variable, so there a plugin's own `undefined.call` matches too.
const GETTER = String.raw`[\w$]*_getter[\w$]*`; // a bundler may suffix a renamed variable
const EFFECT = String.raw`effect[\w$]*`;
const NO_RUNTIME_STATE = new RegExp(
	[
		String.raw`of undefined \(reading 'call'\)`,
		String.raw`of null \(reading 'nodes(?:_start)?'\)`,
		String.raw`property "call", ${GETTER} is undefined`,
		String.raw`property "nodes(?:_start)?", ${EFFECT} is null`,
		String.raw`evaluating '${GETTER}\.call'`,
		String.raw`null is not an object \(evaluating '${EFFECT}\.nodes(?:_start)?'\)`
	].join('|')
);

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
