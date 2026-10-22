# Feature: Editing a code block's fence lines where the mode paints them

A code block's fence lines (the opening ` ```js ` line and the closing ` ``` ` line) are editable
text wherever the mode paints them: always in source mode, and on the focused block in the
preview modes. A caret arriving from another block still lands in the body; a click or an arrow
inside the block reaches the fence lines.

One stray keystroke on a fence line can break the fence. A closer that stops matching would leave
the block open, so the fence write rule puts a closer back. An opener that stops matching strands
the closer, which stays: it opens a fence over everything below, as a reload of the same bytes
reads it, and putting the opener back closes it again.

Where the mode hides the fence lines, edits clamp to the body instead: `fence-ranged-edit.md`.

## Happy paths

- a selection inside the info string is edited verbatim: typing over `js` writes `py`
- a delete from the body into the closer lands; the closer comes back on a line of its own, the
  paragraph below stays a paragraph, and undo restores the block byte-for-byte

## Edge cases

- Backspace inside the closer run: the shortened run becomes a body line and a full closer
  follows it, so the block stays closed
- a character typed at the opener's offset 0, 1 or 2, or Backspace after its first, second or
  third backtick: the block demotes to a paragraph, the closer and every byte below it stay, and
  the old closer opens a fence over the paragraph below (miss-analysis: the Backspace row pinned
  the closer's drop as intended, and no check compared the bytes a write rule kept against the
  bytes the edit left alone)
- the same keystroke through an IME composition keeps the same bytes
- a backspaced opener backtick typed back restores the document byte for byte: an opener typed
  back onto its body takes the closer still flush beneath it instead of writing a second one. An
  opener over an empty body has nothing to tell it from a fresh fence, so it gets a closer of its
  own, and one undo takes the backtick back
- a backtick typed right after the opener's marker run widens the fence: the closer grows by
  the same backtick, so the block stays closed (miss-analysis: every opener edit here deleted or
  replaced, and the unit case for this keystroke pinned the dropped backtick as intended)
- on a bare opener the typed backtick widens the fence by one, not two: nothing after the run
  invites the auto-pair, which only pairs inside the body (miss-analysis: the widen case above
  had an info string after the run, which kept the auto-pair from firing)
- a backtick pasted right after the opener's marker run widens the closer the same way, instead
  of leaving the old closer behind as a body line (miss-analysis: the widening was pinned for
  typing only, and a paste writes through the rule's other mode)
- paste over the closer: the pasted text lands and a closer follows it
- an unclosed fence has no closer to strand, so deleting its marker run turns it back into a
  paragraph, byte-for-byte: that's how a just-typed ` ``` ` is taken back

## User interactions

- ArrowUp from the body's first line reaches the opener; End and a typed character extend the
  info string (`js` becomes `jsx`)
- the preview modes take the same edit on the focused block, where they paint its fence lines
  (miss-analysis: every fence edit test ran in source mode against a clamp that held in every
  mode, and no test ever put an edit on a painted fence line)
