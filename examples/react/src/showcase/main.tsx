import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/700.css';
import '@voithos-labs/aragonite/style.css';
import '@voithos-labs/aragonite/styles/editor-theme.css';
import '../../../showcase/showcase.css';
import '../../../showcase/showcase-bar.css';
import '../../../showcase/tag-marks.css';
import { Showcase } from './Showcase';

createRoot(document.getElementById('root')!).render(
	<StrictMode>
		<Showcase />
	</StrictMode>
);
