# @voithos-labs/aragonite-react

[aragonite](https://github.com/voithos-labs/aragonite), the Markdown block editor, as a React component. You hand it Markdown, edit it as styled blocks with the markers dimmed, and read plain Markdown back, no in-between format.

Works with React 18 and 19, StrictMode and Next included.

## Install

The component sits on the core package and releases with it, at the exact same version, so install both:

```bash
npm install @voithos-labs/aragonite @voithos-labs/aragonite-react
```

## Use it

```tsx
import { useRef, useState } from 'react';
import { Aragonite, type EditorHandle } from '@voithos-labs/aragonite-react';
import '@voithos-labs/aragonite/style.css';
import '@voithos-labs/aragonite/styles/editor-theme.css';

function Note() {
	const [text, setText] = useState('# Grocery list\n\n- eggs\n- more eggs\n');
	const editor = useRef<EditorHandle>(null);

	return (
		<Aragonite ref={editor} value={text} onChange={setText} theme="light" style={{ height: '70vh' }} />
	);
}
```

- `value` and `onChange` keep the document in your state, or pass `defaultValue` and skip the state.
- Every other prop is an editor option (`theme`, `presentationMode`, `plugins`, and the rest).
- `header` takes a React node to show above the first block.
- The ref holds the editor's handle (`getSource()`, `runCommand()`, `getEvents()`, ...), `null` until it mounts.
- In Next, import the two stylesheets in your root layout. The component is marked `'use client'`, so a server component can render it.

## More

The [consumer guide](https://github.com/voithos-labs/aragonite/blob/main/docs/guide/consumer-guide.md#react) has the rest: every prop, the handle's methods, events, theming, and which plugins run outside a Svelte app. It also ships in `node_modules/@voithos-labs/aragonite/docs/guide/`, matching the version you installed.

## License

[MPL-2.0](LICENSE)
