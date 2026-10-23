<!-- A box whose children the editor mounts into `BlockChildren`. -->
<script setup lang="ts">
import { BlockChildren, type BlockViewProps } from '@voithos-labs/aragonite-vue';

defineProps<BlockViewProps<'container'>>();
</script>

<template>
	<span class="box-badge">box by vue</span>
	<BlockChildren class="box-children" />
</template>
