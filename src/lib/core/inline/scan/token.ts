// The scan's flat output: leaves and literal bytes in order, with the wrappers (emphasis, links)
// recorded on the tokens that open and close them. The tree is built from it once, at the end.
import type { InlineNode } from '../../nodes';

export interface Token {
	start: number;
	end: number;
	/** The part of the token left as literal text; empty once markers consume it all. */
	litStart: number;
	litEnd: number;
	node?: InlineNode;
	/** Wrappers whose opening marker is here, innermost first. */
	opens?: InlineNode[];
	/** How many wrappers close here. */
	closes?: number;
}

export const token = (start: number, end: number, node?: InlineNode): Token => ({
	start,
	end,
	litStart: node ? end : start,
	litEnd: end,
	...(node ? { node } : {})
});

export function openWrapper(at: Token, wrapper: InlineNode): void {
	(at.opens ??= []).push(wrapper);
}

export function closeWrapper(at: Token): void {
	at.closes = (at.closes ?? 0) + 1;
}
