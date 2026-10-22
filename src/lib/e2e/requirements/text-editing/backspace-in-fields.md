# Feature: Backspace in a field

The editor cancels Backspace's page default (WebKit goes back in history on it) whenever focus is
inside the editor but outside a field, in every mode. A field still deletes on Backspace.

## Happy paths

- Typing into a field and pressing Backspace deletes the last character: the find bar's field (in
  source and in reading mode), an image's alt field, the link card's URL field (live mode), a code
  block's language field (live mode), and an input the host put beside the editor

## Edge cases

- The mermaid plugin's source box is covered by `requirements/plugins/mermaid-focus.md`

## Miss-analysis

- The Backspace guard's rows pressed it only on a block, so whether each field the editor owns
  still deleted on it was never checked against a real page.
