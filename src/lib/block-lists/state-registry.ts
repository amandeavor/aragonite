/** Find a mounted container's `BlockListState` by its node (a view works too). A container the
 *  window unmounted has no entry, so a caller falls back to the node's own ids. */

import { isDevChecks } from '../env';
import { tick } from 'svelte';
import type { NodeView } from '../core/node-views';
import type { BlockListState } from './block-list-state.svelte';
import { devWarn } from '../dev-warn';

// Every live claim on a node, latest last, so a remount resolves to the newest mount whichever of
// the outgoing teardown and the incoming registration runs first.
const claims = new WeakMap<NodeView, BlockListState[]>();
const unmounted = new WeakSet<BlockListState>();

/** Claims `node` for `state` until the returned call; the latest live claim is the one found. */
export function registerBlockListState(node: NodeView, state: BlockListState): () => void {
	const held = claims.get(node) ?? [];
	const existing = held[held.length - 1];
	claims.set(node, [...held.filter((s) => s !== state), state]);
	if (isDevChecks() && existing && existing !== state) {
		void reportContestedClaim(node, existing, state);
	}
	return () => {
		const rest = (claims.get(node) ?? []).filter((s) => s !== state);
		if (rest.length > 0) claims.set(node, rest);
		else claims.delete(node);
	};
}

/** Called once the owning component is gone, so a state a caller kept past that is caught. */
export function markBlockListStateUnmounted(state: BlockListState): void {
	unmounted.add(state);
}

/** True for a state whose component has unmounted; the commit refuses to read one. */
export function isUnmountedBlockListState(state: object): boolean {
	return unmounted.has(state as BlockListState);
}

/** Checked a tick later because Svelte mounts a remount's new component before tearing down the
 *  one it replaces; a replaced state still holding child refs after that has a live rival. */
async function reportContestedClaim(
	node: NodeView,
	loser: BlockListState,
	winner: BlockListState
): Promise<void> {
	await tick();
	if (getStateForNode(node) !== winner) return;
	if (loser.innerBlockRefs.every((ref) => ref === undefined)) return;
	devWarn(
		'state-registry',
		`two live components claim the same ${node.kind}: the loser's child refs are orphaned. ` +
			`Either both mounts render this node, or the loser's teardown emptied slots the ` +
			`scope no longer reads.`
	);
}

export function getStateForNode(node: NodeView): BlockListState | undefined {
	const held = claims.get(node);
	return held?.[held.length - 1];
}

/** What a commit scope reads of a container's state: its ids, and refs it rewrites in place. */
export type ScopeState = Pick<BlockListState, 'innerBlockIds' | 'innerBlockRefs'>;

/** A container's mounted state, or the ids its node holds and no refs, since an unmounted
 *  container's ids still follow an edit; null for one that never mounted, which holds no ids. */
export function scopeStateFor(node: NodeView): ScopeState | null {
	const state = getStateForNode(node);
	if (state) return state;
	return node.childIds ? { innerBlockIds: [...node.childIds], innerBlockRefs: [] } : null;
}

/** The strict lookup, for a node whose container must be mounted (it holds the caret, say).
 *  A route that can reach a windowed-out container uses `getStateForNode` and its fallback. */
export function expectStateForNode(node: NodeView): BlockListState {
	const state = getStateForNode(node);
	if (!state) {
		throw new Error(
			`[state-registry] no BlockListState registered for ${node.kind}: ` +
				`caller assumed a mounted container. A path that can reach an unmounted one, or a ` +
				`node that is no container, uses getStateForNode and guards on undefined.`
		);
	}
	return state;
}
