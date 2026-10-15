// The showcase's `#tag` plugin on repo source; the tags themselves live in `examples/showcase/`,
// which the React and Vue showcases wrap the same way on the installed package.
import { definePlugin, type EditorPlugin } from '#lib/plugin.js';
import { installTagMarks } from '../../../examples/showcase/tag-marks';

export { TAG_MENU } from '../../../examples/showcase/tag-marks';

export function tagMarksPlugin(): EditorPlugin {
	return definePlugin({
		name: 'harness-tag-marks',
		setup(ctx) {
			ctx.onEditor((editor) => installTagMarks(editor));
		}
	});
}
