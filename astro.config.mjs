import { defineConfig } from 'astro/config';
import editor from './integrations/editor.mjs';

export default defineConfig({
  site: 'https://hbd.duckll.tw',
  integrations: [editor()],
});
