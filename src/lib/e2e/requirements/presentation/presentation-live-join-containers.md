# Feature: live-mode joins under a list marker

When a live cut goes through a format run, the join closes it on the half that stays, so that
half keeps its format and no `**` shows. It works under a list marker too: a delete, a cut or typing over a
selection in a list item's first paragraph writes the same text as the same edit at the top level,
and a reload of the document reads back the tree the edit left. Driven on `/test/editor`
with `?presentationMode=live`. Every scenario checks the source, since a hidden delimiter and a
missing one look the same on screen.

## Happy paths

- in a list item, a selection from inside bold to inside italic, deleted with Backspace, leaves
  `- Some **bo***alic* words` with no delimiter on screen, and the reload agrees with the tree
- the same selection typed over puts the character inside the bold
- the same selection cut with `Mod+X` leaves the same bytes
- in a to-do item the same Backspace keeps the format the same way, and the checkbox stays
- a selection from inside a construct in one item into the next item joins the two, and the
  bold it cut through closes on the first item's text (`- Alpha **be**delta`)

## Edge cases

- Backspace right after the only letter of a bold word at an item's start takes the letter and
  the pair it emptied; the space left in front of the text widens the marker, which is how a
  reload reads it anyway, and no `**` shows

## User interactions

- Real clicks, arrow steps and `Shift+Arrow` extends only: the cleanup runs in the keydown and
  `beforeinput` handlers, and a programmatic selection never fires those
- Cut is a real `Mod+X`

## Error cases

- zero `[invariant:…]` console fires across every scenario (automatic via the shared e2e fixture)

## Miss-analysis

The join's check read the list marker off a field the parse result doesn't have, so it refused
every candidate under a marker. Every live join scenario ran in a top-level paragraph, and the
fuzzer counted any refusal as no worse than the literal edit, so nothing went red.
