<!-- Two editors sharing one plugin: the app holds the first one's plugins in reactive state and
     hands the second the plugin as imported (`requirements/page-contract.md` § Vue). -->
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
		<Aragonite :plugins="[notePlugin]" default-value="Passed as imported." />
	</main>
</template>
