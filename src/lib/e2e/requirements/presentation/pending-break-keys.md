# Presentation: caret keys on the line Shift+Enter opened

While the line Shift+Enter opened at a block's end is open, the caret is drawn on that empty line,
so a caret key moves from there, the way it would from any empty last line. Once the caret leaves
the line, the line goes, and nothing was written. Backspace and ArrowLeft are the two keys that
take the line back: they drop it and leave the caret at the end of the text above.

Miss-analysis: the first version ended the line before the key ran, so every key moved from the
text's end on the line above. The rows only tried Backspace and ArrowLeft, the two keys where that's
the right answer.

Miss-analysis: Shift+Backspace and a soft keyboard's delete on the open line took the last letter
of the text above, since the rows pressed only a plain Backspace, the one delete the key handler
took itself.

Miss-analysis: a keyed Delete on the open line ended it and then joined the next block, since the
delete rows pressed only Backspace by key and Delete only as a soft keyboard.

## User interactions

Each row is `first` / `abc` / `next`, Shift+Enter at the end of `abc`, the key, then `z`, in source
and live mode.

- ArrowUp goes up to the start of `abc`, and the line is gone before the next key: `zabc`, no
  break.
- ArrowDown goes to the start of `next` (the empty line's column is 0): `znext`.
- ArrowRight leaves the block for `next`: `znext`.
- Home and End stay on the open line, so `z` lands there: `abc\` over `z`.

## Edge cases

- live, `a **bold**`: ArrowRight leaves the block the same way (`znext`); a mark's edge has no
  stop to take it, and the caret isn't at the closer while the line is open anyway.
- live, `a **bold**`: ArrowLeft drops the line and stops at the end of `bold`, where a key types
  inside the bold like after a click: `a **boldz**`.
- source, an empty paragraph after `first`: ArrowLeft drops the line and stays in the paragraph,
  rather than moving up to `first` the way ArrowLeft at a block's start does: `z` on its own.
- Shift+Backspace, Delete, Ctrl+Delete, and a soft keyboard's Backspace or Delete (the
  `beforeinput` alone), take the line like Backspace and leave the text above whole: `abcz`, in
  source and live mode. The open line holds no bytes, so Delete never joins `next` to `abc`.
