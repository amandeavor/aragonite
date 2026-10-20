# Feature: reading mode has no caret

Reading mode draws no caret and keeps none. A click focuses the block it lands on (which becomes
the editor's one tab stop, `requirements/plugins/reading-keyboard.md`) and clears the caret the
browser puts down, so every engine starts Tab from the block; the clicked point is noted first,
so leaving reading mode puts the caret back there.

## Happy paths

- **A click on a word:** focus is on the word's block, the browser holds no caret in the editor,
  and `getSelection()` is null
- **Leaving reading mode after a click:** a letter typed in source mode lands at the clicked
  point (the start of the clicked word)

## User interactions

- **A double click** still selects its word, for copy
- **Shift+click after a click** selects nothing, since there's no caret to extend from; focus moves
  to the block it landed on (a pinned delta: keyboard and Shift+click selection are gone in
  reading mode, while a drag, a double click and select-all still select)

## Miss-analysis

- No row typed after leaving reading mode from a click, so a caret put back at the block's start
  instead of the click read as fine.
