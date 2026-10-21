# Text editing: a collapsed delete takes the same bytes on every engine

A Backspace or Delete at a caret inside a line is written by the editor, not by the browser, so
Chromium, Firefox and WebKit take the same bytes. Every row runs twice: once by the key, once as a
soft keyboard sends it (the `beforeinput` alone, no keydown). Each row checks the source, the caret
after the delete, and that one undo puts both back.

## Happy paths

- `ab` + a ZWJ family + `c`, Backspace after the family: `abc`, caret after `b`
- the same text, Delete before the family: `abc`, caret after `b`
- `a` + a keycap + `b`, Backspace after the keycap: `ab`, caret after `a`
- a paragraph in a CRLF document, Backspace at the second line's start: the lines join, the pair
  goes whole
- the same, Delete at the first line's end: the lines join, the pair goes whole
- `a&copy;b`, Delete before the entity: `ab`

## Edge cases

- `x`, `e` + a combining acute, `y`: Backspace after the cluster takes the accent only (`xey`);
  Delete before it takes the cluster whole (`xy`)
- `a\` + line break + `b` in source mode, Backspace at `b`: the line ending goes, the shown `\` stays
  (`a\b`)
- live mode, `**ab**c`, Backspace before `c`: the `b` inside the hidden closer goes (`**a**c`)
- live mode, `# H #`, Backspace after `H`: an empty paragraph, the hidden markers gone with the text
- `- a`, Backspace after `a`: the empty item `- `
- a quote child, Backspace after a ZWJ family: the family goes whole
- a table cell, Backspace after a ZWJ family: the family goes whole
- a code block, Backspace after a ZWJ family: the family goes whole; in live mode, with the fence
  lines hidden, Delete before it does the same
- a code block, Backspace inside an empty `()`: both halves go

## A CRLF line end reached by the keyboard

End and Home leave the caret wherever each engine puts it at a CRLF line end; the delete still edits
the pair as one character. In source and live mode, from `abc\r\nAfter\r\n`:

- End, Delete: `abcAfter\r\n`, the pair deleted whole
- End, Backspace: `ab\r\nAfter\r\n`, the letter before the pair deleted, the pair kept
- ArrowDown, Home, Backspace: `abcAfter\r\n`, the pair deleted whole
- a code block with the body `abc\r\nxyz`, End on the first body line, Backspace: the body reads
  `ab\r\nxyz`

## Any delete at a block's edge

A delete of any unit at a block's start (Backspace) or end (Delete) does what the plain key does
there: it runs whatever plain Backspace or Delete binds, the merge unless the host rebound it.
Each row presses the plain key, then the same edge again by each route, and the source and the
caret come out the same. The routes: a soft keyboard (the `beforeinput` alone), the word chord
(Ctrl+Backspace, Option on a Mac), Shift+Backspace, and the Mac's Option word delete and Cmd line
delete (a keydown with the modifier, then the input it opens, since those chords only exist on a
Mac):

- `abc` / `next`, Backspace at the start of `next`, and Delete at the end of `abc`
- `- a` / `- b`, Backspace at the start of `b`
- `x` / `> q`, Backspace at the start of `q`
- live mode, `**bold**` / `next`, End, then Delete: either side of the hidden closer is the
  paragraph's end, so both routes merge
- live mode, `para` / `# Title`, Backspace at the heading's start: the heading becomes a paragraph
- `abc` / a code block, Backspace at the code block's start: the caret steps out to the end of
  `abc`, the bytes kept

And beside those:

- a soft keyboard's merge is one undo
- `abc` / `next`, Backspace at the start of `next` after the keydown Android's keyboards send
  first (`Unidentified`, key code 229): `abcnext`
- Shift+Backspace and the word chord at a live `# Title`'s start, then `x`: `xTitle`, the marker
  gone whole, never the `#Title` the browser's own delete leaves
- the word chord at a table cell's start moves to the end of the cell before, as Backspace does

A soft keyboard's delete at a table cell's edge does nothing: a cell binds no Backspace, and its
key moves focus at keydown.

## Shift+Backspace

Shift+Backspace is Backspace on every OS, so it takes what Backspace takes (key only):

- `a&copy;b`, after the entity: `ab`
- live mode, `**ab**c`, before `c`: `**a**c`
- after an image: the image is selected, its bytes kept

## User interactions

- the key: Backspace or Delete pressed once
- a soft keyboard: a cancelable `deleteContentBackward` or `deleteContentForward` with no keydown
- a soft keyboard naming one character as its range: the editor takes it
- a soft keyboard naming more than one character (here a whole entity): the editor writes nothing and
  leaves the keyboard's own edit to the browser (skipped on WebKit, which drops the range a script
  gives an event)
- the same, after the keydown Android's keyboards send first (`Unidentified`, key code 229): still
  the keyboard's own edit, since that keydown names no Backspace
- the same, right after a Backspace the editor took at its keydown (an entity deleted whole): still
  the keyboard's own edit, since that key fired no input of its own

## Error cases

- zero `[invariant:…]` console fires across every row (automatic via the shared e2e fixture); the
  collapsed-delete check (G1.132) fires if a surface lets the browser's own delete through

## Miss-analysis

- Every delete row pressed a key in Chromium alone, whose own delete takes an emoji and a CRLF pair
  whole, so Firefox's split ZWJ family, WebKit's half pair and a soft keyboard's delete (which no
  keydown arm sees) had no row.
- A keyboard's wide delete right after a key the editor took at its keydown was decided as one
  character: the soft keyboard rows each started on a fresh page, so no row followed a key.
- End, Backspace joined the two lines of a CRLF paragraph in WebKit and Firefox: the rows deleted at
  a line end only with Delete, whose read-back is the same bytes as a Backspace from inside the
  pair, so no row asked which of the two the user pressed.
- A soft keyboard's Backspace at a block's start did nothing once the editor took the delete: every
  edge row pressed the key, whose merge runs at keydown.
- Shift+Backspace at a live heading's start took the space of `# ` in Firefox: the edge decline
  let the browser's delete run for any key, and no edge row pressed a chord over a hidden marker.
- A word, line or Shift delete at a block's edge did nothing, and a soft keyboard's did nothing in
  a code block: every edge row pressed the plain key, whose binding runs at keydown, and the soft
  keyboard rows ran in prose only, whose merge was wired by hand.
