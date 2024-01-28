import { crx } from '@crxjs/vite-plugin';
import devtools from 'solid-devtools/vite';
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

import manifest from './manifest.config.ts';

export default defineConfig({
  plugins: [crx({ manifest }), solid(), devtools()],
  server: {
    strictPort: true,
    port: 3000,
    hmr: {
      // In extension, `import.meta.url` will be `chrome-extension://<ID>/...`.
      // So the HMR port must be explicitly set to `3000` to match the dev server.
      clientPort: 3000,
    },
  },
  preview: {
    strictPort: true,
    port: 3000,
  },
  build: {
    target: 'ES2022',
  },
});
