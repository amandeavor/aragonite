/**
 * Mounts a decoration's widget or badge view into the element the editor made for it, so block
 * badges and inline widgets report a failing view the same way.
 */

import { mountPluginView, type MountedPluginView } from '../plugin-view';
import type { Decoration, DecorationWidgetSpec } from './types';

export type MountedDecorationWidget = MountedPluginView<{ decoration: Decoration }>;

/** Null when the view threw while mounting, which `report` was told; the caller leaves it out. */
export function mountDecorationWidget(
	spec: DecorationWidgetSpec,
	dec: Decoration,
	target: HTMLElement,
	report: (error: unknown) => void
): MountedDecorationWidget | null {
	return mountPluginView(
		spec.view,
		target,
		{ decoration: dec },
		{
			report,
			subject: 'decoration widget'
		}
	);
}
