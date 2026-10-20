/**
 * The editor's one source of text units: grapheme clusters and words, by the Unicode segmentation
 * rules every engine ships in `Intl.Segmenter`. Null where a platform has no segmenter.
 */

let graphemes: Intl.Segmenter | null | undefined;
let words: Intl.Segmenter | null | undefined;

function create(granularity: 'grapheme' | 'word'): Intl.Segmenter | null {
	return typeof Intl.Segmenter === 'function'
		? new Intl.Segmenter(undefined, { granularity })
		: null;
}

export function graphemeSegmenter(): Intl.Segmenter | null {
	if (graphemes === undefined) graphemes = create('grapheme');
	return graphemes;
}

export function wordSegmenter(): Intl.Segmenter | null {
	if (words === undefined) words = create('word');
	return words;
}
