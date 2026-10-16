import { describe, it, expect } from 'vitest';
import { ALL_BLOCK_KINDS, type BlockKind } from '../../core/nodes';
import { tryGetBlockKindDescriptor } from '../../schema/block-kind-descriptor';
import { checkRegistryCompleteness } from '../../invariants/registry';

const KINDS: BlockKind[] = ['paragraph', 'blockquote', 'list'];

describe('checkRegistryCompleteness (G1.2)', () => {
	it('fires when a kind has no descriptor', () => {
		const violation = checkRegistryCompleteness(KINDS, (k) => k !== 'blockquote');
		expect(violation?.code).toBe('registry-incomplete');
		expect(violation?.detail).toEqual({ kind: 'blockquote', missing: 'descriptor' });
	});

	it('passes when every kind has a descriptor', () => {
		expect(checkRegistryCompleteness(KINDS, () => true)).toBeNull();
	});

	it('passes over real descriptors for all kinds', () => {
		expect(
			checkRegistryCompleteness(ALL_BLOCK_KINDS, (k) => tryGetBlockKindDescriptor(k) !== undefined)
		).toBeNull();
	});
});
