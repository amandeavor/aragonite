'use client';
/**
 * The aragonite editor as a React component. Each render hands every prop to the editor's
 * `update`, so a changed prop lands live and an unchanged one costs nothing.
 */

import {
	forwardRef,
	useEffect,
	useImperativeHandle,
	useLayoutEffect,
	useRef,
	useState,
	type CSSProperties,
	type ReactNode
} from 'react';
import { createPortal } from 'react-dom';
import { createEditor, type CreateEditorOptions, type EditorHandle } from '@voithos-labs/aragonite';

// ── Public API ──────────────────────────────────────────────────────────────

/** The editor's options, with the document as `value` or `defaultValue` and the header as a node. */
export type AragoniteProps = Omit<CreateEditorOptions, 'source' | 'header'> & {
	/** The document. A value other than the editor's current text loads as a new document, clearing
	 *  undo; the text `onChange` just reported is the current text. */
	value?: string;
	/** The document to start with when `value` isn't passed. */
	defaultValue?: string;
	/** Called with the whole document after each edit, undo and redo included; never for a load. */
	onChange?: (value: string) => void;
	/** Shown above the first block, inside the editor's scroll container. */
	header?: ReactNode;
	className?: string;
	style?: CSSProperties;
};

/** Mounts the editor on the client; the ref is its handle once mounted, `null` before. */
export const Aragonite = forwardRef<EditorHandle, AragoniteProps>(function Aragonite(props, ref) {
	const target = useRef<HTMLDivElement>(null);
	const editor = useRef<EditorHandle | null>(null);
	const latest = useRef(props);
	const sentKeys = useRef<string[]>([]);
	const [headerHolder, setHeaderHolder] = useState<HTMLElement | null>(null);

	useClientLayoutEffect(() => {
		latest.current = props;
	});

	useClientLayoutEffect(() => {
		const holder = document.createElement('div');
		const options = editorOptions(latest.current, holder);
		const { value, defaultValue } = latest.current;
		const handle = createEditor(target.current!, { ...options, source: value ?? defaultValue });
		handle.getEvents().on('edit', () => latest.current.onChange?.(handle.getSource()));
		editor.current = handle;
		sentKeys.current = Object.keys(options);
		setHeaderHolder(holder);
		return () => {
			handle.destroy();
			editor.current = null;
		};
	}, []);

	// Null until the mount effect above has run, which it has by the time a parent's effects do.
	useImperativeHandle(ref, () => editor.current as EditorHandle, [headerHolder]);

	useClientLayoutEffect(() => {
		if (!editor.current || !headerHolder) return;
		const options = editorOptions(props, headerHolder);
		// A prop the parent stopped passing goes back to its default, as with any React prop.
		for (const key of sentKeys.current) if (!(key in options)) options[key] = undefined;
		sentKeys.current = Object.keys(options);
		editor.current.update(options);
	});

	return (
		<div ref={target} className={props.className} style={props.style}>
			{headerHolder && props.header != null && createPortal(props.header, headerHolder)}
		</div>
	);
});

// ── Internal ────────────────────────────────────────────────────────────────

// The server has no layout pass, and React warns about a layout effect there.
const useClientLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

// The props only React has; every other prop is the editor option of the same name.
const REACT_ONLY_KEYS = ['value', 'defaultValue', 'onChange', 'className', 'style'] as const;

/** The editor's options from the props. `source` is `value`, which an uncontrolled editor leaves
 *  `undefined`, and the editor reads that as no new document. */
function editorOptions(props: AragoniteProps, headerHolder: HTMLElement): Record<string, unknown> {
	const options: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(props)) {
		if (!(REACT_ONLY_KEYS as readonly string[]).includes(key)) options[key] = value;
	}
	options.source = props.value;
	options.header = props.header == null ? null : headerHolder;
	return options;
}

// Every other prop is an editor option, and no option hides behind a React-only name (G3.12);
// `npm run package` fails to compile the wrapper otherwise.
type ReactOnlyKey = (typeof REACT_ONLY_KEYS)[number];
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
type Holds<T extends true> = T;
type _PropsCheck = [
	Holds<
		Same<Exclude<keyof AragoniteProps, ReactOnlyKey>, Exclude<keyof CreateEditorOptions, 'source'>>
	>,
	Holds<Same<Extract<keyof CreateEditorOptions, ReactOnlyKey>, never>>
];
