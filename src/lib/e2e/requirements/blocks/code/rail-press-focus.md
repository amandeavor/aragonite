# Feature: Code block, a press on the side gutter

A pointer press on the code block's side gutter (copy, run, the overflow button and its items,
the language chip) leaves the keyboard where it was, so the block's keys still reach it.

## Happy paths

- After a press on copy, run, the overflow button (opening and closing its menu), an overflow item,
  or the language chip (opening and closing its picker), typing lands in the code block
- After each of those presses, Mod+Z undoes the last edit

## User interactions

- Closing the language picker with a second press on the chip puts the caret back in the block,
  as Escape does

## Miss-analysis

- A press on any gutter button left focus on the button in Chromium and Firefox, so typing went
  nowhere, and after the chip closed its picker Firefox's Mod+Z did nothing too: the gutter specs
  drove each button for what it does and never pressed a key after one
