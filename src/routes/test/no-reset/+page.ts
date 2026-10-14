import type { PageLoad } from './$types';

// A universal load, so server and client read the same params and hydrate one identical page.
export const load: PageLoad = ({ url }) => ({
	/** The editor's width in px, so a spec can match the editor on another route. */
	width: Number(url.searchParams.get('width')) || null,
	hostContent: url.searchParams.get('hostContent') === 'on'
});
