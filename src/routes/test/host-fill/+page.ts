import type { PageLoad } from './$types';

// A universal load, so server and client read the same params and hydrate one identical page.
export const load: PageLoad = ({ url }) => ({
	/** How the editor mounts: the Svelte component, or `createEditor` into an element. */
	host: url.searchParams.get('host') === 'create-editor' ? 'create-editor' : 'svelte',
	/** The host's height in px; none leaves it to its content. */
	height: Number(url.searchParams.get('height')) || null,
	/** `scrollMode="host"`, with the box as the scroller. */
	hostScroll: url.searchParams.get('scroll') === 'host'
});
