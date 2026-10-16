# Feature: Mark activation from the keyboard

The built-in `decorations.activateAtCaret` command runs the `onActivate` of the interactive mark
covering the caret, so a keyboard user reaches a hover definition without one tab stop per mark.
It has no default chord: the host binds one through the `keybindings` prop or runs it with
`runCommand`. A caret at either edge of a mark counts as inside it. Where several marks cover the
caret, the one with the shortest range wins, then the one from the earlier-registered source.

## Happy paths

- Caret inside a mark with `onActivate`, the host's bound chord pressed: `onActivate` runs once,
  its anchor on the mark's painted rect
- The same through the host's `runCommand`: runs once and answers true
- Caret inside a table cell carrying a mark: `onActivate` runs once, its anchor on the cell

## Edge cases

- Two marks overlapping the caret, the outer from the earlier source: the inner one's
  `onActivate` runs, and the outer's does not
- Two marks over the same range from two sources: the earlier-registered source's runs
- No mark covers the caret: `canRunCommand` answers false and `runCommand` answers false, and no
  `onActivate` runs

## Error cases

- An `onActivate` that throws reaches the `error` event as origin `decoration`
