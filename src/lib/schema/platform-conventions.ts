/**
 * The editor's one read of the platform it runs on: Apple's editing conventions or everyone
 * else's. Cmd+Arrow is Home and End there, and a forward word delete stops at the word's end.
 */

export function usesMacEditingConventions(): boolean {
	return typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
}
