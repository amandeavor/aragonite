/**
 * G1.139: once a fix-up has run, every run of blank lines around the edit reads on reload as the
 * tree holds it, with the same blank blocks and each hidden line on the slot a reload puts it in.
 */

import { type InvariantViolation } from '@voithos-labs/aragonite/dev-checks';
import type { GrammarView } from '../schema/block-openers';
import type { BodyParent } from '../tree-operations/node-primitives';
import { describeUnlaidRun } from '../tree-operations/blank-runs';

export function checkBlankRunsLaidOut(
	body: BodyParent,
	lo: number,
	hi: number,
	grammar: GrammarView
): InvariantViolation | null {
	const report = describeUnlaidRun(body, lo, hi, grammar);
	if (report === null) return null;
	return {
		code: 'blank-run-unlaid',
		message: `a fix-up left a run of blank lines a reload reads otherwise: ${report}`
	};
}
