/**
 * G1.113: the marker a list item draws is its own opening bytes, past the up-to-three spaces that
 * indent it, so source mode shows each one. The item builds the marker from its metadata, and a
 * rewrite that moves the metadata without the bytes would draw a marker the file doesn't hold.
 */

import type { InvariantViolation } from '../assert';

export function checkItemMarkerBytes(raw: string, drawn: string): InvariantViolation | null {
	const bytes = raw.replace(/^ {0,3}/, '');
	if (bytes.startsWith(drawn)) return null;
	return {
		code: 'item-marker-bytes',
		message: `a list item draws ${JSON.stringify(drawn)} but its bytes open ${JSON.stringify(bytes.slice(0, drawn.length))}`
	};
}
