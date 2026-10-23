// Raw HTML as CommonMark 0.31.2 reads it, with GFM whitespace inside tags. The tag patterns are
// shared with the HTML block's start condition 7.
import { WHITESPACE_CLASS } from '../../lines';

const ATTRIBUTE_VALUE = `(?:[^"'=<>\`\\x00-\\x20]+|'[^']*'|"[^"]*")`;
const ATTRIBUTE = `(?:${WHITESPACE_CLASS}+[a-zA-Z_:][a-zA-Z0-9:._-]*(?:${WHITESPACE_CLASS}*=${WHITESPACE_CLASS}*${ATTRIBUTE_VALUE})?)`;

export const OPEN_TAG_PATTERN = `<[A-Za-z][A-Za-z0-9-]*${ATTRIBUTE}*${WHITESPACE_CLASS}*/?>`;
export const CLOSE_TAG_PATTERN = `</[A-Za-z][A-Za-z0-9-]*${WHITESPACE_CLASS}*>`;

const TAG = new RegExp(`${OPEN_TAG_PATTERN}|${CLOSE_TAG_PATTERN}`, 'y');

/** Reads raw HTML at the `<` positions of one range, returning where the form ends or 0. Each
 *  terminator search is remembered, so a flood of unclosed openers searches the text once. */
export function rawHtmlReader(raw: string, end: number): (pos: number) => number {
	const found = new Map<string, { from: number; at: number }>();
	const after = (terminator: string, from: number): number => {
		let last = found.get(terminator);
		if (!last || from < last.from || (last.at >= 0 && last.at < from)) {
			last = { from, at: raw.indexOf(terminator, from) };
			found.set(terminator, last);
		}
		const close = last.at + terminator.length;
		return last.at >= 0 && close <= end ? close : 0;
	};
	const fits = (length: number, pos: number) => (pos + length <= end ? pos + length : 0);
	return (pos) => {
		if (raw.startsWith('<!--', pos)) {
			if (raw.startsWith('<!-->', pos)) return fits(5, pos);
			if (raw.startsWith('<!--->', pos)) return fits(6, pos);
			return after('-->', pos + 4);
		}
		if (raw.startsWith('<?', pos)) return after('?>', pos + 2);
		if (raw.startsWith('<![CDATA[', pos)) return after(']]>', pos + 9);
		if (raw[pos + 1] === '!' && /[A-Za-z]/.test(raw[pos + 2] ?? '')) return after('>', pos + 3);
		TAG.lastIndex = pos;
		return TAG.test(raw) && TAG.lastIndex <= end ? TAG.lastIndex : 0;
	};
}
