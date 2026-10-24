# Feature: a keystroke the tree rolls back

A key typed inside a container writes the leaf and then rebuilds the container's bytes. When that
rebuild throws (a broken plugin container, say), the keystroke rolls back: the source keeps the
bytes it had, the `error` event fires with origin `commit`, and the character the browser already
drew goes away, because the block repaints from the tree.

## Happy paths

- Type `x` at the end of `> ab` while the quote's rebuild throws: the `error` event fires with
  origin `commit`, the source stays `> ab`, and the paragraph shows `ab`
- Then stop the throw and type `y`: the source becomes `> aby`, and one Ctrl+Z gives back `> ab`
  with the paragraph showing `ab`

## User interactions

- An IME composition committed as `か` while the rebuild throws: the `error` event fires, the source
  stays `> ab`, and the paragraph shows `ab`

## Miss-analysis

- A keystroke written in place had no rollback, so a throwing rebuild left a half-written chain and
  no event. Every rollback test drove a structural commit; none typed into a container.
