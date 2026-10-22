# Feature: Unclosed-fence auto-close on structural escape

Leaving an unclosed fenced code block with Enter, to write a new block below it, adds the
closing fence to the code node's raw text, so the live tree matches what a reload gives
(GFM's lazy continuation no longer pulls the blocks below into the open fence). The close
and the new block arrive as one undo entry.

## Happy paths

- escape below an unclosed fence closes it: type into an unclosed fence, Enter past the
  trailing blank line to a new paragraph, type text, and the source gains a closing fence
  line before the new block, with `parseConverged()` holding
- the closed fence and the new paragraph are distinct live blocks that survive a reparse
  (block count is stable across serialize→parse)
- escaping a nested fence stays inside its container: a fence inside a blockquote auto-closes
  within the quote and the new paragraph lands inside it, the container's raw text rebuilds
  cleanly, and `parseConverged()` holds
- a fence opener typed on a block that has blocks below it is closed as it is created: the
  neighbours stay their own blocks, `parseConverged()` holds, and the caret is still on the
  opener line so the next keystrokes reach the info string
- a fence opener typed right above a code block, with or without a language, closes as it is
  created, and the code block below stays whole (miss-analysis: the rows typed above a paragraph
  or a bare-fenced block, never above one whose closer is the first line that could close the
  typed fence)
- a fence typed on its own line gets its own closer whatever fences sit further down: typed above
  a bare-fenced block with another fence below it, the bare block and the one below stay whole
  (miss-analysis: no fresh-fence row had a second fence further down, so a rule that read to the
  end of the document passed them all)

## Edge cases

- undo is atomic: one Ctrl+Z after the escape restores the open fence and removes the
  created paragraph together (a single entry, not two)
- a fence that is already closed does not gain a second closer on Enter-exit (the
  closed-fence exit path is untouched)
