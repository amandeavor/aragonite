// The defects the exhaustive suites already know about, each named once with a pattern over its
// failure lines, so a fix clears every input the defect reached and a longer input reaching it
// needs no entry. A suite fails on a failure no defect matches, and on a defect that matched
// nothing in a run long enough to reach it.

import { expect } from 'vitest';
import { LISTED_FAILURES } from './alphabet';

interface KnownDefect {
	suite: string;
	/** What's broken, in one line. */
	defect: string;
	/** The shortest input that reaches the defect; a shorter run doesn't expect a match. */
	from: number;
	/** Matches the defect's failure lines, which open `"<input>" [<path>]@<offset> <edit>: `. */
	lines: RegExp;
}

/** A JSON string in a failure line. */
const STR = String.raw`"(?:[^"\\]|\\.)*"`;
const at = (edit: string) => String.raw`^${STR} \[[\d,]*\]@\d+ ${edit}: `;
const re = (...parts: string[]) => new RegExp(parts.join(''));

export const KNOWN_DEFECTS: readonly KnownDefect[] = [
	{
		suite: 'edits',
		defect:
			'a whitespace-only last line with no final newline: blank-line runs differ from a reload',
		from: 2,
		lines: re(
			at(`(?:type ${STR}|delete before|delete after)`),
			String.raw`"(?:[^"\\]|\\.)*\\n[> ]+" differs from a reload: \[[\d,]*\] gap lines `
		)
	},
	{
		suite: 'edits',
		defect:
			'a delete that empties the line after a marker-only line: the blank line goes uncounted',
		from: 3,
		lines: re(
			at('delete (?:before|after)'),
			String.raw`"(?:[^"\\]|\\.)*\\n\\n" differs from a reload: \[[\d,]*\] gap lines \[[\d,]*0\], reload \[[\d,]*1\]$`
		)
	},
	{
		suite: 'edits',
		defect: 'a split before a whitespace-only last line fires the last-line-kept check',
		from: 3,
		lines: re(at('split'), 'fired invariant:last-line-kept$')
	},
	{
		suite: 'edits',
		defect: "a split on an unclosed fence opener's line leaves more blocks than a reload reads",
		from: 3,
		lines: re(
			'^"[^"]*```[^"]*" ',
			String.raw`\[[\d,]*\]@\d+ split: `,
			String.raw`${STR} differs from a reload: \[[\d,]*\] live has \d+ children, reparsed has \d+`
		)
	},
	{
		suite: 'edits',
		defect: 'typing the third backtick of a fence before a blank line: blank-line runs differ',
		from: 4,
		lines: re(
			at('type "`"'),
			'"```',
			String.raw`(?:[^"\\]|\\.)*" differs from a reload: \[[\d,]*\] gap lines `
		)
	},
	{
		suite: 'edits',
		defect: 'some splits of a two-line block fire a tree-ops warning',
		from: 4,
		lines: re(at('split'), 'fired tree-ops$')
	},
	{
		suite: 'edits',
		defect:
			'emptying the one-character line under a one-line quote fires the stale-raw and last-line checks',
		from: 4,
		lines: re(at('delete (?:before|after)'), 'fired invariant:stale-raw, invariant:last-line-kept$')
	},
	{
		suite: 'edits',
		defect:
			'a list marker typed onto a whitespace-only line above another fires the task-slot check',
		from: 4,
		lines: re(at('type "[*-]"'), '.*fired invariant:task-marker-slot')
	}
];

/** Holds `failures`, from every input up to `maxLength` long, to the known defects of `suite`. */
export function holdToKnownFailures(suite: string, failures: string[], maxLength: number): void {
	const known = KNOWN_DEFECTS.filter((entry) => entry.suite === suite);
	const unknown = failures.filter((failure) => !known.some((entry) => entry.lines.test(failure)));
	const fixed = known
		.filter((entry) => entry.from <= maxLength)
		.filter((entry) => !failures.some((failure) => entry.lines.test(failure)))
		.map((entry) => entry.defect);
	expect(
		{ unknown: unknown.slice(0, LISTED_FAILURES), fixed },
		`${unknown.length} failures no known defect matches, ${fixed.length} defects nothing reached; ` +
			'name a new defect in KNOWN_DEFECTS, or delete the entry of one a fix closed'
	).toEqual({ unknown: [], fixed: [] });
}
