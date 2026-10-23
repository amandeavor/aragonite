// Code spans: the closer lookup the scan uses, and the fence helpers the editor reads.
import type { InlineNode } from '../../nodes';

export function codeFenceWidth(node: InlineNode): number {
	if (node.text === undefined) return 0;
	const width = (node.end - node.start - node.text.length) / 2;
	return Number.isInteger(width) && width > 0 ? width : 0;
}

export function asCodeSpan(content: string): string {
	const longest = (content.match(/`+/g) ?? []).reduce((max, run) => Math.max(max, run.length), 0);
	const fence = '`'.repeat(longest + 1);
	const pad = content.startsWith('`') || content.endsWith('`') ? ' ' : '';
	return fence + pad + content + pad + fence;
}

/** Every backtick run in `[start, end)`, grouped by length, so finding a closer is a binary search
 *  rather than a rescan to the end of the text. */
export function backtickRuns(
	raw: string,
	start: number,
	end: number
): (from: number, length: number) => number {
	const byLength = new Map<number, number[]>();
	for (let i = raw.indexOf('`', start); i >= 0 && i < end; i = raw.indexOf('`', i)) {
		const runStart = i;
		while (i < end && raw[i] === '`') i++;
		const runs = byLength.get(i - runStart) ?? [];
		runs.push(runStart);
		byLength.set(i - runStart, runs);
	}
	return (from, length) => {
		const runs = byLength.get(length) ?? [];
		let lo = 0;
		let hi = runs.length;
		while (lo < hi) {
			const mid = (lo + hi) >> 1;
			if (runs[mid] < from) lo = mid + 1;
			else hi = mid;
		}
		return lo < runs.length ? runs[lo] : -1;
	};
}
