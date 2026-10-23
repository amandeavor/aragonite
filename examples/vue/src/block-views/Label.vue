<!-- A click-to-edit label: the text shows only while the caret is in it, beside a preview that
     follows it as it's typed. -->
<script setup lang="ts">
import { computed } from 'vue';
import { LeafContent, type BlockViewProps } from '@voithos-labs/aragonite-vue';

const props = defineProps<BlockViewProps<'render-primary'>>();
const caption = computed(() => (props.draft ?? props.state.node.raw).slice('@@ '.length).trim());
</script>

<template>
	<template v-if="state.revealed">
		<LeafContent class="label-source" />
		<span class="label-preview">{{ caption }}</span>
	</template>
	<span v-else class="label-text">{{ caption }}</span>
</template>
