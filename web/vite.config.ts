import { defineConfig } from 'vite';
import wasm from 'vite-plugin-wasm';

// Config adapted from Midnight's official example-bboard/bboard-ui, which needed
// specific handling for compact-runtime's onchain-runtime WASM module. Vite 8
// bundles via Rolldown (not classic Rollup) and supports top-level await
// natively with target: 'esnext', so vite-plugin-top-level-await (built for
// Rollup) is dropped rather than adapted.
export default defineConfig({
  cacheDir: './.vite',
  build: {
    target: 'esnext',
    minify: false,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes('onchain-runtime')) return 'wasm';
        },
      },
      commonjsOptions: {
        transformMixedEsModules: true,
        extensions: ['.js', '.cjs'],
        ignoreDynamicRequires: true,
      },
    },
  },
  plugins: [wasm()],
  optimizeDeps: {
    include: ['@midnight-ntwrk/compact-runtime'],
  },
  resolve: {
    extensions: ['.mjs', '.js', '.ts', '.jsx', '.tsx', '.json', '.wasm'],
    mainFields: ['browser', 'module', 'main'],
  },
});
