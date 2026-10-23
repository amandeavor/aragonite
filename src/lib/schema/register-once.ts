/**
 * Register-once: a duplicate is an error (`docs/design/plugin-contract.md` § The registries: global,
 * register-once). A plugin's setup runs once per process, so only the editor's own entries meet a
 * duplicate, when a dev server re-evaluates an editor module; there the entry is replaced and warned.
 */
import { devChecksOn, devWarn, isTestProcess } from '@voithos-labs/aragonite/dev-checks';

/** True only on a dev server, not in production and not in a test run: the one case that replaces. */
function devReplacesRegistration(): boolean {
	return devChecksOn && !isTestProcess;
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
