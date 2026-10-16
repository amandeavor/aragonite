// The showcase in React: the shell around `examples/showcase/`, which holds the document, the
// plugins and the controls the Svelte and Vue showcases share.
import { useState } from 'react';
import { Aragonite } from '@voithos-labs/aragonite-react';
import SHOWCASE_DOCUMENT from '../../../showcase/showcase-content.md?raw';
import {
	HANDLES_GATED_TITLE,
	INITIAL_STATE,
	PRESENTATION_MODES,
	TOGGLES,
	handlesGated,
	showsSelectionMenu,
	type ShowcaseToggle
} from '../../../showcase/controls';
import { showcasePlugins } from '../../../showcase/plugins';
import { demoPasteImage, resolveDemoImageUrl } from '../../../showcase/image-store';

export function Showcase() {
	const [source, setSource] = useState(SHOWCASE_DOCUMENT);
	const [theme, setTheme] = useState(INITIAL_STATE.theme);
	const [presentationMode, setPresentationMode] = useState(INITIAL_STATE.presentationMode);
	const [dragHandles, setDragHandles] = useState(INITIAL_STATE.dragHandles);
	const [selectionMenu, setSelectionMenu] = useState(INITIAL_STATE.selectionMenu);
	const [occurrences, setOccurrences] = useState(INITIAL_STATE.occurrences);
	const [showSource, setShowSource] = useState(INITIAL_STATE.showSource);
	const handlesOff = handlesGated(presentationMode);

	return (
		<div className="showcase aragonite-editor-theme" data-editor-theme={theme}>
			<header className="showcase-header">
				<span className="showcase-title">aragonite</span>
				<span className="showcase-tag">showcase in React</span>
				<Toggle
					toggle={TOGGLES.theme}
					on={theme === 'light'}
					onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
				/>
				<Toggle
					toggle={TOGGLES.dragHandles}
					on={dragHandles}
					disabled={handlesOff}
					title={handlesOff ? HANDLES_GATED_TITLE : undefined}
					onClick={() => setDragHandles(!dragHandles)}
				/>
				<Toggle
					toggle={TOGGLES.selectionMenu}
					on={selectionMenu}
					onClick={() => setSelectionMenu(!selectionMenu)}
				/>
				<Toggle
					toggle={TOGGLES.occurrences}
					on={occurrences}
					onClick={() => setOccurrences(!occurrences)}
				/>
				<Toggle
					toggle={TOGGLES.source}
					on={showSource}
					onClick={() => setShowSource(!showSource)}
				/>
				<span className="showcase-hint">Mod+F to search</span>
				<div className="showcase-modes" role="group" aria-label="Presentation mode">
					{PRESENTATION_MODES.map((mode) => (
						<button
							key={mode}
							type="button"
							className={`showcase-mode${presentationMode === mode ? ' active' : ''}`}
							data-mode={mode}
							onClick={() => setPresentationMode(mode)}
						>
							{mode}
						</button>
					))}
				</div>
				<a
					className="showcase-link"
					href="https://github.com/voithos-labs/aragonite/tree/main/docs"
				>
					docs
				</a>
			</header>
			<div className="showcase-body">
				{/* The plugin set is read at mount, so the occurrences toggle remounts the editor; the
				    controlled value carries the document across. */}
				<Aragonite
					key={String(occurrences)}
					className="showcase-editor"
					value={source}
					onChange={setSource}
					plugins={showcasePlugins(occurrences)}
					blockDragHandles={dragHandles}
					onPasteImage={demoPasteImage}
					resolveImageUrl={resolveDemoImageUrl}
					presentationMode={presentationMode}
					linkClick="plain"
					selectionToolbar={showsSelectionMenu(presentationMode, selectionMenu)}
					theme={theme}
				/>
				{showSource && (
					<pre className="showcase-source" data-testid="source-view">
						{source}
					</pre>
				)}
			</div>
		</div>
	);
}

function Toggle(props: {
	toggle: ShowcaseToggle;
	on: boolean;
	onClick: () => void;
	disabled?: boolean;
	title?: string;
}) {
	return (
		<button
			type="button"
			className={`showcase-toggle${props.on ? ' active' : ''}`}
			data-testid={props.toggle.testId}
			aria-pressed={props.on}
			disabled={props.disabled}
			title={props.title ?? props.toggle.title}
			onClick={props.onClick}
		>
			{props.toggle.label}
		</button>
	);
}
