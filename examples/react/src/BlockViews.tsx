// The adapter suite's `?block-views` page (`examples/adapter-suite/requirements/block-views.md`):
// three blocks drawn by React components through `reactBlockView`.
import { createContext, useContext, useState } from 'react';
import {
	Aragonite,
	BlockChildren,
	LeafContent,
	reactBlockView,
	type BlockViewProps
} from '@voithos-labs/aragonite-react';
import {
	BLOCK_VIEWS_SOURCE,
	LONG_SOURCE,
	blockViewsPlugin
} from '../../adapter-suite/block-view-kinds';

const ANOTHER = '%% another memo\n\nplain text\n';

// Reaches the memo through `wrap`, as an app's theme or store provider would.
const BadgeText = createContext('no provider');

function Memo(_: BlockViewProps<'leaf'>) {
	return (
		<>
			<span className="memo-badge">{useContext(BadgeText)}</span>
			<LeafContent className="memo-text" />
		</>
	);
}

// While open, a preview follows the source as it's typed, block math's side-by-side shape.
function Label({ state, draft }: BlockViewProps<'render-primary'>) {
	const caption = (draft ?? state.node.raw).slice('@@ '.length).trim();
	if (!state.revealed) return <span className="label-text">{caption}</span>;
	return (
		<>
			<LeafContent className="label-source" />
			<span className="label-preview">{caption}</span>
		</>
	);
}

// `data-length` changes per edit in the box, so `BlockChildren` re-renders while it's typed in.
function Box({ state }: BlockViewProps<'container'>) {
	return (
		<>
			<span className="box-badge">box by react</span>
			<BlockChildren className="box-children" data-length={state.node.raw.length} />
		</>
	);
}

const plugins = [
	blockViewsPlugin({
		memo: reactBlockView(Memo, {
			surface: 'leaf',
			singleLine: true,
			className: 'memo',
			wrap: (block) => <BadgeText.Provider value="memo by react">{block}</BadgeText.Provider>
		}),
		label: reactBlockView(Label, {
			surface: 'render-primary',
			singleLine: true,
			className: 'label'
		}),
		box: reactBlockView(Box, { surface: 'container', className: 'box' })
	})
];

export function BlockViews() {
	const [value, setValue] = useState(BLOCK_VIEWS_SOURCE);
	const [shown, setShown] = useState(true);

	return (
		<main>
			<button data-testid="load" onClick={() => setValue(ANOTHER)}>
				Load another doc
			</button>
			<button data-testid="load-long" onClick={() => setValue(LONG_SOURCE)}>
				Load a long doc
			</button>
			<button data-testid="unmount" onClick={() => setShown(!shown)}>
				{shown ? 'Unmount' : 'Mount'}
			</button>
			{shown && (
				<Aragonite
					value={value}
					onChange={setValue}
					plugins={plugins}
					theme="light"
					className="block-views-editor"
				/>
			)}
			<pre data-testid="mirror">{value}</pre>
		</main>
	);
}
