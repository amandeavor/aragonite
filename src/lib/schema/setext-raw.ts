/** Where a setext heading's title ends: everything before the line break above its underline. */

import type { NodeView } from '../core/node-views';
import { displayLines, trimTrailingLineEnding } from '../core/lines';

export function setextHeadingContentRange(node: NodeView): { start: number; end: number } {
	const display = trimTrailingLineEnding(node.raw);
	const lines = displayLines(display);
	if (lines.length < 2) return { start: 0, end: display.length };
	const underline = lines[lines.length - 1];
	const breakAbove = lines[lines.length - 2].ending;
	return { start: 0, end: display.length - underline.text.length - breakAbove.length };
}
