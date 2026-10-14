<!-- Editors sharing one plugin: the app hands the first three the plugin out of reactive state, as
     the list, the list's entries, and entries in a plain list, and the last one the plugin as
     imported (`requirements/page-contract.md` § Vue). -->
<script setup lang="ts">
import { ref } from 'vue';
import { definePlugin } from '@voithos-labs/aragonite/plugin';
import { Aragonite } from '@voithos-labs/aragonite-vue';

const notePlugin = definePlugin({ name: 'note', setup() {} });
const held = ref([notePlugin]);
</script>

<template>
	<main>
		<Aragonite :plugins="held" default-value="Held in reactive state." />
		<Aragonite :plugins="held.filter(() => true)" default-value="Filtered from reactive state." />
		<Aragonite :plugins="held.map((plugin) => ({ plugin }))" default-value="Wrapped as entries." />
		<Aragonite :plugins="[notePlugin]" default-value="Passed as imported." />
	</main>
</template>
