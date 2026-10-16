// A server component rendering the wrapper itself, which works only because the wrapper marks
// itself a client component.
import { Aragonite } from '@voithos-labs/aragonite-react';

export default function ServerPage() {
	return <Aragonite value={'# Rendered by a server component\n'} theme="light" />;
}
