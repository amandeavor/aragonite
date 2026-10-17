<script>
	import { Editor } from '@voithos-labs/aragonite/svelte';
	import '@voithos-labs/aragonite/styles/editor-theme.css';

	let editor;
	const source =
		'> That is not dead which can eternal lie,\n> And with strange aeons even death may die.\n';
</script>

<Editor bind:this={editor} {source} theme="light" />
