import { describe, expect, it } from 'vitest';
import { checkOpenerRegistry } from '#lib/invariants/registry.js';
import { getOrderedOpeners } from '#lib/schema/block-openers.js';
import { openerRecords } from '#lib/schema/block-kind-descriptor.js';

describe('G1.10 opener priorities', () => {
	it('holds over the real registrations once the grammar has been read', () => {
		getOrderedOpeners();
		const entries = openerRecords().map(({ key, value }) => ({
			kind: key,
			priority: value.priority
		}));
		expect(entries.length).toBeGreaterThan(0);
		expect(checkOpenerRegistry(entries)).toBeNull();
	});

	it('flags duplicate priorities', () => {
		const v = checkOpenerRegistry([
			{ kind: 'heading', priority: 20 },
			{ kind: 'blockquote', priority: 20 }
		]);
		expect(v?.code).toBe('opener-registry');
		expect(v?.message).toContain('priority 20');
	});
});
