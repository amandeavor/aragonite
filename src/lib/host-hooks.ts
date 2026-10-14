/**
 * The hooks a host passes the editor to resolve URLs, import pasted images and run code blocks,
 * and the values those hooks receive.
 */

export type ResolveImageUrl = (rawUrl: string) => string;
export type ResolveLinkUrl = (rawUrl: string) => string;

/** One image file lifted off an image-bearing paste, handed to the host's import
 *  hook. `suggestedName` is the clipboard's filename when it carried one. */
export interface PastedImage {
	blob: Blob;
	mimeType: string;
	suggestedName?: string;
}

/** Host import hook for pasted images: resolves to the markdown to insert, or null
 *  to skip that image. Called once per image file, in clipboard order. */
export type PasteImageHook = (image: PastedImage) => Promise<string | null>;

/** What a code block hands its host when the run button is pressed. */
export interface CodeRunRequest {
	/** The fence body alone; the opener and closer lines are left out. */
	code: string;
	/** The opener's full info string, untrimmed of trailing attributes (`py {1-3}`). */
	info: string;
	/** The info string's first word (`py`), shown as the code block's language; empty for none. */
	language: string;
	/** Child indices from the document root to this block. */
	path: number[];
}

/**
 * Host hook for executing a code block. The editor runs nothing itself: installing this is
 * what puts the run button in the block's side gutter, and the host owns everything after,
 * the runtime, the result, and where output goes. Absent, no run button renders.
 */
export type RunCodeHook = (request: CodeRunRequest) => void;

/** One entry in a code block's overflow menu. `run` is called with the menu already closed. */
export interface CodeMenuItem {
	id: string;
	label: string;
	run: () => void;
	/** Renders dimmed and refuses activation. */
	disabled?: boolean;
}

/**
 * Host hook for the code block's overflow menu, consulted each time the menu opens so the
 * items can read live state. Absent, or returning nothing, renders no overflow button:
 * the editor has no app-level actions of its own to put there.
 */
export type CodeMenuItemsHook = (request: CodeRunRequest) => readonly CodeMenuItem[];
