# Feature: A range removal keeps an ordered list's numbers

An ordered list's numbers stay consecutive from its first number through any removal. A range
that takes items out of a list leaves the items after it renumbered, and a list that loses its
first item keeps its old first number on the item that now leads it. The source holds the new
numbers, so a reload shows the same list.

## Happy paths

- `8. aa / 9. bb / 10. cc / 11. dd`, a range from inside `bb` to the start of `cc`, Delete: the
  source reads `8. aa / 9. bcc / 10. dd`, and the items show 8, 9, 10, in source and live mode.
- The same range and Backspace, or Cut: the same bytes and numbers.
- The same range and a typed `Z`, or a pasted `Z`: `8. aa / 9. bZcc / 10. dd`, numbered 8, 9, 10.

## Edge cases

- A range from inside a paragraph above the list into `bb`, Delete: the paragraph takes `bb`'s
  tail and the one item left reads `8. cc`, keeping the list's start, in source and live mode.

## User interactions

- The range inside the list is made with Shift and the arrow keys from a caret placed in `bb`;
  the one from the paragraph above is a Shift+click into it from a caret in `bb`.

Miss-analysis: every cross-block fixture started its list at 1 or cut no middle item, where a
removal that renumbers nothing still reads as consecutive.
