# Feature: a dev warning when the theme stylesheet is missing

An app that imports the editor but forgets `editor-theme.css`, on a page that declares no colors
of its own, gets an editor whose menus and find bar paint with no colors. In a dev build the editor
says so once it lays out, naming the import to add. A page that declares its own colors needs no
theme stylesheet, so it stays quiet.

## Happy paths

- with the theme stylesheet loaded, a fresh mount logs nothing
- with the theme stylesheet gone and no page colors, a fresh mount warns `invariant:host-colors-resolve`, and
  the message names the `editor-theme.css` import

## Edge cases

- with the theme stylesheet gone but the page declaring `--color-bg`, a fresh mount stays quiet
