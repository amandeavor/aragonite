// Prerendered so the deployed demo paints its document before the bundle loads; the top bar is
// plain DOM the client mounts. Set per route, never app-wide: the `/test/*` harnesses read
// `url.searchParams` in a universal load, which a build-time render cannot answer.
export const prerender = true;
