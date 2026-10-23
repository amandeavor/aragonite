// Character references, and the unescaping that link destinations and titles share.
import type { InlineNode } from '../../nodes';
import { HTML5_NAMED_ENTITIES } from '../html-entities';

const REFERENCE = /^&(?:#[xX]([0-9a-fA-F]{1,6})|#([0-9]{1,7})|([A-Za-z][A-Za-z0-9]{1,31}));/;
const ESCAPE_OR_REFERENCE =
	/\\([!-/:-@[-`{-~])|&(?:#[xX][0-9a-fA-F]{1,6}|#[0-9]{1,7}|[A-Za-z][A-Za-z0-9]{1,31});/g;
// `&#x` + 6 digits + `;` is the longest numeric form; a name is at most 32 characters.
const LONGEST_REFERENCE = 34;

function decodeNumber(code: number): string {
	const invalid = code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff);
	return invalid ? '�' : String.fromCodePoint(code);
}

/** The decoded text of the reference `text` starts with, and its length; null when it is none. */
function decodeReference(text: string): { decoded: string; length: number } | null {
	const m = REFERENCE.exec(text);
	if (!m) return null;
	const decoded = m[1]
		? decodeNumber(parseInt(m[1], 16))
		: m[2]
			? decodeNumber(parseInt(m[2], 10))
			: Object.hasOwn(HTML5_NAMED_ENTITIES, m[3])
				? HTML5_NAMED_ENTITIES[m[3]]
				: undefined;
	return decoded === undefined ? null : { decoded, length: m[0].length };
}

export function matchCharRef(raw: string, pos: number, end: number): InlineNode | null {
	if (raw[pos] !== '&') return null;
	const ref = decodeReference(raw.slice(pos, Math.min(end, pos + LONGEST_REFERENCE)));
	return (
		ref && { kind: 'entityReference', start: pos, end: pos + ref.length, decoded: ref.decoded }
	);
}

/** Backslash escapes and character references resolved, as in a destination or title. */
export function unescape(text: string): string {
	return text.replace(
		ESCAPE_OR_REFERENCE,
		(match, escaped?: string) => escaped ?? decodeReference(match)?.decoded ?? match
	);
}
