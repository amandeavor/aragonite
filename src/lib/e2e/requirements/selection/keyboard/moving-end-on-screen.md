# Feature: The selection's moving end stays on screen

When a key moves the end of a selection you're growing, the page scrolls just far enough to show where that end landed, whatever shape the selection takes on the way: inside one block, across blocks, folded back into the block it started in, or through a table. The anchor, the end that stays put, can go off screen. Every row checks that the moving end's line sits inside the editor's viewport after the key, and where it went.

## Happy paths

- Sixty paragraphs, the caret at the end of the eleventh: Shift+ArrowDown 25 times, then Shift+ArrowUp 25 times, folds the selection back into the eleventh paragraph, from its end to its start, and that paragraph comes back on screen
- After that fold, one more Shift+ArrowUp extends into the paragraph above, the anchor still at the eleventh paragraph's end
- The caret inside the forty-first paragraph, Mod+Shift+Home, then Shift+ArrowDown back down to it: the selection folds back into the forty-first paragraph, and the page follows it down
- The caret inside the first paragraph, Mod+Shift+End, then Mod+Shift+Home: the selection folds back into the first paragraph, which comes back on screen from 1,100-odd pixels below
- The caret inside the last paragraph, Mod+Shift+Home, then Mod+Shift+End: the selection folds back into the last paragraph, on screen again
- Shift+ArrowDown 30 times from the sixth paragraph's end: the page follows the moving end down past the bottom edge

## Edge cases

- Two hundred paragraphs, Mod+Shift+End from the first: the last paragraph, never rendered yet, mounts and comes on screen, and a plain ArrowLeft still collapses the range
- Twenty paragraphs and then a quote holding forty paragraphs, Shift+ArrowDown 30 times from the sixth paragraph's end: the moving end goes into the quote's sixteenth paragraph, and the page follows it
- A range from the first paragraph down onto a long paragraph that wraps, then Shift+End: the moving end goes to the end of the first visual line, not the paragraph's end
- A one-column table of sixty rows, the caret in the row sitting on the bottom edge: Shift+ArrowDown selects down to the row below, which comes on screen
- The same table, ten more Shift+ArrowDown: the selection grows a row at a time and the page follows
- A paragraph above the table, Shift+ArrowDown from its end into the table and 40 more times: the selection grows a row at a time through the table instead of sticking on its first row
- From there, Shift+ArrowDown past the table's last row: the selection leaves the table for the paragraph below
- A paragraph below the table, Shift+ArrowUp from its start into the table and once more: the selection takes the last row, then the row above it
- A range from inside a paragraph down onto the rule below it, then a typed letter: the letter replaces the selected text and the rule stays, since showing the end leaves focus with the block the range began in, whose keys serve the range

## User interactions

- A range from the sixth paragraph down to the thirty-sixth, Shift+End (Cmd+Shift+Right on a Mac): the moving end goes to the end of its line and stays on screen, while the anchor stays put
- From there, Shift+Home (Cmd+Shift+Left on a Mac): the moving end goes to the start of its line

## Miss-analysis

The only reveal rows were the windowed-out document edge and a Shift+Arrow past an edge, both of which leave the range across blocks. No row folded a range back into one block, where the range state empties and every reveal read that state. The fold also wrote its range forward, losing which end was moving, and no row pressed a key after a fold. No row grew a range from prose into a table, where every press re-landed on the table's first cell.
