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

## User interactions

- the key: Backspace or Delete pressed once
- a soft keyboard: a cancelable `deleteContentBackward` or `deleteContentForward` with no keydown
- a soft keyboard naming one character as its range: the editor takes it
- a soft keyboard naming more than one character (here a whole entity): the editor writes nothing and
  leaves the keyboard's own edit to the browser (skipped on WebKit, which drops the range a script
  gives an event)

## Error cases

- zero `[invariant:…]` console fires across every row (automatic via the shared e2e fixture); the
  collapsed-delete check (G1.132) fires if a surface lets the browser's own delete through

## Miss-analysis

- Every delete row pressed a key in Chromium alone, whose own delete takes an emoji and a CRLF pair
  whole, so Firefox's split ZWJ family, WebKit's half pair and a soft keyboard's delete (which no
  keydown arm sees) had no row.
