import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Output into the extension's dist/webview directory so the extension
    // host can serve these assets directly.
    outDir: '../dist/webview',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Single chunk — simplifies VS Code Content Security Policy
        inlineDynamicImports: false,
        manualChunks: undefined,
        entryFileNames: 'index.js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]',
      },
    },
  },
});
