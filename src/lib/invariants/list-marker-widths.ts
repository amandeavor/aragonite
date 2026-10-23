/**
 * G1.118: every list in a block an edit wrote keeps the marker-width counts a recount of its items
 * gives, so the marker column never sizes from a route that changed items without its rebuild.
 */

import type { NodeView } from '../core/node-views';
import { type InvariantViolation } from '@voithos-labs/aragonite/dev-checks';
import { markerWidthCounts, sameMarkerWidths } from '../core/parsers/list';

export function checkListMarkerWidths(node: NodeView): InvariantViolation | null {
	if (node.kind === 'list') {
		const counted = markerWidthCounts(node.children ?? []);
		if (!node.markerWidths || !sameMarkerWidths(node.markerWidths, counted)) {
			return {
				code: 'list-marker-widths',
				message: `a list's marker widths are ${node.markerWidths ? `[${node.markerWidths.join(',')}]` : 'absent'}, its items count [${counted.join(',')}]`
			};
		}
	}
	for (const child of node.children ?? []) {
		const below = checkListMarkerWidths(child);
		if (below) return below;
	}
	return null;
}
