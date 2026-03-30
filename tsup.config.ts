import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['extension/index.ts'],
  format: ['cjs'],
  // 'vscode' is provided by the VS Code runtime — never bundle it
  external: ['vscode'],
  sourcemap: true,
  clean: true,
  outDir: 'dist',
});
