# Feature: reading mode has no caret

Reading mode draws no caret and keeps none. A click focuses the block it lands on (which becomes
the editor's one tab stop, `requirements/plugins/reading-keyboard.md`) and clears the caret the
browser puts down, so every engine starts Tab from the block; the clicked point is noted first,
so leaving reading mode puts the caret back there. The arrows step from block to block, since
there's no caret to move inside one.

## Happy paths

- **A click on a word:** focus is on the word's block, the browser holds no caret in the editor,
  and `getSelection()` is null
- **Clicks, heard by a host:** `selectionChange` reports no caret for any of them, and a host
  listening for `focusin` and `focusout` around the editor hears nothing from a click in the block
  that already holds focus
- **Leaving reading mode after a click:** a letter typed in source mode lands at the clicked
  point (the start of the clicked word)
- **ArrowDown from a click:** focus steps to the next block each press, a wrapped paragraph
  included, then into a table's first cell and down its rows; no caret is left behind
- **A table cell:** ArrowRight, ArrowDown and ArrowLeft step through the grid with no caret, and
  ArrowDown from the last row leaves the table for the next block

## Edge cases

- **A click, then an arrow, then leaving reading mode:** the caret goes where the arrow entered
  the block it reached (the start after ArrowDown, the end after ArrowUp), not to the clicked point
- **The find bar opened and closed after a click:** Escape hands focus back to the clicked block
  with no caret, and leaving reading mode then puts the caret at the clicked word
- **After Tab lands on the stop** (no click, no caret): ArrowRight and ArrowLeft still step
- **The stop follows the arrows:** after two ArrowDowns, Tab in from a host button lands on the
  block they reached
- **A block taller than the editor:** ArrowDown into it focuses it showing its first line, then
  each ArrowDown scrolls it by about a line until its end shows, and the next steps on

## User interactions

- **A double click** still selects its word, for copy
- **Shift+click after a click** selects from the clicked point to the Shift+click, as it does
  while editing, and still draws no caret (Shift+Arrow selects nothing, since there's no caret to
  move; `requirements/presentation/reading-selection.md` has the rest of the mouse's selection)
- **Backspace and Shift+Backspace after a click** do nothing: the page stays (WebKit would go back
  in history), focus stays on the clicked block and the document is unchanged

## Error cases

- Every arrow row asserts the browser holds no caret afterwards

## Miss-analysis

- Every reading-mode arrow row moved between one-line blocks from a click's caret, so a wrapped
  paragraph that kept ArrowDown forever, and a block focused by Tab that no arrow moved, never ran.
- No row typed after leaving reading mode from a click, so a caret put back at the block's start
  instead of the click read as fine.
- The click rows read `getSelection()` after the click, never what `selectionChange` said during
  it, and Chromium reports the click's caret only once it's cleared, so the caret Firefox and
  WebKit announced went unseen; no row listened for focus events around the editor either.
- The Shift+click row pinned what the browser did once the click's caret was cleared, so it
  encoded the lost selection as the contract; no row compared reading mode's mouse selection with
  an editing mode's.
- No row pressed Backspace in reading mode on WebKit, the one engine whose default for it leaves the
  page.
- No row opened an overlay in reading mode after a click, so the overlay restore that read no
  caret, and dropped focus to the editor's root, went unseen.
