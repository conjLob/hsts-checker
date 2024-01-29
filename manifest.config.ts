import { defineManifest } from '@crxjs/vite-plugin';

import pkg from './package.json';

export default defineManifest({
  manifest_version: 3,
  name: 'HSTS Checker',
  version: pkg.version,
  action: {
    default_popup: 'index.html',
  },
  background: {
    service_worker: 'src/background.ts',
  },
  permissions: ['webRequest', 'webNavigation', 'storage'],
  host_permissions: ['https://*/*'],
});
