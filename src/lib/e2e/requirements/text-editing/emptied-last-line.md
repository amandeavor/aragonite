# Feature: A last line erased to nothing

Backspace through a block's last line leaves its line break standing and the caret on the empty line after it; the next key belongs on that line.

## Edge cases

- `Plan\nmore\n`, End on `more`, Backspace four times, then `x`: the source is `Plan\nx\n` in source mode (regression: `Planx\n\n`, the key landed before the break; miss-analysis: the plain-text and code blocks give the empty last line a caret anchor, and no prose test typed on a line its own text left empty)
- The same keys in live mode: `Plan\nx\n`
- `Plan\nmore\n\nnext\n`, End on `more`, Backspace four times: the source is `Plan\n\nnext\n`, the emptied line stays `Plan`'s and `next` reloads as the second of two blocks (regression #632: `Plan\n\n\nnext\n`, which reloads with a blank block nobody typed; miss-analysis: every erase test emptied a block with nothing below it, so no row had a blank line under the erased one)
- One more Backspace after that: still `Plan\n\nnext\n`, the blank line goes back to separating `next`, which stays a paragraph of its own
- The same keys in live mode
