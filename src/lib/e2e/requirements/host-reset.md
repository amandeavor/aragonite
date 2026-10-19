# Feature: an editor on a page with no CSS reset

`/test/no-reset` is the one route the app stylesheet skips, so its page keeps the browser's default
margins, padding and `content-box` sizing, the way a new Vite or React app starts. It wears
`/test/editor`'s fonts, theme and drag handles, takes its editor width from `?width=`, and
`?hostContent=on` adds what a host puts inside the editor: a header, an inline decoration widget, a
block badge, and two inline menus whose rows the host renders (`@@` a component, `%%` built DOM).
`&findBar=header` with it moves the find bar into a slot inside that header.

Miss-analysis: every route loaded the app stylesheet's global reset, so no test ever ran the editor
without one; the React example was the first page that did, and its editor was 40px wider than
its container.

## Happy paths

- The editor's box sits inside its container on both sides, and nothing in it overflows sideways.
- Typing at the end of a long, wrapping line leaves the page unscrolled sideways, and the page is no
  wider than the viewport.
- Every block in a seed of a heading, a paragraph, a nested list, a code block, a rule, a table and
  a quote has the same left offset, width and height (within a pixel) as on `/test/editor`, once
  both editors sit in containers of the same width and height (`?width=` and `?height=`): a
  classic scrollbar on one side only, as Linux Firefox draws, would narrow every block there.

## Edge cases

- What the host built keeps the page's own styles: a paragraph and a button in the header, a button
  in an inline decoration widget, one in a block badge, and one in each kind of inline menu row
  compute the same margin, padding and box sizing as the same elements outside the editor.
- The find bar rendered into an anchor inside the header is still the editor's: each element in it
  computes the same margin, padding and box sizing as the bar in its usual place. Miss-analysis:
  the host-content row checked what the host built inside the editor, never the editor's own DOM
  placed inside the host's.
