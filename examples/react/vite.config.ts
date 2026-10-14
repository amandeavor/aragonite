import path from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `--mode react18` builds the same app on React 18 (installed in `react-18/`), the oldest React
// the wrapper supports.
const react18 = (name: string) => path.resolve(import.meta.dirname, 'react-18/node_modules', name);

export default defineConfig(({ mode }) => ({
	plugins: [react()],
	resolve: {
		alias:
			mode === 'react18'
				? { react: react18('react'), 'react-dom': react18('react-dom') }
				: undefined,
		dedupe: ['react', 'react-dom']
	}
}));
