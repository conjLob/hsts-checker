import browser from './browser.ts';

import preloadList from './preload.json';

type HSTS = {
  preloaded: false;
  maxAge: number;
  includeSubDomains: boolean;
  preload: boolean;
};

type PreloadHSTS = {
  preloaded: true;
  publicSuffix: string;
};

type Fetching = {
  fetching: true;
};

type SecurityHeaders = {
  fetching: false;
  hsts?: HSTS | PreloadHSTS;
};

type SecurityHeadersOrFetching = SecurityHeaders | Fetching;

const preload = new Set(preloadList);

const checkPreload = (hostname: string): PreloadHSTS | undefined => {
  const domain = hostname.split('.');
  if (domain.length < 2) return;

  const tld = domain[domain.length - 1];
  if (preload.has(tld)) {
    return {
      preloaded: true,
      publicSuffix: tld,
    };
  }

  const sld = domain.slice(-2).join('.');
  if (preload.has(sld)) {
    return {
      preloaded: true,
      publicSuffix: sld,
    };
  }
};

const parseHSTS = (hsts: string): HSTS | undefined => {
  const directives = hsts.replace(/[ "]/g, '').toLowerCase().split(';');

  const maxAge = directives.find((d) => d.startsWith('max-age='))?.slice(8);
  if (maxAge === undefined) return;

  return {
    preloaded: false,
    maxAge: Number.parseInt(maxAge),
    includeSubDomains: directives.includes('includesubdomains'),
    preload: directives.includes('preload'),
  };
};

const fetchSecurityHeaders = async (
  url: string,
  cacheOnly: boolean,
): Promise<SecurityHeadersOrFetching | undefined> => {
  const { host, hostname } = new URL(url);

  const cache = await getCache(host);
  if (cache !== undefined || cacheOnly) return cache;

  await setCache(host, { fetching: true });

  let headers: Headers;
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      cache: 'no-store',
      redirect: 'manual',
    });
    headers = res.headers;
  } catch (e) {
    console.warn(e);
    await removeCache(host);
    return;
  }

  const hsts = headers.get('strict-transport-security');

  return await setCache(host, {
    fetching: false,
    hsts: hsts ? parseHSTS(hsts) : checkPreload(hostname),
  });
};

const getCache = async (
  host: string,
): Promise<SecurityHeadersOrFetching | undefined> => {
  return (await browser.storage.session.get(host))[host];
};

const setCache = async <T extends SecurityHeadersOrFetching>(
  host: string,
  cache: T,
): Promise<T> => {
  try {
    await browser.storage.session.set({ [host]: cache });
    return cache;
  } catch (e) {
    // Firefox doesn't support `storage.session.getBytesInUse` and `QUOTA_BYTES` yet.
    // https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions/API/storage/StorageArea/getBytesInUse
    const size = await browser.storage.session.getBytesInUse?.();
    const limit =
      'QUOTA_BYTES' in browser.storage.session
        ? browser.storage.session.QUOTA_BYTES
        : 1_000_000; // 1MB

    if (
      (e instanceof Error && e.name === 'QuotaExceededError') || // This error is out of W3C WebExtensions spec.
      (size !== undefined && size > limit * 0.9)
    ) {
      console.info(e);
      await browser.storage.session.clear();
      await browser.storage.session.set({ [host]: cache });
      return cache;
    }

    throw e;
  }
};

const removeCache = async (host: string) => {
  await browser.storage.session.remove(host);
};

const setBadge = async (tabId: number, secHeaders: SecurityHeaders) => {
  const secure =
    secHeaders.hsts !== undefined &&
    (secHeaders.hsts.preloaded || secHeaders.hsts.maxAge > 0);

  await browser.action.setBadgeText({
    text: secure ? '✓' : '✕',
    tabId,
  });
  await browser.action.setBadgeTextColor({
    color: secure ? '#34d058' : '#ea4a5a',
    tabId,
  });
  await browser.action.setBadgeBackgroundColor({
    color: '#282828',
  });
};

browser.webRequest.onResponseStarted.addListener(
  async ({ url, method, responseHeaders, fromCache, tabId }) => {
    if (responseHeaders === undefined) return;

    if (fromCache) {
      const secHeaders = await fetchSecurityHeaders(url, method !== 'GET');
      if (secHeaders === undefined || secHeaders.fetching) return;

      await setBadge(tabId, secHeaders);
      return;
    }

    const header = responseHeaders.find(
      ({ name }) => name.toLowerCase() === 'strict-transport-security',
    )?.value;

    const { host, hostname } = new URL(url);

    await setCache(host, {
      fetching: false,
      hsts: header ? parseHSTS(header) : checkPreload(hostname),
    });
  },
  {
    urls: ['https://*/*'],
    types: ['main_frame'],
  },
  ['responseHeaders'],
);

browser.webNavigation.onCommitted.addListener(
  async ({ url, transitionType, frameId, tabId }) => {
    if (frameId !== 0) return;

    const secHeaders = await fetchSecurityHeaders(
      url,
      transitionType === 'form_submit',
    );
    if (secHeaders === undefined || secHeaders.fetching) return;

    await setBadge(tabId, secHeaders);
  },
  {
    url: [{ schemes: ['https'] }],
  },
);
