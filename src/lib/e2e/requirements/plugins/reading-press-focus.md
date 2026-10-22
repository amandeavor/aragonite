# Feature: a reading-mode press beside the text focuses its block

Reading mode has no caret, and its blocks aren't editable, so the browser's own focus on a press
goes to the nearest focusable element. A press on a block's text focuses that block. A press on
anything around the text (a block's padding, a quote's bar, a list's marker cell, the editor's
gutter, the room below the last block) runs the same walk a press there runs while editing, and
the block that walk picks takes focus instead of a caret, so it becomes the editor's tab stop.

The document is the reading-keyboard one: one block of every leaf kind, loaded in reading mode.

## Happy paths

- **A quote's bar:** the quote's line is focused and is the only block tab stop, with no caret
- **A list item's marker cell:** the first item's line is focused
- **A list's bottom padding:** the last item's line is focused
- **A details block's side:** its summary is focused
- **An admonition's bottom padding:** its body paragraph is focused
- **A footnote definition's side:** the definition's text is focused
- **A code block's bottom padding:** the code block is focused
- **The editor's gutter beside a paragraph:** that paragraph is focused
- **Just below the last block:** the last block's text is focused

## Edge cases

- **Beside a table's cells, or below a diagram:** a block with no line of text takes only a press
  on its content, as while editing, so the press focuses no block and the stop stays on the block
  clicked before

## User interactions

- **Tab after a press on an admonition's padding:** the walk starts at the admonition's body and
  visits exactly the controls after it, then leaves the editor
- **A drag from a quote's bar across its text:** the browser's selection of that text stays, and
  no caret is left
- **A press on a quote's bar, then leaving reading mode and typing:** the letter lands at the
  start of the quote's line

## Error cases

- Every press row asserts the editor's error channel stayed empty

## Miss-analysis

- Every reading-mode click row pressed a block's text or its own focus element, never the padding
  or chrome around it, so a press there focusing the editor itself (and Tab then starting from the
  top) went unseen (#763).
