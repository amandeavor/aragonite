<!-- An editor given a boolean option as a bare attribute, which Vue reads as `true` only for a prop
     declared `Boolean` (`requirements/page-contract.md` § Vue). -->
<script setup lang="ts">
import { Aragonite } from '@voithos-labs/aragonite-vue';
</script>

<template>
	<main>
		<Aragonite search-bar default-value="Searchable through a bare attribute." />
	</main>
</template>
