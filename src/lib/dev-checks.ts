/**
 * The switch every dev-only check reads, and the two reporters a check calls. Import it by its
 * package name, `@voithos-labs/aragonite/dev-checks`: a build resolving the `production` condition
 * gets `dev-checks-stripped.ts` in its place, so every check behind it compiles out. The one module
 * that imports `esm-env`.
 */
import { DEV } from 'esm-env';
import { detectTestProcess } from './test-process.js';

export interface InvariantViolation {
	code: string;
	message: string;
	detail?: unknown;
}

export interface DevWarnEntry {
	tag: string;
	message: string;
	details?: unknown;
}

export type DevWarnSink = (entry: DevWarnEntry) => void;

// ── The switch ──────────────────────────────────────────────────────────────

/** Whether dev checks run: in a dev build, or wherever `configureEditorEnv` turned dev on. A
 *  live binding, so a check reads it where it runs; a copy taken at import goes stale. */
export let devChecksOn: boolean = DEV;

/** Whether this is a test process: Vitest is detected, another runner says so through
 *  `configureEditorEnv({ isTest: true })`. */
export let isTestProcess: boolean = detectTestProcess();

/** Override the detected flags, for a toolchain that reads them wrong. `isDev` turns the checks
 *  and their warnings on or off together. */
export function configureEditorEnv(partial: { isDev?: boolean; isTest?: boolean }): void {
	if (partial.isDev !== undefined) devChecksOn = partial.isDev;
	if (partial.isTest !== undefined) isTestProcess = partial.isTest;
}

export function resetEditorEnv(): void {
	devChecksOn = DEV;
	isTestProcess = detectTestProcess();
}

// ── Reporters ───────────────────────────────────────────────────────────────

let sink: DevWarnSink | null = null;

/**
 * Send warnings to `next` instead of the console, and return the callback it replaced. For a
 * harness that reads them as data, under any runner. Nothing registers one in production.
 */
export function setDevWarnSink(next: DevWarnSink | null): DevWarnSink | null {
	const previous = sink;
	sink = next;
	return previous;
}

export function devWarn(tag: string, message: string, details?: unknown): void {
	if (!devChecksOn) return;
	if (sink) {
		sink({ tag, message, details });
		return;
	}
	// The `aragonite:` prefix is what the e2e watchers key on (`warn-tags.ts` reads it back).
	if (details !== undefined) {
		console.warn(`[aragonite:${tag}] ${message}`, details);
	} else {
		console.warn(`[aragonite:${tag}] ${message}`);
	}
}

/** Run `check` in a dev build and report what it finds. Never throws: a false positive must not
 *  crash a real editor. */
export function assertInvariant(tag: string, check: () => InvariantViolation | null): void {
	if (!devChecksOn) return;
	const violation = check();
	// `invariant:` lets the e2e simulation's collector tell a violation from a benign warning.
	if (violation) devWarn(`invariant:${tag}`, violation.message, violation.detail ?? violation.code);
}

/** The document a dev check reads, or null where there is none, which it reports, so a run
 *  without a DOM says what it skipped instead of passing quietly. */
export function documentForCheck(check: string): Document | null {
	if (typeof document !== 'undefined') return document;
	devWarn(
		'needs-dom',
		`${check} needs a DOM and there is none here, so it did not run. Under Vitest, give the ` +
			'test file a `// @vitest-environment jsdom` docblock.'
	);
	return null;
}
