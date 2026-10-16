/**
 * Root listeners installed against the editor's mounted root, each in an effect of its own, so a
 * value one install reads re-runs only that install. Call it while the component sets up, which
 * ties every teardown to the component's unmount.
 */

export type RootInstall<R extends HTMLElement> = (root: R) => (() => void) | void;

export function createRootEffect<R extends HTMLElement>(
	getRoot: () => R | undefined
): (install: RootInstall<R>) => void {
	return (install) => {
		$effect(() => {
			const root = getRoot();
			if (!root) return;
			return install(root);
		});
	};
}
