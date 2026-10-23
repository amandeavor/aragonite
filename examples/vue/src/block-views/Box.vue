<!-- A box whose children the editor mounts into `BlockChildren`. `data-length` changes with every
     edit inside the box, so `BlockChildren` re-renders while its children are typed in. -->
<script setup lang="ts">
import { BlockChildren, type BlockViewProps } from '@voithos-labs/aragonite-vue';

defineProps<BlockViewProps<'container'>>();
</script>

<template>
	<span class="box-badge">box by vue</span>
	<BlockChildren class="box-children" :data-length="state.node.raw.length" />
</template>
