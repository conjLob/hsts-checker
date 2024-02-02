import { defineManifest } from '@crxjs/vite-plugin';

import pkg from './package.json';

export default defineManifest({
  manifest_version: 3,
  name: pkg.displayName,
  version: pkg.version,
  description: pkg.description,
  action: {
    default_popup: 'index.html',
  },
  background: {
    service_worker: 'src/background.ts', // Chrome, Edge
    scripts: ['src/background.ts'], // Firefox
  },
  permissions: ['webRequest', 'webNavigation', 'storage'],
  host_permissions: ['https://*/*'],
  minimum_chrome_version:
    process.env.BROWSER_ENV !== 'firefox' ? '102' : undefined,
});
