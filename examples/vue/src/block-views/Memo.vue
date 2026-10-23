<!-- A memo line: the editor edits its text in `LeafContent`, and the badge reads the host app's
     `provide`, which reaches it through `vueBlockView`'s `app` option. -->
<script setup lang="ts">
import { inject } from 'vue';
import { LeafContent, type BlockViewProps } from '@voithos-labs/aragonite-vue';

defineProps<BlockViewProps<'leaf'>>();
const badge = inject('badge-text', 'no provider');
</script>

<template>
	<span class="memo-badge">{{ badge }}</span>
	<LeafContent class="memo-text" />
</template>
