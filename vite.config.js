import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// Build autonome : tout (JS + CSS) est inliné dans dist/index.html, aucun fetch externe.
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  server: { port: 5173, host: true },
  build: { target: 'es2020', assetsInlineLimit: 100000000, chunkSizeWarningLimit: 4000 },
});
