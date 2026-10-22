/** The span of `after` a write changed in `before`: everything between their common prefix and
 *  their common suffix. A pure deletion gives an empty span where the bytes went. */
export function writtenSpan(before: string, after: string): { start: number; end: number } {
	const shorter = Math.min(before.length, after.length);
	let start = 0;
	while (start < shorter && before[start] === after[start]) start++;
	let suffix = 0;
	while (
		suffix < shorter - start &&
		before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
	) {
		suffix++;
	}
	return { start, end: after.length - suffix };
}
