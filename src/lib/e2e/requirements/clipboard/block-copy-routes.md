# Feature: A whole block's clipboard text, on every route

A block reaches the clipboard whole from the right-click menu's Copy row and from Mod+C on a block
focused as a whole; both write the block's Markdown without the line ending that closes it. The
writes go through `navigator.clipboard`, which a webview without clipboard access refuses.

## Happy paths

- The divider's menu Copy writes what Mod+C on the focused divider writes (`---`).
- A code block's menu Copy writes the fence without its closing line ending.

## Error cases

- With every clipboard write refused, the menu's Copy, Mod+C and Mod+X on a focused block, and the
  code block's Copy code button leave the document as it was, raise no page error and print no
  warning; Mod+X keeps the block, and the button does not report the code copied.

## Miss-analysis

- The menu's Copy wrote the block with its line ending while Mod+C trimmed it, because each route
  built its own text and no row compared two routes on one block; the menu's Copy also had no
  catch, and every copy row ran with a clipboard that accepts.
