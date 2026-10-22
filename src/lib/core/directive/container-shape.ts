/** What a directive container's raw bytes and body wrap carry, shared by its opener and its kind. */

import type { ContainerBodyWrap } from '../parser';

/** The `:::` opener and closer bracket every directive body, whatever kind the name maps to. */
export const DIRECTIVE_BODY_WRAP: ContainerBodyWrap = {
	afterOpenerLine: true,
	beforeCloserLine: true
};

/** Fence bytes a container node round-trips through `rebuildDirectiveContainerRaw`. */
export interface DirectiveContainerMetadata {
	name: string;
	colonCount: number;
	info: string;
	closerColonCount: number;
	closerNewline: boolean;
	/** Authored line ending for the opener and closer fence lines. */
	lineEnding: string;
}
