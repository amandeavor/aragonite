<script>
	import { Editor } from '@voithos-labs/aragonite/svelte';
	import '@voithos-labs/aragonite/styles/editor-theme.css';

	let editor;
	const source = '# Hello\n';
</script>

<Editor bind:this={editor} {source} theme="light" />
