import { createApp } from 'vue';
import '@voithos-labs/aragonite/style.css';
import '@voithos-labs/aragonite/styles/editor-theme.css';
import App from './App.vue';
import TwoEditors from './TwoEditors.vue';

const query = new URLSearchParams(location.search);
const page = query.has('two-editors')
	? createApp(TwoEditors)
	: createApp(App, { uncontrolled: query.has('uncontrolled') });
page.mount('#app');
