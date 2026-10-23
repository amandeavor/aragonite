// The copy of the dev-checks module a production build gets: the same names, nothing that runs.

import { afterEach, describe, expect, it, vi } from 'vitest';
import * as real from '@voithos-labs/aragonite/dev-checks';
import * as stripped from '../dev-checks-stripped';
import { commentSpans, languageOf, readSource } from './invariants/lint/scan-source';
import { SOURCE } from './invariants/lint/source-paths';

// A name the real module gains and the copy lacks is a compile error here, and a host's
// production build fails to link.
const sameShape: typeof real = stripped;

describe('the stripped dev-checks module', () => {
	afterEach(() => stripped.resetEditorEnv());

	it('exports exactly the names the real module does', () => {
		expect(Object.keys(sameShape).sort()).toEqual(Object.keys(real).sort());
	});

	it('keeps the switch off, whatever configureEditorEnv says', () => {
		stripped.configureEditorEnv({ isDev: true });
		expect(stripped.devChecksOn).toBe(false);
	});

	it('never runs a check', () => {
		const check = vi.fn(() => ({ code: 'x', message: 'm' }));
		stripped.assertInvariant('test', check);
		expect(check).not.toHaveBeenCalled();
		expect(stripped.documentForCheck('a check')).toBeNull();
	});

	// The test flag gates the testing kit's reset, which a production-condition runner still uses.
	it('still follows the test flag', () => {
		stripped.configureEditorEnv({ isTest: false });
		expect(stripped.isTestProcess).toBe(false);
		stripped.resetEditorEnv();
		expect(stripped.isTestProcess).toBe(true);
	});

	// Without the annotation esbuild keeps every call, with the closure and message it carries.
	it('marks every function but the env setters free of side effects', () => {
		const file = readSource(SOURCE.devChecksStripped);
		const annotations = commentSpans(file.text, languageOf(file.relPath)).filter((span) =>
			file.text.slice(span.start, span.end).includes('@__NO_SIDE_EFFECTS__')
		);
		const functions = [...file.code.matchAll(/export function (\w+)/g)];
		const bare = functions
			.filter(
				({ index }) =>
					!annotations.some((span) => span.end <= index && !file.text.slice(span.end, index).trim())
			)
			.map(([, name]) => name);
		expect(bare.sort()).toEqual(['configureEditorEnv', 'resetEditorEnv']);
		expect(functions.length).toBeGreaterThan(bare.length);
	});
});
