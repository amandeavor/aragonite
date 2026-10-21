# Feature: deleting the rule between a paragraph and indented code

With a thematic break between a paragraph and an indented code block, Delete at the paragraph's
end focuses the break and a second Delete removes it. Flush against the paragraph, the indented
line would read as the paragraph's continuation and the code block would be gone, so the delete
leaves a blank line between them instead: the code stays a code block, with every line it held.
The editor's blocks must match what a reload of the same bytes reads.

Miss-analysis: the one unit pin on this join encoded the lost blank line as known, and no case
gave the code more whitespace lines than the join had blocks to hold them. Later (#479) the pair a
delete leaves was let change a block's kind, which these rows now hold against.

## Happy paths

- two whitespace lines under the code, then a blank line and a fence: the break's line becomes the blank line above the code, which stays a code block, and the tree matches a reload (#450)

## Edge cases

- three whitespace lines under the code: the same (#451)

## User interactions

- a real click on the paragraph, End, then Delete twice

## Error cases

- zero `[invariant:…]` console fires (automatic via the shared e2e fixture)
