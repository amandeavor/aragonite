# Presentation: Shift+Enter at the end of a block

Shift+Enter at the end of a block opens an empty line under the text, with the caret on it, in
every mode that edits. Nothing is written yet. A hard break in Markdown is a backslash at the end
of a line, and a backslash with no next line is just a backslash, so the break's bytes go in with
the first thing that lands on the new line, whichever way it arrives. Anything else (a click
elsewhere, a caret key that takes the caret off the line, the block losing focus) drops the line
and leaves the bytes alone.

Miss-analysis: the break used to be written straight away as a trailing backslash and read back
from the bytes, and every test typed a letter after it through the key route. So nobody saw that a
backslash typed by hand reads as a break (#522), that punctuation, a paste or an IME commit wrote
an escape instead, or that a second Shift+Enter escaped the first one and sent the caret back up
(#614).

## Happy paths

- `abc def`, End, Shift+Enter twice, then `x`: nothing is written until the `x`, which lands on the
  third line, `abc def\` / `\` / `x`. Source and live mode.

The other ways in write the break the same way: a punctuation key (`abc\` / `-`, not an escape), a
paste and an IME commit, in source and live mode. Unit tests cover those, in
`src/lib/test/blocks/text/pending-break-spend.test.ts`. The composed rows after a hidden closer,
further down, still drive a real composition.

## Edge cases

- `see C:`, End, type `\` then `U`: `see C:\U`. A typed backslash is a backslash. Source and live
  mode.
- live, `a **bold**`, `an *it*` and `` via `code` ``, Shift+Enter at the end, then an IME commit
  of `か`: the line stays drawn while you compose, and the run starts it (`a **bold**\` / `か`),
  outside the construct. Miss-analysis: every composed row ran on a plain paragraph, where the
  composition lands on the right side of the text whether the line is drawn or not.
- Caret keys on the open line have their own file, `pending-break-keys.md`.
- live, `abc def`, Shift+Enter at the end, `x`, Backspace: the line under the text stays open with
  the caret on it, and the break's bytes go with the `x`, so the source is `abc def` again. The
  next letter writes the break in front of itself, same as after a fresh Shift+Enter, and another
  Backspace takes the line. Same in a list item followed by another item, in a quote, and in the
  last block of a file that has no line ending after it.
  Miss-analysis: #733, the emptied line was kept as `abc def\` plus an empty line, which a reload
  reads as a literal backslash, and every row checked the bytes against the screen, never against
  a reload.
- The same in a list item followed by another, then a blur: nothing's left behind,
  `- abc def` / `- next`.
- `abc\` / `xy`, the `xy` selected with Shift+Home and cut: the source is `abc`, the line stays
  open with the caret on it, and `q` writes `abc\` / `q`. Source and live mode. Miss-analysis: the
  line was reopened only by the key route's write, and every row emptied it with Backspace, so a
  cut, which writes the block's text another way, dropped the line and sent the `q` up a line.
  The no-line-ending row above was missed the same way: every row's block had a line ending to
  take off, so a file without one kept the `\`.

## User interactions

- Shift+Enter at the end, then a click in another block: the source is unchanged and the first
  block draws no extra line. Source and live mode.
- A list item followed by another, with that emptied line still under `abc def`: ArrowUp leaves
  it and drops it, like any open line, so ArrowDown from `abc def` then goes on to the next item.
  Source and live mode.
