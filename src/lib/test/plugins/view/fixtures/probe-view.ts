// Views that log their lifecycle, one drawn as plain DOM and one through a Svelte helper, and a
// stage to throw at, so every slot can be run against both authors and every failure.
import type { PluginView } from '#lib/plugin-view.js';

export type Stage = 'mount' | 'update' | 'destroy';
export interface LogEntry {
	stage: Stage | 'render';
	props?: unknown;
}

export const PROBE_CLASS = 'probe-view';
export const viewExploded = new Error('view exploded');

/** Shared with the Svelte probe, which can't take a log through its props. */
export const svelteLog: LogEntry[] = [];

/** A DOM view logging into `log`. `throwAt` fails only the first instance mounted, so a slot that
 *  mounts several (a menu's rows) shows the failure stays in its own. */
export function domProbe<P>(log: LogEntry[], throwAt?: Stage): PluginView<P> {
	let instances = 0;
	return (target, props) => {
		const fails = instances++ === 0 ? throwAt : undefined;
		if (fails === 'mount') throw viewExploded;
		log.push({ stage: 'mount', props });
		const el = document.createElement('b');
		el.className = PROBE_CLASS;
		target.append(el);
		return {
			update(next) {
				if (fails === 'update') throw viewExploded;
				log.push({ stage: 'update', props: next });
			},
			destroy() {
				log.push({ stage: 'destroy' });
				if (fails === 'destroy') throw viewExploded;
			}
		};
	};
}

export const stages = (log: LogEntry[]): string[] => log.map((entry) => entry.stage);
