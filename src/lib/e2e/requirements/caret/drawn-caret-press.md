# The drawn caret across a click that moves the caret

Some clicks put the caret somewhere and then move it on release: a press on a task checkbox lands
the browser's caret inside the box's own text, and the click puts it after the box. Between the two,
the drawn caret paints nothing, so no frame shows a caret where it won't stay.

## Happy paths

- A task checkbox click, live mode: no frame from the press to the click paints the bar anywhere but
  after the checkbox, and once the click lands the bar draws there
- The same click in source mode, where the checkbox shows its `[ ]` text

## Edge cases

- A task list inside a table cell doesn't exist: GFM puts no list in a cell, so the checkbox row
  has no cell variant

Miss-analysis (the checkbox): the dark-until-the-click rule lived in the prose block's beside-a-widget
check, and no row sampled the bar per frame across a press anywhere else the click moves the caret.
