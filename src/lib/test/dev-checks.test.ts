import { describe, it, expect, vi, afterEach } from 'vitest';

import { takeDevWarns } from './support/warn-gate';
import {
	assertInvariant,
	configureEditorEnv,
	devChecksOn,
	resetEditorEnv,
	type InvariantViolation
} from '@voithos-labs/aragonite/dev-checks';

describe('assertInvariant: dev-runtime channel', () => {
	afterEach(() => {
		resetEditorEnv();
		vi.doUnmock('esm-env');
		vi.resetModules();
	});

	// The tag is written `invariant:<tag>` so the e2e watchers can tell a violation from an
	// ordinary dev warning under the shared `[aragonite:…]` console prefix.
	it('routes a violation to devWarn under the invariant namespace (non-crashing)', () => {
		const violation: InvariantViolation = { code: 'stale-raw', message: 'raw drifted' };
		expect(() => assertInvariant('test', () => violation)).not.toThrow();
		const fires = takeDevWarns();
		expect(fires.map((w) => w.tag)).toEqual(['invariant:test']);
		expect(fires[0].message).toBe('raw drifted');
		expect(fires[0].details).toBe('stale-raw');
	});

	it('passes violation.detail through when present', () => {
		assertInvariant('test', () => ({ code: 'x', message: 'm', detail: { n: 1 } }));
		const fires = takeDevWarns();
		expect(fires.map((w) => w.tag)).toEqual(['invariant:test']);
		expect(fires[0].message).toBe('m');
		expect(fires[0].details).toEqual({ n: 1 });
	});

	it('stays silent when the predicate returns null', () => {
		assertInvariant('test', () => null);
		expect(takeDevWarns()).toEqual([]);
	});

	// `DEV` is a build-time constant, so the production branch is reachable only by re-importing
	// the module with it set to false.
	it('does not run the predicate where DEV is false', async () => {
		vi.doMock('esm-env', () => ({ DEV: false }));
		const production = await import('@voithos-labs/aragonite/dev-checks');
		const check = vi.fn(() => null);
		production.assertInvariant('test', check);
		expect(check).not.toHaveBeenCalled();
	});

	// Miss-analysis: every suite runs with DEV true, so no test tried the override with DEV false.
	it('runs the predicate when configureEditorEnv turns dev on over a build where DEV is false', async () => {
		vi.doMock('esm-env', () => ({ DEV: false }));
		const overridden = await import('@voithos-labs/aragonite/dev-checks');
		const fires: string[] = [];
		overridden.setDevWarnSink((entry) => fires.push(entry.tag));
		overridden.configureEditorEnv({ isDev: true });
		overridden.assertInvariant('test', () => ({ code: 'x', message: 'm' }));
		expect(fires).toEqual(['invariant:test']);
	});
});

describe('the dev-check switch', () => {
	afterEach(() => resetEditorEnv());

	it('is a live binding: an importer sees configureEditorEnv flip it', () => {
		expect(devChecksOn).toBe(true);
		configureEditorEnv({ isDev: false });
		expect(devChecksOn).toBe(false);
		resetEditorEnv();
		expect(devChecksOn).toBe(true);
	});

	// Miss-analysis: each override row asserted the warning or the check alone, never both against
	// one switch, so a check that ran and reported nowhere passed both.
	it('#646 turns the checks off together with their warnings when isDev is false in a dev build', () => {
		configureEditorEnv({ isDev: false });
		const check = vi.fn(() => ({ code: 'x', message: 'm' }));
		assertInvariant('test', check);
		expect(check).not.toHaveBeenCalled();
		expect(takeDevWarns()).toEqual([]);
	});
});
