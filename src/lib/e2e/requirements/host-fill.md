# Feature: the editor fills the box it's mounted in

`/test/host-fill` mounts a 300-paragraph document in a plain block box (no flex layout), through
the Svelte component (`?host=svelte`) or `createEditor` (`?host=create-editor`). `?height=` gives
the box a height in px; without it the box takes its content's height. The React and Vue wrappers
hold the same rule in the adapter suite (`examples/adapter-suite/requirements/host-fill.md`), since
no one app runs all four.

Miss-analysis: every test page put the editor in a flex column, where `flex: 1` sized it, so no
test ever gave it a plain box with a height; the React and Vue wrappers mount into exactly that.

## Happy paths

- A host with a fixed height and a long document: the editor's scroll container is no taller than
  the host, a wheel over it scrolls the editor and not the page, and fewer blocks are mounted than
  the document holds (windowing is on). Counted by mounted blocks: the root's `data-windowing`
  reads `active` even when every block fits.

## Edge cases

- A host with no height: the editor grows to its whole document, the host grows with it, and the
  page scrolls instead.
- Host scroll mode in a sized box that scrolls (`?scroll=host`): the editor grows to its whole
  document, a wheel over the box scrolls the box and not the page, and windowing is on.
