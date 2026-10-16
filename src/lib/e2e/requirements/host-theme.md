# Feature: `/test/host-theme`, a host cascade with no opt-in class

The only route that mounts `<Editor>` with no `.aragonite-editor-theme` anywhere: the
host-chrome tokens are declared on the page wrapper (or, for the "No host colors" entries,
undeclared) and the editor inherits them straight down the cascade. That makes it the route-level check on G4.6d: the host-chrome defaults
sit behind the opt-in class alone, so a themed host's own values reach the editor with
nothing in between.

`theming-tokens.md` covers the classed route and the type-scale token; this file owns the
colour half on the class-free route. The route exposes no `window.__test` bridge, so
assertions read computed style off rendered elements and interactions are real selections
on the page's own dropdowns.

Miss-analysis: nothing pinned the accent's path from a host wrapper to painted editor text,
because the route shipped with no spec at its own level: the blind spot at the entry layer
that rules.md names, one level up from a module.

## Happy paths

- the route mounts the editor with no `.aragonite-editor-theme` in the document, so the
  host wrapper is the only source of the chrome tokens
- picking an accent moves `--color-accent` on the editor root to the picked value: an
  editor-scoped default would shadow it and hold the token at the theme's own green
- picking an accent repaints what reads it: inline link text and the footnote
  marker both take the new colour, and both differ from body text
- picking a theme switches `data-editor-theme` on the editor root and repaints the body text,
  independently of the accent
- the page's own UI font comes from the wrapper, not the app stylesheet's `:root`: the
  wrapper declares `--font-ui` itself, and its value differs from the `:root` one so an
  undeclared wrapper cannot pass by inheritance
  (miss-analysis: nothing asserted where that token was read, so dropping the declaration left
  the reads silently resolving from `:root`, a value matching by inheritance that a bare
  equality check would also have missed)

- a host-declared `--color-selection` reaches a painted selection overlay: a document-wide
  selection paints the tint the wrapper's base implies, measured against a reference element
  rather than a hex value, and a theme swap to a copper base repaints it
  (miss-analysis: no test read a painted selection colour at all, so the four presentational
  tints could ignore any host cascade: the blind spot at the entry layer, one level below the
  declared list of tokens, which only pins declarations)

- a host that declares no colors (the picker's two "No host colors" entries take the site's own
  page tokens back to undeclared) gets the find bar and the block menu in the built-in palette of
  the `theme` prop's mode, light and dark alike
  (miss-analysis: every route declared host colors, from the opt-in class or `app.css`, so no test
  saw the dark inline fallbacks an app with no theme system got whatever its mode)
- in that host the editor's body text keeps the page's own color, since the editor paints no
  background behind it
- a live theme switch repaints the open find bar, and a find bar moved into an anchor follows the
  `theme` prop the same way
- in a host that declares every color, each host color read inside the editor (on a child of its
  root) is the host's own value, for all ten tokens, in a dark and a light theme

## Edge cases

- accent and theme are independent axes: an accent picked under a dark theme survives the
  switch to a light one, resolving to that theme's own hex for the preset
- `Accent: default` resolves to the theme's own accent rather than a stale previous pick

## Error cases

- zero `[invariant:…]` console fires across the picker interactions (automatic via the
  shared e2e fixture)
