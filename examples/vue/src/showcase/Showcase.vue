<!-- The showcase in Vue: the shell around `examples/showcase/`, which holds the document, the
     plugins and the controls the Svelte and React showcases share. -->
<script setup lang="ts">
import { computed, ref } from 'vue';
import { Aragonite } from '@voithos-labs/aragonite-vue';
import SHOWCASE_DOCUMENT from '../../../showcase/showcase-content.md?raw';
import {
	HANDLES_GATED_TITLE,
	INITIAL_STATE,
	PRESENTATION_MODES,
	TOGGLES,
	handlesGated,
	showsSelectionMenu
} from '../../../showcase/controls';
import { showcasePlugins } from '../../../showcase/plugins';
import { demoPasteImage, resolveDemoImageUrl } from '../../../showcase/image-store';

const source = ref(SHOWCASE_DOCUMENT);
const theme = ref(INITIAL_STATE.theme);
const presentationMode = ref(INITIAL_STATE.presentationMode);
const dragHandles = ref(INITIAL_STATE.dragHandles);
const selectionMenu = ref(INITIAL_STATE.selectionMenu);
const occurrences = ref(INITIAL_STATE.occurrences);
const showSource = ref(INITIAL_STATE.showSource);
const handlesOff = computed(() => handlesGated(presentationMode.value));
</script>

<template>
	<div class="showcase aragonite-editor-theme" :data-editor-theme="theme">
		<header class="showcase-header">
			<span class="showcase-title">aragonite</span>
			<span class="showcase-tag">showcase in Vue</span>
			<button
				type="button"
				:class="['showcase-toggle', { active: theme === 'light' }]"
				:data-testid="TOGGLES.theme.testId"
				:aria-pressed="theme === 'light'"
				@click="theme = theme === 'dark' ? 'light' : 'dark'"
			>
				{{ TOGGLES.theme.label }}
			</button>
			<button
				type="button"
				:class="['showcase-toggle', { active: dragHandles }]"
				:data-testid="TOGGLES.dragHandles.testId"
				:aria-pressed="dragHandles"
				:disabled="handlesOff"
				:title="handlesOff ? HANDLES_GATED_TITLE : undefined"
				@click="dragHandles = !dragHandles"
			>
				{{ TOGGLES.dragHandles.label }}
			</button>
			<button
				type="button"
				:class="['showcase-toggle', { active: selectionMenu }]"
				:data-testid="TOGGLES.selectionMenu.testId"
				:aria-pressed="selectionMenu"
				:title="TOGGLES.selectionMenu.title"
				@click="selectionMenu = !selectionMenu"
			>
				{{ TOGGLES.selectionMenu.label }}
			</button>
			<button
				type="button"
				:class="['showcase-toggle', { active: occurrences }]"
				:data-testid="TOGGLES.occurrences.testId"
				:aria-pressed="occurrences"
				:title="TOGGLES.occurrences.title"
				@click="occurrences = !occurrences"
			>
				{{ TOGGLES.occurrences.label }}
			</button>
			<button
				type="button"
				:class="['showcase-toggle', { active: showSource }]"
				:data-testid="TOGGLES.source.testId"
				:aria-pressed="showSource"
				:title="TOGGLES.source.title"
				@click="showSource = !showSource"
			>
				{{ TOGGLES.source.label }}
			</button>
			<span class="showcase-hint">Mod+F to search</span>
			<div class="showcase-modes" role="group" aria-label="Presentation mode">
				<button
					v-for="mode in PRESENTATION_MODES"
					:key="mode"
					type="button"
					:class="['showcase-mode', { active: presentationMode === mode }]"
					:data-mode="mode"
					@click="presentationMode = mode"
				>
					{{ mode }}
				</button>
			</div>
			<a class="showcase-link" href="https://github.com/voithos-labs/aragonite/tree/main/docs"
				>docs</a
			>
		</header>
		<div class="showcase-body">
			<!-- The plugin set is read at mount, so the occurrences toggle remounts the editor; the
			     bound document carries across. -->
			<Aragonite
				:key="String(occurrences)"
				v-model="source"
				class="showcase-editor"
				:plugins="showcasePlugins(occurrences)"
				:block-drag-handles="dragHandles"
				:on-paste-image="demoPasteImage"
				:resolve-image-url="resolveDemoImageUrl"
				:presentation-mode="presentationMode"
				link-click="plain"
				:selection-toolbar="showsSelectionMenu(presentationMode, selectionMenu)"
				:theme="theme"
			/>
			<pre v-if="showSource" class="showcase-source" data-testid="source-view">{{ source }}</pre>
		</div>
	</div>
</template>
