// Which theme the demo site shows: the visitor's last choice, kept in the browser, else the
// showcase's default. Every page of the site reads and writes it here, so they agree.
import { INITIAL_STATE, type ShowcaseTheme } from './controls';

const STORAGE_KEY = 'aragonite-showcase-theme';

export function readTheme(): ShowcaseTheme {
	try {
		const stored = localStorage.getItem(STORAGE_KEY);
		if (stored === 'light' || stored === 'dark') return stored;
	} catch {
		// No storage (a prerender, a blocked store): the default stands.
	}
	return INITIAL_STATE.theme;
}

/** Flips `current`, remembers the result and returns it. */
export function toggleTheme(current: ShowcaseTheme): ShowcaseTheme {
	const next = current === 'dark' ? 'light' : 'dark';
	try {
		localStorage.setItem(STORAGE_KEY, next);
	} catch {
		// A blocked store keeps the choice for this page only.
	}
	return next;
}
