# Feature: a presentation-mode flip closes an open source reveal

A mode switch counts as a blur. Keys typed into an inline widget's shown source
are written as they land, so by the time a switch arrives the document already
holds the edit. The switch closes the shown source, on every switch and not only
the one into reading, and the widget renders again in the new mode with the bytes
unchanged.

Driven on `/test/plugins?seed=math`, whose `$…$` kind declares `revealSource`;
the switch is the host writing the `presentationMode` prop, which is the
consumer-facing gesture the demo's toggles also produce.

Miss-analysis (E-F4): every mode-switch scenario switches with nothing revealed,
so nothing ever watched an open reveal cross a switch. That hid two faults at
once: the blur lived only in the reading branch, and even that branch ran after
the mode's render key had rebuilt the block and erased the very edit the blur was
there to commit.

## Happy paths

- an edit typed into a revealed source is in the document before the switch; a
  switch into reading closes the source, the formula renders, and the bytes are
  the edited ones
- a switch to live keeps the edited bytes too, and the caret it carries across
  sits inside the formula, so the source opens again there, as any restored
  caret inside a widget that can show its source does

## Edge cases

- a reveal opened but not edited moves no byte across a switch, and the formula
  renders again

## User interactions

- the reveal is opened by a real gesture (caret past the widget, one Backspace)
  and edited by real typing before the switch

## Error cases

- zero `[invariant:…]` console fires and no captured page errors across every
  scenario
