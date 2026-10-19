import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        dashboard: resolve(__dirname, 'src/dashboard/index.html'),
        offscreen: resolve(__dirname, 'src/offscreen/index.html'),
        background: resolve(__dirname, 'src/background/index.ts'),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') {
            return 'src/background/index.js';
          }
          return 'assets/[name]-[hash].js';
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            if (assetInfo.name.includes('ReaderHUD')) {
              return 'src/content/hud/ReaderHUD.css';
            }
          }
          return 'assets/[name]-[hash].[ext]';
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'node',
  }
});
