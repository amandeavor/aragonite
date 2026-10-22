# Feature: where a test splits undo steps

Typing in one block groups into one undo step until a 250 ms pause. Every e2e navigation holds
that pause, so a spec's own speed never decides the grouping: keys stay one step until the spec
calls `endTypingBatch()`.

## Happy paths

- `abc` typed with 300 ms between keys, one Ctrl+Z: all three go, the block is back to `x`
  (regression #727: on Firefox the driver's per-key latency outran the pause, and one undo left
  `**b**` behind; miss-analysis: every undo spec typed at the runner's speed and trusted it to
  beat the page's timer, so no spec ever typed slower than the pause)
- with the page clock stopped, `a`, `endTypingBatch()`, `b`, then Ctrl+Z twice: `b` goes first,
  then `a` (regression #727: the old helper waited 300 ms of wall time while the page's timer
  could fire late, so the next key joined the batch; miss-analysis: the helper measured the
  runner's clock, never the page's, and no spec stopped the page's timer to check)

## Edge cases

- with the hold released, `a`, then the open batch count reaching 0 on its own, then `b`: one
  Ctrl+Z takes back only `b` (the product's real pause, the one row that runs it)
