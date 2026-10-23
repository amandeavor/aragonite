<!-- A click-to-edit label: the text shows only while the caret is in it. -->
<script setup lang="ts">
import { LeafContent, type BlockViewProps } from '@voithos-labs/aragonite-vue';

defineProps<BlockViewProps<'render-primary'>>();
</script>

<template>
	<LeafContent v-if="state.revealed" class="label-source" />
	<span v-else class="label-text">{{ state.node.raw.slice('@@ '.length).trim() }}</span>
</template>
