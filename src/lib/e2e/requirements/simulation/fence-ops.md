# Feature: A typo on a fence opener (simulation)

A loaded-ops session over three fenced code blocks in a row, the second with a bare opener. A
typo on a code block's opener leaves its closer behind, and that closer pairs with whichever
fence further down a reload pairs it with, which can move every pairing below it. The
simulation's checkpoints (the console watcher, the live round-trip, parse convergence) hold the
live tree to the reload's reading at each step.

## Happy paths

- Backspace after the first opener's third backtick keeps every byte, and the stranded closer
  takes the bare opener below as its closer, so the rest of the document pairs anew; the tree
  reads as its reload (miss-analysis: no gesture broke an opener with another fence below, so
  the settle's one-block merge window was never asked to re-pair across blocks)
- the backtick typed back restores the source byte for byte, and the tree reads as its reload
  again, every fence paired as it was
