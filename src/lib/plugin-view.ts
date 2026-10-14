/**
 * The one shape a plugin's inline widget, decoration widget and menu row take, and the one place
 * the editor calls it: a throw at mount, update or destroy is contained here, reported, and the
 * slot draws its fallback.
 */

import { warnIfForeignRuntime } from './foreign-runtime';

/**
 * Draws into `target`, an element the editor made for this view and removes once it's destroyed.
 * `update` takes the slot's next props; a view without one keeps what it first drew. `destroy`
 * releases whatever the view holds (a framework root, a listener, a timer); a promise it returns
 * is watched for a rejection.
 */
export type PluginView<P> = (target: HTMLElement, props: P) => PluginViewHandle<P>;

export interface PluginViewHandle<P> {
	update?(props: P): void;
	destroy?(): void | Promise<void>;
}

/** A view the editor mounted. After any throw it is torn down and every later call does nothing. */
export interface MountedPluginView<P> {
	/** False when the view threw (reported, and torn down): the slot draws its fallback. */
	update(props: P): boolean;
	/** Idempotent. */
	destroy(): void;
}

export interface PluginViewMountOptions {
	/** Where a throw goes: the editor's `error` event, in the shape the slot reports. */
	report: (error: unknown) => void;
	/** What the view is, for the dev warning that names a foreign Svelte runtime. */
	subject: string;
}

/** Null when the mount threw, which is reported; the slot draws its fallback instead. */
export function mountPluginView<P>(
	view: PluginView<P>,
	target: HTMLElement,
	props: P,
	opts: PluginViewMountOptions
): MountedPluginView<P> | null {
	const fail = (error: unknown): void => {
		warnIfForeignRuntime(error, opts.subject);
		opts.report(error);
	};
	let handle: PluginViewHandle<P> | undefined;
	try {
		handle = view(target, props);
	} catch (error) {
		fail(error);
		return null;
	}
	let live = true;

	function destroy(): void {
		if (!live) return;
		live = false;
		try {
			// A Svelte root's teardown throw arrives as the rejection of `unmount`'s promise.
			handle?.destroy?.()?.catch(fail);
		} catch (error) {
			fail(error);
		}
	}

	return {
		update(next) {
			if (!live) return false;
			if (!handle?.update) return true;
			try {
				handle.update(next);
				return true;
			} catch (error) {
				fail(error);
				destroy();
				return false;
			}
		},
		destroy
	};
}
