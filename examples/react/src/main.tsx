import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@voithos-labs/aragonite/style.css';
import '@voithos-labs/aragonite/styles/editor-theme.css';
import '../../adapter-suite/block-views.css';
import { App } from './App';
import { BlockViews } from './BlockViews';

const query = new URLSearchParams(location.search);

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		{query.has('block-views') ? <BlockViews /> : <App uncontrolled={query.has('uncontrolled')} />}
	</StrictMode>
);
