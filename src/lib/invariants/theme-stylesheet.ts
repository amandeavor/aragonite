/**
 * Checks that the host colors resolve inside a styled editor: from the theme stylesheet, or from
 * the page's own declarations. With neither, the menus and find bar paint with no colors at all.
 */

import type { InvariantViolation } from '../assert';

export function checkHostColorsResolve(root: HTMLElement): InvariantViolation | null {
	const style = getComputedStyle(root);
	// The editor's own reset makes its root border-box; without it no stylesheet applies at all.
	if (style.boxSizing !== 'border-box') return null;
	const unset = (name: string) => style.getPropertyValue(name) === '';
	if (!unset('--md-color-bg') || !unset('--color-bg')) return null;
	return {
		code: 'theme-stylesheet-missing',
		message:
			"the editor's theme stylesheet isn't loaded and the page declares no colors: " +
			"import '@voithos-labs/aragonite/styles/editor-theme.css'"
	};
}
