# The drawn caret's pixels and color

The drawn caret should look like the browser's own: sharp, standing in the column the letter boundary falls in, and the color of the text around it. A bar placed between device pixels comes out blurred across two columns, and a bar rounded the wrong way sits over the side of the next letter.

The pixel rows run at device pixel ratios of 1, 1.25 and 1.5, on a line height that puts lines between pixels.

## Happy paths

- Walking a line one letter at a time: every edge of the plain bar lands on a whole device pixel, it is one device pixel wide, and it stands in the device column the letter boundary falls in
  - Miss-analysis: every caret row compared the bar with the browser's caret within a pixel, which is the size of the error, and none ran above 1x, where a 1px bar is wider than a device pixel
- At 1x the bar stands in the browser's own caret column at every letter boundary, found red in a screenshot (not on WebKit, which measures the range in whole pixels and loses the fraction its own caret rounds)
- The bar is the color of the text it stands in: in a paragraph, a heading, a link and bold, each styled its own color
  - Miss-analysis: the rows only checked that the bar had some color, and the harness draws all text in the theme's text color, so a bar in the theme's color always matched

## Edge cases

- The bold bar keeps the device grid, its width the bold token rounded down to whole device pixels
- The italic bar's foot keeps the device grid, one device pixel wide
- The strikethrough tick keeps the device grid: 13px and 2px, each rounded down to whole device pixels
- The gap bar's top and thickness keep the device grid, 2px rounded down to whole device pixels
- A theme that sets `--md-caret-color` colors the bar, in plain text and in a link alike
