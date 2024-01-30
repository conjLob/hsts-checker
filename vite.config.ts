import { crx } from '@crxjs/vite-plugin';
import devtools from 'solid-devtools/vite';
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

import manifest from './manifest.config.ts';

import tsconfig from './tsconfig.json';

const PORT = 3000;

export default defineConfig({
  plugins: [
    crx({
      manifest,
      browser: process.env.BROWSER_ENV === 'firefox' ? 'firefox' : 'chrome',
    }),
    solid(),
    devtools(),
  ],
  server: {
    strictPort: true,
    port: PORT,
    hmr: {
      // By default, the HMR port number is detected from `import.meta.url`.
      // But in extensions, `import.meta.url` will be like `chrome-extension://<ID>/...`.
      // So the port must be manually specified to match the dev server.
      clientPort: PORT,
    },
  },
  preview: {
    strictPort: true,
    port: PORT,
  },
  build: {
    target: tsconfig.compilerOptions.target,
  },
});
