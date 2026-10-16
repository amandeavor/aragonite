/**
 * Register-once: a duplicate is an error (`docs/design/plugin-contract.md` § The registries: global,
 * register-once). A plugin's setup runs once per process, so only the editor's own entries meet a
 * duplicate, when a dev server re-evaluates an editor module; there the entry is replaced and warned.
 */
import { editorEnv } from '../env';
import { devWarn } from '../dev-warn';

/** True only on a dev server, not in production and not in a test run: the one case that replaces. */
export function devReplacesRegistration(): boolean {
	return editorEnv.isDev && !editorEnv.isTest;
}

/**
 * `apply` does the registration and its side effects, on a first registration and on a dev-server
 * replacement alike. `editorOwned` says the existing entry is the editor's, the one kind replaced.
 */
export function registerOnce(
	isDuplicate: boolean,
	editorOwned: boolean,
	apply: () => void,
	conflict: string
): void {
	if (isDuplicate) {
		if (editorOwned && devReplacesRegistration()) {
			devWarn('registry', `${conflict}: dev re-registration replaces (HMR/SSR survival)`);
			apply();
			return;
		}
		throw new Error(conflict);
	}
	apply();
}
