// Reads back the tag `devWarn` writes into a console line, for the watchers that fail a run on one.

const EDITOR_TAG = /\[aragonite:([^\]]+)\]/;

/** Svelte's runtime warnings lead with their code, after any `%c` styling. */
const SVELTE_CODE = /\[svelte\]\s+([a-z0-9_]+)/;

/** The tag a console line carries: the editor's own, or `svelte:<code>` for a Svelte runtime
 *  warning, so one waiver list covers both; null for any other line. */
export function warnTagOfLine(text: string): string | null {
	const tag = EDITOR_TAG.exec(text)?.[1];
	if (tag) return tag;
	const code = SVELTE_CODE.exec(text)?.[1];
	return code ? `svelte:${code}` : null;
}
