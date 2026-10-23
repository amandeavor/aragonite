// Link labels, destinations and titles (CommonMark §6.3), shared with the reader of link
// reference definitions. A span read that reaches `end` open answers `STILL_OPEN`, so that
// reader can resume it on the next line from `from`.
import { isWhitespaceChar, trimWhitespace, WHITESPACE_RUN } from '../../lines';
import { isAsciiPunctuation } from './chars';
import { unescape } from './entities';
import { encodeUrl } from './url';

export const STILL_OPEN = -1;
export const NO_MATCH = -2;

const MAX_LABEL = 999;
const TITLE_CLOSER: Record<string, string> = { '"': '"', "'": "'", '(': ')' };

export function labelEnd(raw: string, pos: number, end: number, from = pos + 1): number {
	if (raw[pos] !== '[') return NO_MATCH;
	for (let i = from; i < end; i++) {
		if (i - pos - 1 > MAX_LABEL) return NO_MATCH;
		const c = raw[i];
		if (c === '\\') i++;
		else if (c === '[') return NO_MATCH;
		else if (c === ']') return i + 1;
	}
	return STILL_OPEN;
}

export function readTitle(raw: string, pos: number, end: number, from = pos + 1): number {
	const closer = TITLE_CLOSER[raw[pos]];
	if (!closer) return NO_MATCH;
	for (let i = from; i < end; i++) {
		const c = raw[i];
		if (c === '\\') i++;
		else if (c === closer) return i + 1;
		else if (c === '\0' || (c === '(' && closer === ')')) return NO_MATCH;
	}
	return STILL_OPEN;
}

export function titleValue(raw: string, pos: number, titleEnd: number): string {
	return unescape(raw.slice(pos + 1, titleEnd - 1));
}

const isLineEnd = (c: string) => c === '\n' || c === '\r' || c === ' ' || c === ' ';

/** A bare destination is empty only just before a `)`, which only an inline link can close on. */
export function readDestination(
	raw: string,
	pos: number,
	end: number
): { url: string; end: number } | null {
	if (raw[pos] === '<') {
		for (let i = pos + 1; i < end; i++) {
			const c = raw[i];
			if (c === '>') return { url: encodeUrl(unescape(raw.slice(pos + 1, i))), end: i + 1 };
			if (c === '<' || c === '\n' || c === '\r' || c === '\0') return null;
			if (c === '\\' && (i + 1 >= end || isLineEnd(raw[++i]))) return null;
		}
		return null;
	}
	let depth = 0;
	let i = pos;
	for (; i < end; i++) {
		const c = raw[i];
		if (c === '\\' && i + 1 < end && isAsciiPunctuation(raw[i + 1])) i++;
		else if (c === '(') depth++;
		else if (c === ')') {
			if (depth === 0) break;
			depth--;
		} else if (isWhitespaceChar(c)) break;
	}
	if (depth !== 0) return null;
	if (i === pos && raw[i] !== ')') return null;
	return { url: encodeUrl(unescape(raw.slice(pos, i))), end: i };
}

/** Spaces and at most one line ending, as commonmark.js allows between a link's parts. */
function skipSpaces(raw: string, pos: number, end: number): number {
	while (pos < end && raw[pos] === ' ') pos++;
	if (raw[pos] === '\r' && raw[pos + 1] === '\n' && pos + 1 < end) pos += 2;
	else if (raw[pos] === '\n' && pos < end) pos++;
	while (pos < end && raw[pos] === ' ') pos++;
	return pos;
}

/** An inline link's `(destination "title")` from its `(` at `pos`. */
export function readInlineTail(
	raw: string,
	pos: number,
	end: number
): { url: string; title?: string; end: number } | null {
	if (raw[pos] !== '(' || pos >= end) return null;
	const dest = readDestination(raw, skipSpaces(raw, pos + 1, end), end);
	if (!dest) return null;
	let close = skipSpaces(raw, dest.end, end);
	let title: string | undefined;
	if (close > dest.end) {
		const titleEnd = readTitle(raw, close, end);
		if (titleEnd > 0) {
			title = titleValue(raw, close, titleEnd);
			close = skipSpaces(raw, titleEnd, end);
		}
	}
	if (close >= end || raw[close] !== ')') return null;
	return { url: dest.url, ...(title !== undefined ? { title } : {}), end: close + 1 };
}

/** Label matching: GFM whitespace trimmed and collapsed, then commonmark.js's case fold. */
export function labelKey(label: string): string {
	return trimWhitespace(label)
		.split(WHITESPACE_RUN)
		.join(' ')
		.toLowerCase()
		.toUpperCase()
		.toLowerCase();
}
