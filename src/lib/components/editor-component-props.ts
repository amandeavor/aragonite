/** `<Editor>`'s props: the editor's options, plus a header written as a Svelte snippet. */
import type { Snippet } from 'svelte';
import type { EditorOptions } from '../editor-props';

export interface EditorProps extends EditorOptions {
	/** The host's own content above the first block (a title, a tag row), inside the editor's
	 *  scroll container, so it scrolls away with the document. */
	header?: Snippet;
}
