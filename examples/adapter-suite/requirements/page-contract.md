# Feature: the editor inside a framework app

Every app in `examples/` that wraps the editor for a framework renders one page, found by test id:
the editor (holding a two-line note), a `mirror` of the value the app holds, a `load` button that
swaps in a second note, a `revert` button that goes back to the last loaded note, a `theme` toggle,
a `drop-theme` toggle that stops passing the theme at all, an `unmount` toggle, and a `header-input` inside the editor's header. `?uncontrolled` renders the
editor from `defaultValue` instead of `value`. Every scenario fails on any console error, page error
or aragonite dev warning.

## Happy paths

- Typing in the editor: the mirror shows the new text.
- Typing a sentence at full speed: every key lands, in order, in both the editor and the mirror.
- Load after typing: the editor and the mirror show the second note, and undo then changes nothing.
- Revert after typing: the editor and the mirror show the loaded note again.
- Theme toggle: the editor's theme flips at once, and undo still takes back typing from before it.

## Edge cases

- Drop theme: the editor goes back to its default theme (dark), and passing it again brings the light theme back.

- Typing in the header input: the input keeps every key, Backspace included, and the document doesn't change.
- Unmount: no editor and no header input are left on the page; mounting again shows the value the app holds.
- One editor on the page, in a dev build too (React's StrictMode mounts the component twice there).
- Uncontrolled: the editor starts on its default note, typing still reaches the mirror, and a re-render (the theme toggle) keeps the typed text.
- The page runs on the React major its project names, so the React 18 project really tests React 18.

## Server rendering (Next)

- The page renders on the server and hydrates with no hydration warning.
- A server component can render the wrapper directly, since the wrapper marks itself a client component.
