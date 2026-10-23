// Autolinks: the angle forms, and the bare url, www. and email forms of GFM §6.9.
import type { InlineNode } from '../../nodes';
import { isWhitespaceChar } from '../../lines';
import { isAlphanumeric, isLetter, isUnicodePunctuation } from './chars';
import { encodeUrl } from './url';

const ANGLE_EMAIL =
	/<([a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)>/y;
// eslint-disable-next-line no-control-regex -- a URI autolink holds no control character or space
const ANGLE_URI = /<([A-Za-z][A-Za-z0-9.+-]{1,31}:[^<>\x00-\x20]*)>/y;
const URL_PREFIX = /www\.|https?:\/\//iy;
const TRAILING_PUNCTUATION = '?!.,:*_~';

export function matchAngleAutolink(raw: string, pos: number, end: number): InlineNode | null {
	for (const [pattern, scheme] of [
		[ANGLE_EMAIL, 'mailto:'],
		[ANGLE_URI, '']
	] as const) {
		pattern.lastIndex = pos;
		const m = pattern.exec(raw);
		if (m && pattern.lastIndex <= end) {
			return {
				kind: 'autolink',
				start: pos,
				end: pattern.lastIndex,
				url: encodeUrl(scheme + m[1]),
				angle: true
			};
		}
	}
	return null;
}

/** Where a bare form may start: after GFM whitespace, `*`, `_`, `~` or `(`. */
export const isAutolinkBoundary = (c: string) => isWhitespaceChar(c) || '*_~('.includes(c);

/** A bare `http(s)://` or `www.` url at `pos`, running to whitespace, `<` or where `advance`
 *  answers -1 (another construct starts there), then trimmed of trailing punctuation. */
export function readBareUrl(
	raw: string,
	pos: number,
	end: number,
	advance: (at: number) => number
): InlineNode | null {
	URL_PREFIX.lastIndex = pos;
	if (!URL_PREFIX.test(raw) || URL_PREFIX.lastIndex > end) return null;
	const www = raw[pos] === 'w' || raw[pos] === 'W';
	const hostStart = www ? pos : URL_PREFIX.lastIndex;
	let stop = hostStart;
	while (stop < end && !isWhitespaceChar(raw[stop]) && raw[stop] !== '<') {
		const next = advance(stop);
		if (next < 0) break;
		stop = next;
	}
	stop = trimUrl(raw, pos, stop);
	const host = hostEnd(raw, hostStart, stop);
	if (host < 0 || host === hostStart || (www && stop <= pos + 4)) return null;
	const bytes = raw.slice(pos, stop);
	return { kind: 'autolink', start: pos, end: stop, url: www ? 'http://' + bytes : bytes };
}

/** Trailing punctuation off, a `)` only while unbalanced, an entity-shaped `&…;` tail whole. */
function trimUrl(raw: string, start: number, end: number): number {
	let opens = 0;
	let closes = 0;
	for (let i = start; i < end; i++) {
		if (raw[i] === '(') opens++;
		else if (raw[i] === ')') closes++;
	}
	while (end > start) {
		const c = raw[end - 1];
		if (TRAILING_PUNCTUATION.includes(c)) end--;
		else if (c === ')' && closes > opens) {
			end--;
			closes--;
		} else if (c === ';') {
			let amp = end - 2;
			while (amp > start && isAlphanumeric(raw[amp])) amp--;
			if (amp === end - 2 || raw[amp] !== '&') break;
			end = amp;
		} else break;
	}
	return end;
}

/** The end of the host starting at `start`, or -1 when an underscore sits in its last two parts. */
function hostEnd(raw: string, start: number, end: number): number {
	let last = 0;
	let previous = 0;
	let i = start;
	for (; i < end; i++) {
		const c = raw[i];
		if (c === '_') last++;
		else if (c === '.') [previous, last] = [last, 0];
		else if (c !== '-' && (isWhitespaceChar(c) || isUnicodePunctuation(c))) break;
	}
	return last || previous ? -1 : i;
}

/** Where an email's local part (and lowercase `mailto:`/`xmpp:` prefix) begins, reading back from
 *  the `@` at `at` no further than `floor`; `at` itself when there is no local part. */
export function emailStart(
	raw: string,
	at: number,
	floor: number
): { start: number; xmpp: boolean } {
	let start = at;
	while (start > floor && /[A-Za-z0-9._+-]/.test(raw[start - 1])) start--;
	if (start === at || raw[start - 1] !== ':') return { start, xmpp: false };
	for (const prefix of ['mailto:', 'xmpp:']) {
		if (start - prefix.length >= floor && raw.startsWith(prefix, start - prefix.length)) {
			return { start: start - prefix.length, xmpp: prefix === 'xmpp:' };
		}
	}
	return { start, xmpp: false };
}

/** The end of the email domain after the `@` at `at`, trimmed of trailing periods, or -1. */
export function emailEnd(raw: string, at: number, end: number, xmpp: boolean): number {
	let periods = 0;
	let stop = at + 1;
	for (; stop < end; stop++) {
		const c = raw[stop];
		if (c === '.') {
			if (isAlphanumeric(raw[stop + 1]) && stop + 1 < end) periods++;
		} else if (!(isAlphanumeric(c) || c === '-' || c === '_' || (c === '/' && xmpp))) break;
	}
	const last = raw[stop - 1];
	if (periods === 0 || !(isLetter(last) || last === '.')) return -1;
	while (raw[stop - 1] === '.' || raw[stop - 1] === '_') stop--;
	return stop;
}
