/** What a write changed between two versions of a block's bytes; every caller that diffs a block
 *  before and after an edit asks here, since a keystroke runs it over the whole block. */

/** The span of `after` a write changed in `before`, between their common prefix and suffix, and
 *  `removedEnd`, where it ends in `before`. A pure deletion gives an empty span. */
export function writtenSpan(
	before: string,
	after: string
): { start: number; end: number; removedEnd: number } {
	const shorter = Math.min(before.length, after.length);
	const start = sharedPrefixLength(before, after, shorter);
	const suffix = sharedSuffixLength(before, after, shorter - start);
	return { start, end: after.length - suffix, removedEnd: before.length - suffix };
}

// Whole chunks compare natively, so the unchanged bytes of a long block cost no per-character loop.
const CHUNK = 1024;

/** How many leading characters `a` and `b` share, up to `limit`. */
export function sharedPrefixLength(a: string, b: string, limit: number): number {
	let n = 0;
	while (n + CHUNK <= limit && a.slice(n, n + CHUNK) === b.slice(n, n + CHUNK)) n += CHUNK;
	while (n < limit && a[n] === b[n]) n++;
	return n;
}

/** How many trailing characters `a` and `b` share, up to `limit`. */
export function sharedSuffixLength(a: string, b: string, limit: number): number {
	const tail = (s: string, n: number, size: number) => s.slice(s.length - n - size, s.length - n);
	let n = 0;
	while (n + CHUNK <= limit && tail(a, n, CHUNK) === tail(b, n, CHUNK)) n += CHUNK;
	while (n < limit && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
	return n;
}
