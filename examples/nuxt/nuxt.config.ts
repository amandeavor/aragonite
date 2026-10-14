// The repo root is an npm workspace, and Nuxt would otherwise take it for this app's workspace.
export default defineNuxtConfig({
	workspaceDir: import.meta.dirname,
	css: ['@voithos-labs/aragonite/style.css', '@voithos-labs/aragonite/styles/editor-theme.css'],
	app: { head: { title: 'aragonite in Nuxt' } },
	telemetry: false,
	compatibilityDate: '2026-10-01'
});
