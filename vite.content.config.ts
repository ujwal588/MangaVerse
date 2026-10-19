import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  esbuild: {
    charset: 'ascii',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/content/index.ts'),
      name: 'MangaVerseContent',
      formats: ['iife'],
      fileName: () => 'src/content/index.js',
    },
  },
});

