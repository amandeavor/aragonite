# Feature: a rendering diagram leaves the host page alone

Mermaid lays a diagram out in the page to measure its text before it hands back the svg. That
layout happens in an element the renderer owns, fixed and clipped to nothing, so the page around
the editor never grows while a diagram draws, and the element is gone once the render settles,
whether it drew or failed.

The page is the plugins harness, whose body is exactly one screen tall. A watcher installed
before the first paint records the page's scroll height each time an element joins the body.

## Happy paths

- **The first render of the seed's two diagrams:** every height read during the render equals
  the page's height once both have drawn, and nothing that joined the body is still there

## Edge cases

- **A theme flip redraws both diagrams:** the same, across the redraws
- **A diagram that fails to render, drawn again by a theme flip:** nothing that joined the body
  is still there after either attempt, so a broken diagram can't leave one element per try

## User interactions

- The rows drive the page the way a user does: load it, then flip the theme with its toggle

## Error cases

- A render that never settles fails the row at the diagram wait, naming the missing svg

## Miss-analysis

- Every mermaid row read the diagram inside the editor and nothing outside it, so the renderer
  laying its measuring element out in the host page's own flow, which grew the page by the
  diagram's height for the length of each render, went unseen (#762).
