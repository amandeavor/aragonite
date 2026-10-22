import { checkReadingTabStops } from '../invariants/reading-tab-stops';

/**
 * A conformance row for a block in reading mode, where Tab is the page's focus walk and the editor
 * keeps one tab stop: mount your kind with `presentationMode: 'reading'` and pass the editor's root
 * (`.editor`). Null when nothing but controls and that one stop is in the tab order; otherwise the
 * problem, naming each extra stop.
 */
export function readingTabOrderProblem(root: HTMLElement): string | null {
	return checkReadingTabStops(root)?.message ?? null;
}
