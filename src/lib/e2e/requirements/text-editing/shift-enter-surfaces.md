# Text editing: Shift+Enter in every surface that gives it a meaning

Shift+Enter is a key binding in the paragraph, the code block and the table cell, decided on the
keydown, so it writes the same bytes whichever input event the engine would have sent for it.
A soft keyboard's `insertLineBreak` with no keydown runs the same command. Each row breaks `abcd`
after `ab` and types `Z`.

## Happy paths

- a paragraph: a hard break, `ab\` then `Zcd` on the next line
- a code block: a newline with no indent, `ab` then `Zcd` on the next line
- a table cell: a `<br>`, `ab<br>Zcd`

## Edge cases

- a beforeinput `insertLineBreak` with no keydown, as a soft keyboard sends it, writes the same
  break in each surface
- a beforeinput `insertLineBreak` that arrives while the Shift+Enter keydown's handler still runs
  (the order Playwright's Firefox fires them in) writes nothing more: one break, not two

## Miss-analysis

- Engine census R3: the code block and the table cell recognised a soft break only by its
  `insertLineBreak` input, and Playwright WebKit sends `insertParagraph` for Shift+Enter, so the
  key was dropped; every Shift+Enter row ran in Chromium, which sends `insertLineBreak`. The
  paragraph swallowed a keydown-less `insertLineBreak` with no write, and no row sent one.
