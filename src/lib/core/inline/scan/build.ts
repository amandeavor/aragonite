// Builds the node tree from the scan's tokens in one pass with an explicit stack, so nesting depth
// never reaches the call stack. Literal reference shapes become their one node on the way.
import type { InlineNode } from '../../nodes';
import type { Shape } from './scan';
import type { Token } from './token';

export function buildTree(raw: string, tokens: Token[], shapes: Shape[]): InlineNode[] {
	const taken = takeShapes(tokens, shapes);
	const root: InlineNode[] = [];
	const open: InlineNode[] = [];
	let list = root;
	for (let i = 0; i < tokens.length; i++) {
		const shape = taken.get(i);
		if (shape) {
			list.push(shape.node);
			i = shape.endToken;
			continue;
		}
		const t = tokens[i];
		for (let k = t.closes ?? 0; k > 0; k--) {
			open.pop();
			list = open.length > 0 ? open[open.length - 1].children! : root;
		}
		if (t.node) list.push(t.node);
		else appendText(raw, list, t.litStart, t.litEnd);
		for (let k = (t.opens ?? []).length - 1; k >= 0; k--) {
			const wrapper = t.opens![k];
			list.push(wrapper);
			open.push(wrapper);
			list = wrapper.children!;
		}
	}
	return root;
}

/** Touching literal text joins into one node, so a parse never depends on where the scan paused. */
function appendText(raw: string, list: InlineNode[], start: number, end: number): void {
	if (start >= end) return;
	const last = list[list.length - 1];
	if (last?.kind === 'text' && last.end === start && !last.syntaxClaim) {
		last.end = end;
		last.text = raw.slice(last.start, end);
	} else list.push({ kind: 'text', start, end, text: raw.slice(start, end) });
}

/** The shapes that become `unresolvedReference` nodes, by start token: those no wrapper crosses,
 *  taken left to right without overlap. */
function takeShapes(tokens: Token[], shapes: Shape[]): Map<number, Shape> {
	const taken = new Map<number, Shape>();
	if (shapes.length === 0) return taken;
	const byStart = [...shapes].sort((a, b) => a.startToken - b.startToken);
	const depthAt = new Map<Shape, number>();
	const valid = new Set<Shape>();
	const watching: Shape[] = [];
	let depth = 0;
	let nextStart = 0;
	let nextEnd = 0;
	for (let i = 0; i < tokens.length; i++) {
		for (; nextStart < byStart.length && byStart[nextStart].startToken === i; nextStart++) {
			depthAt.set(byStart[nextStart], depth);
			watching.push(byStart[nextStart]);
		}
		depth -= tokens[i].closes ?? 0;
		while (watching.length > 0 && depthAt.get(watching[watching.length - 1])! > depth) {
			depthAt.delete(watching.pop()!);
		}
		depth += (tokens[i].opens ?? []).length;
		for (; nextEnd < shapes.length && shapes[nextEnd].endToken === i; nextEnd++) {
			if (depthAt.get(shapes[nextEnd]) === depth) valid.add(shapes[nextEnd]);
		}
	}
	let free = 0;
	for (const shape of byStart) {
		if (!valid.has(shape) || shape.startToken < free) continue;
		taken.set(shape.startToken, shape);
		free = shape.endToken + 1;
	}
	return taken;
}
