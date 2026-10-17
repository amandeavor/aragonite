# Feature: inline-math clipboard during an active source reveal

A cut or a paste fired while an inline-math widget is showing its editable `$…$` source closes
that source first, then runs against the rendered block. Keys typed into the source are written as
they land, so the tree already agrees with the screen; what closing guards is the caret, which a
paste would otherwise read off a source the re-render is about to replace.

Copy is the other half of the same rule: it must never change anything, so it closes nothing and
copies the bytes the user selected, the typed edit included.

## Happy paths

- show, type, paste: enter the math source, type two characters, paste one. The serialized
  source carries the shown edit and the pasted character, with the math delimiters intact.
- show, type, copy: enter the math source, type two characters, select the edit and copy. The
  clipboard carries the typed text, the source stays open, and the document holds the edit.

## Edge cases

- typing survives the paste: a character typed after the paste reaches the tree.

## User interactions

- ArrowLeft into `$x^2$` to show the source, keyboard typing, a synthetic paste event, keyboard
  typing again, then read the serialized source.

## Error cases

- the regression this guards: a paste that lands inside a source the re-render replaces drops
  the edit or the typing after it, so the serialized source would be missing one of them.
