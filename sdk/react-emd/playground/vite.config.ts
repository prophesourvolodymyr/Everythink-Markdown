import { defineConfig } from 'vite';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: __dirname,
  resolve: {
    alias: {
      '@everthink/react-emd': resolve(__dirname, '../src/index.ts'),
      '@live-md': resolve(__dirname, '../src/live-md'),
    },
  },
  server: {
    port: 5173,
    open: false,
  },
  build: {
    outDir: resolve(__dirname, '../dist-playground'),
    emptyOutDir: true,
  },
});
