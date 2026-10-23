// Character classes the inline grammar is written in, beside the GFM whitespace in core/lines.
import { ESCAPABLE_PUNCTUATION } from '../../escapable';
import { isHighSurrogate, isLowSurrogate } from '../../lines';

const UNICODE_WHITESPACE = /^[\t\n\f\r\p{Zs}]$/u;
const UNICODE_PUNCTUATION = /^[!-/:-@[-`{-~\p{P}]$/u;
const ALPHANUMERIC = /^[A-Za-z0-9]$/;
const LETTER = /^[A-Za-z]$/;

export const isAsciiPunctuation = (c: string | undefined) =>
	c !== undefined && ESCAPABLE_PUNCTUATION.has(c);
export const isAlphanumeric = (c: string | undefined) => c !== undefined && ALPHANUMERIC.test(c);
export const isLetter = (c: string | undefined) => c !== undefined && LETTER.test(c);

/** The code point ending just before `pos`, or a newline at the string's start. */
export function codePointBefore(raw: string, pos: number): string {
	if (pos <= 0) return '\n';
	const pair =
		pos >= 2 && isLowSurrogate(raw.charCodeAt(pos - 1)) && isHighSurrogate(raw.charCodeAt(pos - 2));
	return pair ? raw.slice(pos - 2, pos) : raw[pos - 1];
}

/** The code point starting at `pos`, or a newline past the string's end. */
export function codePointAt(raw: string, pos: number): string {
	const code = raw.codePointAt(pos);
	return code === undefined ? '\n' : String.fromCodePoint(code);
}

export const isUnicodeWhitespace = (c: string) => UNICODE_WHITESPACE.test(c);
export const isUnicodePunctuation = (c: string) => UNICODE_PUNCTUATION.test(c);
