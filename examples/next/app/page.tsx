import { Demo } from './demo';

export default async function Page({
	searchParams
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	return <Demo uncontrolled={'uncontrolled' in (await searchParams)} />;
}
