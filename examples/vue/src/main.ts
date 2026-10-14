import { createApp } from 'vue';
import '@voithos-labs/aragonite/style.css';
import '@voithos-labs/aragonite/styles/editor-theme.css';
import App from './App.vue';
import SharedPlugin from './SharedPlugin.vue';

const query = new URLSearchParams(location.search);
const page = query.has('shared-plugin')
	? createApp(SharedPlugin)
	: createApp(App, { uncontrolled: query.has('uncontrolled') });
page.mount('#app');
