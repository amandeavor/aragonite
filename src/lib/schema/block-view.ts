/** What draws a block kind, opaque here so this module's types name no UI framework. Only a
 *  function that builds a view brands one, and registration refuses anything unbranded. */

const blockViewBrand: unique symbol = Symbol('BlockView');

/** What draws a block kind: `svelteBlockView` (from `@voithos-labs/aragonite/svelte`) or
 *  `textBlockView` makes one. */
export interface BlockView {
	readonly [blockViewBrand]: true;
}

/** Marks `body` as a block view; only the functions that build a view call it. */
export function asBlockView<T extends object>(body: T): T & BlockView {
	return Object.assign(body, { [blockViewBrand]: true as const });
}

export function isBlockView(value: unknown): value is BlockView {
	return (value as Partial<BlockView> | undefined)?.[blockViewBrand] === true;
}
