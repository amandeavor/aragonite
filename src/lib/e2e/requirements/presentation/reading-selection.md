# Feature: selecting and copying with the mouse in reading mode

Reading mode keeps no caret, but the mouse selects there as it does while editing: a Shift+click
grows a range from the last click, and a copy of a range across blocks writes the range's
Markdown, the same text an editing mode copies. Every row runs in reading mode and in source mode,
so the two can't drift apart.

## Happy paths

- **Click, then Shift+click in another block:** the editor holds the range from the clicked point
  to the Shift+clicked one
- **Click, then Shift+click in the same block:** the browser shows the range between them
- **Drag across two blocks, then Mod+C:** the clipboard holds the Markdown of the range
- **Click, then Shift+click in another block, then Mod+C:** the clipboard holds the Markdown of the
  range

## Edge cases

- **Click a divider, Shift+click into the next paragraph, then Mod+C:** the clipboard holds the
  range (the divider and the paragraph's start), not the divider alone, though the divider keeps
  focus

## User interactions

- **The browser's own context menu Copy over a dragged range** (driven as the copy command the menu
  sends): the clipboard holds the Markdown of the range

## Miss-analysis

- Reading mode's copy rows only ever copied a selection inside one block, so the copy handler
  that skipped the editor's own range in reading mode went unseen; no row ran a copy route in
  both modes and compared them.
- The divider's Mod+C wrote the divider whenever it held focus, and only reading mode leaves focus
  there under a range, which no row reached.
