import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@voithos-labs/aragonite/style.css';
import '@voithos-labs/aragonite/styles/editor-theme.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<App uncontrolled={new URLSearchParams(location.search).has('uncontrolled')} />
	</StrictMode>
);
