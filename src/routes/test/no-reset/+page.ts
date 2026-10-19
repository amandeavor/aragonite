import type { PageLoad } from './$types';

// A universal load, so server and client read the same params and hydrate one identical page.
export const load: PageLoad = ({ url }) => ({
	/** The editor's width in px, so a spec can match the editor on another route. */
	width: Number(url.searchParams.get('width')) || null,
	/** Its height too: a scrollbar that shows on one route and not the other narrows every block. */
	height: Number(url.searchParams.get('height')) || null,
	hostContent: url.searchParams.get('hostContent') === 'on',
	/** Renders the find bar into a slot inside the header, which is host content. */
	findBarInHeader: url.searchParams.get('findBar') === 'header'
});
