import { crx } from '@crxjs/vite-plugin';
import { defineConfig } from 'vite';

import manifest from './manifest.config.ts';

import tsconfig from './tsconfig.json';

const PORT = 3000;

export default defineConfig({
  plugins: [
    crx({
      manifest,
      browser: process.env.BROWSER_ENV === 'firefox' ? 'firefox' : 'chrome',
    }),
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
    // Store policy allows code minification. But, users should be able to
    // read the installed code and evaluate its safety, so do not minify.
    // https://developer.chrome.com/docs/webstore/program-policies/code-readability
    // https://extensionworkshop.com/documentation/publish/source-code-submission/
    minify: false,
  },
});
