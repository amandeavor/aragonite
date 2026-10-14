'use client';
// The adapter suite's page contract (`examples/adapter-suite/requirements/page-contract.md`), as
// `examples/react` renders it.
import { useState, version } from 'react';
import { Aragonite } from '@voithos-labs/aragonite-react';

const FIRST = '# First note\n\nHello from the first note.\n';
const SECOND = '# Second note\n\nA different document.\n';

export function Demo({ uncontrolled }: { uncontrolled: boolean }) {
	const [loaded, setLoaded] = useState(FIRST);
	const [value, setValue] = useState(FIRST);
	const [theme, setTheme] = useState('light');
	const [themed, setThemed] = useState(true);
	const [shown, setShown] = useState(true);

	function load() {
		setLoaded(SECOND);
		setValue(SECOND);
	}

	return (
		<main>
			<p data-testid="react-version">{version}</p>
			<button data-testid="load" onClick={load}>
				Load another doc
			</button>
			<button data-testid="revert" onClick={() => setValue(loaded)}>
				Revert
			</button>
			<button data-testid="theme" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
				Theme
			</button>
			<button data-testid="drop-theme" onClick={() => setThemed(!themed)}>
				{themed ? 'Drop theme' : 'Pass theme'}
			</button>
			<button data-testid="unmount" onClick={() => setShown(!shown)}>
				{shown ? 'Unmount' : 'Mount'}
			</button>
			{shown && (
				<Aragonite
					{...(uncontrolled ? { defaultValue: FIRST } : { value })}
					onChange={setValue}
					{...(themed ? { theme } : {})}
					header={<input data-testid="header-input" placeholder="Title" />}
					style={{ height: '60vh' }}
				/>
			)}
			<pre data-testid="mirror">{value}</pre>
		</main>
	);
}
