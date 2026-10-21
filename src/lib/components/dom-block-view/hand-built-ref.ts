import type { BlockComponent } from '../../block-component';
import { HAND_BUILT_MEMBERS, type HandBuiltViewHandle } from '../../schema/block-view';

/**
 * The ref a hand-built view publishes: the members its handle has, of those a view may supply, so
 * a caller testing for a member finds only real ones, plus `editable` from the kind. Build it once
 * per mount, since the ref slot compares identity.
 */
export function handBuiltRef(handle: HandBuiltViewHandle, editable: () => boolean): BlockComponent {
	const ref: Record<string, unknown> = {};
	for (const key of HAND_BUILT_MEMBERS) {
		if (!(key in handle)) continue;
		const value = handle[key];
		if (typeof value === 'function') ref[key] = value.bind(handle);
		else Object.defineProperty(ref, key, { enumerable: true, get: () => handle[key] });
	}
	Object.defineProperty(ref, 'editable', { enumerable: true, get: editable });
	return ref as unknown as BlockComponent;
}
