import type { ManifestV3Export } from '@crxjs/vite-plugin';

import pkg from './package.json';

// `ManifestV3Export` doesn't support `browser_specific_settings` for now (v2.0.0-beta.23).
// So the manifest is validated with `browser._manifest.WebExtensionManifest` instead.
const manifest: browser._manifest.WebExtensionManifest = {
  manifest_version: 3,
  name: pkg.displayName,
  version: pkg.version,
  description: pkg.description,
  homepage_url: pkg.homepage,
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
    process.env.BROWSER_ENV !== 'firefox'
      ? '110' // for `action.setBadgeTextColor`
      : undefined,
  browser_specific_settings:
    process.env.BROWSER_ENV === 'firefox'
      ? { gecko: { strict_min_version: '115' } } // for `storage.session`
      : undefined,
};

export default manifest as ManifestV3Export;
