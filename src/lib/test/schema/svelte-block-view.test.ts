/** A Svelte block view carries its component and props, and refuses a component that isn't a
 *  block. */
import { describe, it, expect } from 'vitest';
import type { Component } from 'svelte';
import type { CstNode } from '../../core/nodes';
import type { NodeView } from '../../core/node-views';
import { svelteBlockEntry, svelteBlockView } from '../../components/svelte-block-view';

const fakeComponent = (() => {}) as unknown as Parameters<typeof svelteBlockView>[0];

describe('svelteBlockView', () => {
	it('returns a view carrying the same component reference', () => {
		const entry = svelteBlockEntry(svelteBlockView(fakeComponent));
		expect(entry?.component).toBe(fakeComponent);
		expect(entry?.extraProps).toBeUndefined();
	});

	it('forwards extraProps', () => {
		const extra = (node: NodeView) => ({ blockClass: node.kind });
		const entry = svelteBlockEntry(svelteBlockView(fakeComponent, extra));
		expect(entry?.extraProps).toBe(extra);
		const node = { kind: 'paragraph', leadingTrivia: '', raw: 'x\n' } as CstNode;
		expect(entry?.extraProps!(node)).toEqual({ blockClass: 'paragraph' });
	});

	it('rejects a component whose exports are not a BlockComponent', () => {
		const notABlock = null as unknown as Component<{ x: number }, { foo: number }>;
		// @ts-expect-error exports must structurally satisfy BlockComponent;
		// an unused directive here (a green build) means the call-site check decayed.
		svelteBlockView(notABlock);
	});
});
