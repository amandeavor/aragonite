import type { ReactNode } from 'react';
import '@voithos-labs/aragonite/style.css';
import '@voithos-labs/aragonite/styles/editor-theme.css';

export const metadata = { title: 'aragonite in Next' };

export default function RootLayout({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}
