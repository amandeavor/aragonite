# Feature: Column edits on a row-windowed table

A tall table mounts only the rows near the viewport. Rows that mounted once and then
scrolled away still hold their cells' ids, and a column edit splices a cell out of, or
into, every row, so those ids have to follow the splice whether the row is mounted or not.

Miss-analysis: column edits were only tested on tables short enough to mount whole, so no
row ever held ids while unmounted; the first edit also worked by luck, because the registry
still answered for an unmounted row it should have forgotten.

## Happy paths

- Scrolled to the bottom of a 300-row table (row 0 unmounted), a column delete and then a
  column insert from a deep row's cell: after each, every row's ids match its cells, and two
  undos restore the source with the ids still in step.
