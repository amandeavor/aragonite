// The kinds the `?block-views` page draws with each framework's own components
// (`requirements/block-views.md`): a `%% ` memo line, a `@@ ` click-to-edit label, and a `:::box`
// container. Each app passes its views; the grammar here is shared.
import {
	activateDirectives,
	chromeChild,
	containerClosure,
	createDirectiveRebuild,
	declarePluginKind,
	declaredPluginKind,
	definePlugin,
	DIRECTIVE_BODY_WRAP,
	registerBlockKind,
	registerChromeLeaf,
	registerDirective,
	setPluginMetadata,
	simpleLeafClosure,
	trimWhitespace,
	type BlockView,
	type CstNode,
	type EditorPlugin,
	type ParsedDirective
} from '@voithos-labs/aragonite/plugin';

export const BLOCK_VIEWS_SOURCE =
	'%% a memo\n\n@@ a label\n\n:::box The box\ninside the box\n:::\n\nafter the blocks\n';

export interface BlockViews {
	memo: BlockView;
	label: BlockView;
	box: BlockView;
}

export function blockViewsPlugin(views: BlockViews): EditorPlugin {
	return definePlugin({
		name: 'block-views',
		setup() {
			registerLine('memo', '%% ', 25, views.memo, 'leaf: every keystroke commits');
			registerLine(
				'label',
				'@@ ',
				26,
				views.label,
				'render-primary: one commit when the caret leaves'
			);
			registerBox(views.box);
		}
	});
}

function registerLine(
	name: string,
	marker: string,
	priority: number,
	view: BlockView,
	undo: string
): void {
	const kind = declarePluginKind(name);
	registerBlockKind(kind, {
		view,
		opener: {
			priority,
			interruptsParagraph: (text) => text.startsWith(marker),
			tryOpen: (ctx) =>
				ctx.line.text.startsWith(marker)
					? { node: { kind, leadingTrivia: ctx.leadingTrivia, raw: ctx.line.raw }, consumed: 1 }
					: null
		},
		gapEdges: 'none',
		mergeRole: 'not-mergeable',
		editable: true,
		supportsInline: false,
		conformanceFixture: `${marker}text\n`,
		closure: simpleLeafClosure({
			focus: { mode: 'implemented', via: 'the leaf surface' },
			searchPaint: { mode: 'inherit-default' },
			undo: { mode: 'implemented', via: undo },
			simOracle: { mode: 'inherit-default' }
		})
	});
}

interface BoxMetadata {
	colonCount: number;
	closerColonCount: number;
	closerNewline: boolean;
	lineEnding: string;
}

function boxFromDirective(parsed: ParsedDirective): CstNode {
	const node: CstNode = {
		kind: declaredPluginKind('box'),
		leadingTrivia: parsed.leadingTrivia,
		raw: parsed.raw,
		innerPrefix: parsed.body?.prefix ?? '',
		children: [
			chromeChild(declaredPluginKind('box-title'), trimWhitespace(parsed.fence.info)),
			...(parsed.body?.children ?? [])
		],
		innerSuffix: parsed.body?.suffix ?? ''
	};
	setPluginMetadata<BoxMetadata>(node, {
		colonCount: parsed.fence.colonCount,
		closerColonCount: parsed.closerColonCount,
		closerNewline: parsed.closerNewline,
		lineEnding: parsed.lineEnding
	});
	return node;
}

function registerBox(view: BlockView): void {
	activateDirectives();
	const box = declarePluginKind('box');
	const title = declarePluginKind('box-title');
	registerDirective('container', 'box', { kind: box, fromDirective: boxFromDirective });
	registerBlockKind(box, {
		view,
		mergeRole: 'container',
		editable: true,
		supportsInline: false,
		gapEdges: 'both',
		container: {
			contract: 'opaque',
			rebuildRaw: createDirectiveRebuild<BoxMetadata>(() => 'box'),
			bodyWrap: DIRECTIVE_BODY_WRAP,
			reservedChrome: { kind: title },
			unwrapRole: { middleChildBackspace: 'default-merge' }
		},
		conformanceFixture: ':::box Title\nbody\n:::\n',
		closure: containerClosure({
			roundTripVia: 'createDirectiveRebuild',
			focus: { mode: 'implemented', via: 'focus walks to the title row' },
			mergeBackspace: { mode: 'implemented', via: 'mergeRole=container + unwrapRole' },
			undo: { mode: 'implemented', via: 'children commit as ordinary blocks' },
			simOracle: { mode: 'inherit-default' },
			clipboard: { mode: 'implemented', via: 'byte-slice copy' }
		})
	});
	registerChromeLeaf(title, { label: 'Box title', blockClass: 'box-title' });
}
