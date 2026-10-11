import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sitePages } from './scripts/site-pages-plugin';
import { SITE } from './src/site';

export default defineConfig(({ mode }) => {
  const pages = mode === 'pages';
  return {
    plugins: [react(), sitePages()],
    base: pages ? new URL(SITE.url).pathname : '/',
    build: { outDir: pages ? 'dist-pages' : 'dist' },
    define: { 'import.meta.env.VITE_STATIC_SITE': JSON.stringify(pages ? 'true' : 'false') },
  };
});
