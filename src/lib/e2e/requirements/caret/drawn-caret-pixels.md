# The drawn caret's pixels and color

The drawn caret should look like the browser's own: sharp, standing in the column the letter boundary falls in, and the color of the text around it. A bar placed between device pixels comes out blurred across two columns, and a bar rounded the wrong way sits over the side of the next letter.

The pixel rows run at device pixel ratios of 1, 1.25 and 1.5, on a line height that puts lines between pixels.

## Happy paths

- Walking a line one letter at a time: every edge of the plain bar lands on a whole device pixel, it is 1px rounded to the nearest whole device pixel (one at 1.25x, two at 1.5x, as wide as the browser's own caret), and it stands in the device column the letter boundary falls in
  - Miss-analysis: every caret row compared the bar with the browser's caret within a pixel, which is the size of the error, and none ran above 1x, where a 1px bar is wider than a device pixel
- At 1x the bar stands in the browser's own caret column at every letter boundary, found red in a screenshot (not on WebKit, which measures the range in whole pixels and loses the fraction its own caret rounds)
- The bar is the color of the text it stands in: in a paragraph, a heading, a link and bold, each styled its own color
  - Miss-analysis: the rows only checked that the bar had some color, and the harness draws all text in the theme's text color, so a bar in the theme's color always matched

## Edge cases

- The bold bar keeps the device grid, its width the bold token rounded to the nearest whole device pixel
- The italic bar's foot keeps the device grid, as wide as the plain bar
- The strikethrough tick keeps the device grid: 13px and 2px, each rounded to the nearest whole device pixel
- The gap bar's top and thickness keep the device grid, 2px rounded to the nearest whole device pixel
- A length exactly halfway between two device pixels (1px at 1.5x, 2px at 1.25x) rounds up, as the browser's caret does at 1.5x
- A theme that sets `--md-caret-color` colors the bar, in plain text and in a link alike
- On an editable that starts between pixels, the bar stands in the browser's caret column or the one beside it, since the browser floors in the editable's own pixels first
  - Miss-analysis: every caret row's editable sat on a whole pixel, so the fraction the browser-caret finder's screenshot crop dropped never showed
