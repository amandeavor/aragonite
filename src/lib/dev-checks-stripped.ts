/**
 * What a build resolving the `production` condition gets for `@voithos-labs/aragonite/dev-checks`:
 * the same names, with the switch a constant `false` and the reporters empty, so the bundler drops
 * every check and the code only checks reach. `configureEditorEnv` still sets the test flag.
 */
import type { DevWarnSink, InvariantViolation } from '@voithos-labs/aragonite/dev-checks';
import { detectTestProcess } from './test-process.js';

export type {
	DevWarnEntry,
	DevWarnSink,
	InvariantViolation
} from '@voithos-labs/aragonite/dev-checks';

export const devChecksOn: boolean = false;

export let isTestProcess: boolean = detectTestProcess();

export function configureEditorEnv(partial: { isDev?: boolean; isTest?: boolean }): void {
	if (partial.isTest !== undefined) isTestProcess = partial.isTest;
}

export function resetEditorEnv(): void {
	isTestProcess = detectTestProcess();
}

/* @__NO_SIDE_EFFECTS__ */
export function setDevWarnSink(_next: DevWarnSink | null): DevWarnSink | null {
	return null;
}

/* @__NO_SIDE_EFFECTS__ */
export function devWarn(_tag: string, _message: string, _details?: unknown): void {}

/* @__NO_SIDE_EFFECTS__ */
export function assertInvariant(_tag: string, _check: () => InvariantViolation | null): void {}

/* @__NO_SIDE_EFFECTS__ */
export function documentForCheck(_check: string): Document | null {
	return null;
}
