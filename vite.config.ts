import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const pages = mode === 'pages';
  const repository = process.env.GITHUB_REPOSITORY?.split('/')[1] || 'tier';
  return {
    plugins: [react()],
    base: pages ? (repository.endsWith('.github.io') ? '/' : `/${repository}/`) : '/',
    build: { outDir: pages ? 'dist-pages' : 'dist' },
    define: { 'import.meta.env.VITE_STATIC_SITE': JSON.stringify(pages ? 'true' : 'false') },
  };
});
