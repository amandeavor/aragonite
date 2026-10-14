/**
 * Every wrapper package releases with the core (G4.181): `scripts/check-lockstep.mjs` holds the
 * rule, and the publish script runs it before anything ships.
 */

import { describe, it, expect } from 'vitest';
import { lockstepDrift, readManifests } from '../../../../../scripts/check-lockstep.mjs';

const ROOT = { version: '1.2.0' };
const wrapper = (version: string, peer?: string) => ({
	name: '@voithos-labs/aragonite-x',
	version,
	peerDependencies:
		peer === undefined ? {} : ({ '@voithos-labs/aragonite': peer } as Record<string, string>)
});

describe('lockstep versions', () => {
	it('holds on this tree, which has at least one wrapper', () => {
		const { root, wrappers } = readManifests();

		expect(wrappers.length).toBeGreaterThan(0);
		expect(lockstepDrift(root, wrappers)).toEqual([]);
	});

	it.each([
		['its own version', wrapper('1.1.0', '1.2.0')],
		['its peer on the core', wrapper('1.2.0', '1.1.0')],
		['a range instead of the exact version', wrapper('1.2.0', '^1.2.0')],
		['no peer on the core at all', wrapper('1.2.0')]
	])('reports a wrapper that drifts by %s', (_, drifted) => {
		expect(lockstepDrift(ROOT, [drifted])).toHaveLength(1);
	});
});
