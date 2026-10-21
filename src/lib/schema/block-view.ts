/** What draws a block kind, opaque here so this module's types name no UI framework. Only a
 *  function that builds a view brands one, and registration refuses anything unbranded. */

const blockViewBrand: unique symbol = Symbol('BlockView');
const viewForm = Symbol('BlockView.form');

/** What draws a block kind: `svelteBlockView` (from `@voithos-labs/aragonite/svelte`) or
 *  `textBlockView` makes one. */
export interface BlockView {
	readonly [blockViewBrand]: true;
}

/** How a view draws: a Svelte component BlockHost renders inline, or a DOM spec its host mounts. */
export type BlockViewForm = 'svelte' | 'dom';

/** Marks `body` as a block view of `form`; only the functions that build a view call it. */
export function asBlockView<T extends object>(body: T, form: BlockViewForm): T & BlockView {
	return Object.assign(body, { [blockViewBrand]: true as const, [viewForm]: form });
}

export function isBlockView(value: unknown): value is BlockView {
	return (value as Partial<BlockView> | undefined)?.[blockViewBrand] === true;
}

export function blockViewForm(view: BlockView): BlockViewForm {
	return (view as unknown as Record<typeof viewForm, BlockViewForm>)[viewForm];
}
