// The `|WxH@X,Y,Z` size hint an image's label may end in, read and written.
import type { ImageCrop } from '../../nodes';

export const MAX_ZOOM = 4;

// Room for the longest hint, `|10000x10000@100,100,4.00`, plus one.
const HINT_WINDOW = 26;
const HINT =
	/^([1-9]\d{0,4})(?:x([1-9]\d{0,4})(?:@(\d{1,3}),(\d{1,3})(?:,(\d(?:\.\d{1,2})?))?)?)?$/;

export function readSizeHint(alt: string): {
	displayAlt: string;
	width?: number;
	height?: number;
	crop?: ImageCrop;
} {
	const bar = alt.lastIndexOf('|');
	const m = bar >= 0 && bar >= alt.length - HINT_WINDOW ? HINT.exec(alt.slice(bar + 1)) : null;
	if (!m) return { displayAlt: alt };
	const [width, height, x, y] = [m[1], m[2], m[3], m[4]].map((d) =>
		d === undefined ? undefined : +d
	);
	const z = m[5] === undefined ? 1 : +m[5];
	const valid =
		width! <= 10000 &&
		(height ?? 0) <= 10000 &&
		(x ?? 0) <= 100 &&
		(y ?? 0) <= 100 &&
		z >= 1 &&
		z <= MAX_ZOOM;
	if (!valid) return { displayAlt: alt };
	return {
		displayAlt: alt.slice(0, bar),
		width,
		...(height !== undefined ? { height } : {}),
		...(x !== undefined ? { crop: { x, y: y!, z } } : {})
	};
}

export function writeSizeHint(width?: number, height?: number, crop?: ImageCrop): string {
	if (width === undefined) return '';
	if (height === undefined) return `|${width}`;
	if (!crop) return `|${width}x${height}`;
	const zoom = Math.round(crop.z * 100) / 100;
	const tail = zoom === 1 ? '' : `,${zoom}`;
	return `|${width}x${height}@${Math.round(crop.x)},${Math.round(crop.y)}${tail}`;
}
