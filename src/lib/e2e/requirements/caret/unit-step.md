# Caret: one press crosses a span the caret can't stop inside

A decoded entity, a plugin emoji, a replace decoration and a CRLF line ending each read as one
character to the arrow keys. One press of ArrowRight or ArrowLeft carries the caret from one edge to
the other, and Shift extends the selection across the same span. The editor decides the step on
the keydown, so WebKit and Firefox land where Chromium does. Each row starts at the span's near
edge and leaves the source unchanged.

## Happy paths

- `a&copy;b`, caret at 1: ArrowRight lands at 7, ArrowLeft back at 1, then two ArrowRights land at 8
- the emoji seed's `Mood :smile: today`, caret at 5: the same walk over `[5, 12)`
- `abHIDDENcd` under a replace decoration over `[2, 8)`, caret at 2: the same walk, the decoration
  never selected
- a table cell `a&copy;b`, caret at 1: the same walk over `[1, 7)`
- `abc\r\nAfter\r\n`, caret at 3: ArrowRight lands at 5 on the next line, ArrowLeft back at 3
- a code body `abc\r\nxyz`, caret at the end of `abc`: the same walk over the pair

## User interactions

- Shift+ArrowRight from the near edge selects the whole span; Shift+ArrowLeft takes it back to a caret
- ArrowRight to the far edge, then Shift+ArrowLeft: the selection runs back across the whole span

## Miss-analysis

- Engine census R2: every step-over row ran in Chromium, whose native arrow already crosses a
  non-editable widget and a CRLF pair in one press. WebKit stepped one character past a widget,
  and WebKit and Firefox stopped between `\r` and `\n`, and no gating run used either engine.
