/**
 * The checks behind the inline transition guards (G1.25 to G1.27): the widget pool's
 * begin/sweep bracket, the source-length rule for a revealed construct, and the window during
 * which an IME composition is open.
 */
import { type InvariantViolation } from '@voithos-labs/aragonite/dev-checks';

export type PoolBracketAction = 'acquire' | 'retain' | 'beginPass' | 'sweep';

/** G1.25: every pool change happens between `beginPass` and `sweep`; outside that bracket a
 *  lookup by key alone cannot tell two byte-identical widgets apart. */
export function checkPoolBracket(
	passOpen: boolean,
	action: PoolBracketAction
): InvariantViolation | null {
	if (action === 'beginPass') {
		return passOpen
			? {
					code: 'begin-unswept',
					message: 'beginPass while a bracket is already open: the previous pass was never swept'
				}
			: null;
	}
	if (passOpen) return null;
	return action === 'acquire' || action === 'retain'
		? {
				code: 'acquire-outside-bracket',
				message: `${action} outside a beginPass/sweep bracket: adoption is only meaningful inside a rebuild pass`
			}
		: {
				code: 'sweep-outside-bracket',
				message:
					'sweep without an open bracket, nothing was adopted, so it would destroy every live widget'
			};
}

/** G1.26, the shared editable core's half: a revealed construct's source bytes span exactly
 *  `[sourceStart, sourceEnd)`, or every raw offset after the source shifts. */
export function checkRevealSourceLength(
	sourceLength: number,
	sourceStart: number,
	sourceEnd: number
): InvariantViolation | null {
	if (sourceLength === sourceEnd - sourceStart) return null;
	return {
		code: 'source-length-mismatch',
		message: 'reveal source length differs from its [sourceStart, sourceEnd) range',
		detail: { sourceLength, sourceStart, sourceEnd }
	};
}

/** G1.27: a `compositionend` arrives only inside a composition the surface opened (at its start or
 *  its first composed run), so an unpaired end means IME keystrokes reached the tree unguarded. */
export function checkCompositionEndPaired(composing: boolean): InvariantViolation | null {
	if (composing) return null;
	return {
		code: 'end-without-start',
		message: 'compositionend with no open composition: the surface never opened one'
	};
}
