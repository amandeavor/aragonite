# Feature: a press means what was under it when it went down

Paired spec: `src/lib/e2e/tests/plugins/latex-inline-press-layout.spec.ts`. A formula's source is open,
and its render is far wider than its source (`$\Huge WWWWWWWWWW$`), so when a press moves the caret
out and the formula draws again, the text after it moves well to the right. A point read against
the redrawn line lands inside the formula whatever the fonts. Each press is held for 150 ms, as a
person's is, which lets the source close before the release on every engine that can do that.

## Happy paths

- A held click on text after the open formula, in a paragraph: the source closes and the caret lands before the clicked word, so a typed letter goes there and the formula's bytes are untouched.
- The same click in a table cell: the same outcome, through the cell's own click route.
- A right-click on a widget after the open formula (`&copy;`): the menu's caret goes beside that widget, and the formula stays rendered.
- A right-click in the paragraph's top padding over text after the open formula: the caret goes at the column under the pointer, before the word there.
- A right-click on prose after the open formula: the caret goes where the press was, before the word under it.

## Regression

- Miss-analysis: every click row pressed and released at once, and on Chromium that lets the click run before the source closes, so only Firefox (which always closes it first) showed the click reading the redrawn line. No row held a press as long as a person does, and none right-clicked with a source open.
