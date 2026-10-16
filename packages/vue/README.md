# @voithos-labs/aragonite-vue

[aragonite](https://github.com/voithos-labs/aragonite), the Markdown block editor, as a Vue component. You hand it Markdown, edit it as styled blocks with the markers dimmed, and read plain Markdown back, no in-between format.

Works with Vue 3.3 and newer, Nuxt included.

## Install

The component sits on the core package and releases with it, at the exact same version, so install both:

```bash
npm install @voithos-labs/aragonite @voithos-labs/aragonite-vue
```

## Use it

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { Aragonite, type AragoniteInstance } from '@voithos-labs/aragonite-vue';
import '@voithos-labs/aragonite/style.css';
import '@voithos-labs/aragonite/styles/editor-theme.css';

const text = ref('# Grocery list\n\n- eggs\n- more eggs\n');
const editor = ref<AragoniteInstance | null>(null);
</script>

<template>
	<Aragonite ref="editor" v-model="text" theme="light" style="height: 70vh">
		<template #header><input placeholder="Title" /></template>
	</Aragonite>
</template>
```

- `v-model` keeps the document in your state, or pass `default-value` and skip the binding.
- Every other prop is an editor option (`theme`, `presentation-mode`, `plugins`, and the rest), kebab-case or not.
- The `header` slot shows above the first block.
- A template ref holds `handle`, the editor's handle (`getSource()`, `runCommand()`, `getEvents()`, ...), `null` until it mounts.
- In Nuxt it works as is, no `<ClientOnly>`; list the two stylesheets in `nuxt.config`'s `css` array.

## More

The [consumer guide](https://github.com/voithos-labs/aragonite/blob/main/docs/guide/consumer-guide.md#vue) has the rest: every prop, the handle's methods, events, theming, and which plugins run outside a Svelte app. It also ships in `node_modules/@voithos-labs/aragonite/docs/guide/`, matching the version you installed.

## License

[MPL-2.0](LICENSE)
