import { crx } from '@crxjs/vite-plugin';
import devtools from 'solid-devtools/vite';
import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [crx({ manifest }), solid(), devtools()],
  server: {
    port: 3000,
  },
  build: {
    target: 'esnext',
  },
});
