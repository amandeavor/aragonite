/**
 * Checks that the host colors resolve inside a styled editor: from the theme stylesheet, or from
 * the page's own declarations. With neither, the menus and find bar paint with no colors at all.
 */

import type { InvariantViolation } from '../assert';

export function checkHostColorsResolve(root: HTMLElement): InvariantViolation | null {
	const style = getComputedStyle(root);
	// The editor.css reset makes the root border-box, so anything else is a DOM with no stylesheet.
	if (style.boxSizing !== 'border-box') return null;
	// editor.css resolves this from the page's `--color-bg`, else the theme stylesheet's palette.
	if (style.getPropertyValue('--md-color-bg') !== '') return null;
	return {
		code: 'theme-stylesheet-missing',
		message:
			"the editor's theme stylesheet isn't loaded and the page declares no colors: " +
			"import '@voithos-labs/aragonite/styles/editor-theme.css'"
	};
}
