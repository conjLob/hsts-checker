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

const preload = new Set(preloadList);

const checkPreload = (host: string): PreloadHSTS | undefined => {
  const domain = host.split(':')[0].split('.');
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

type Fetching = {
  fetching: true;
};

type SecurityHeaders = {
  fetching: false;
  hsts?: HSTS | PreloadHSTS;
};

export const isHSTS = (secHeaders: SecurityHeaders): boolean => {
  return (
    secHeaders.hsts !== undefined &&
    (secHeaders.hsts.preloaded || secHeaders.hsts.maxAge > 0)
  );
};

type HttpHeaders =
  | globalThis.browser.webRequest.HttpHeaders
  | globalThis.chrome.webRequest.HttpHeader[];

const parseSecurityHeaders = (
  headers: Headers | HttpHeaders,
): SecurityHeaders => {
  const find: (header: string) => string | undefined =
    headers instanceof Headers
      ? (h) => headers.get(h) ?? undefined
      : (h) => headers.find(({ name }) => name.toLowerCase() === h)?.value;

  const hsts = find('strict-transport-security');

  return {
    fetching: false,
    hsts: hsts ? parseHSTS(hsts) : undefined,
  };
};

export const fetchSecurityHeaders = async (
  url: string,
  cacheOnly: boolean,
): Promise<SecurityHeaders | Fetching | undefined> => {
  const { host } = new URL(url);

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

  return await updateCacheWithHeaders(host, headers);
};

export const updateCacheWithHeaders = async (
  host: string,
  headers: Headers | HttpHeaders,
): Promise<SecurityHeaders> => {
  const secHeaders = parseSecurityHeaders(headers);

  return await setCache(host, {
    ...secHeaders,
    hsts: secHeaders.hsts ?? checkPreload(host),
  });
};

export const getCache = async (
  host: string,
): Promise<SecurityHeaders | Fetching | undefined> => {
  return (await browser.storage.session.get(host))[host];
};

const setCache = async <T extends SecurityHeaders | Fetching>(
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
