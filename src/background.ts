import browser from 'webextension-polyfill';

type HSTS = {
  maxAge: number;
  includeSubDomains: boolean;
  preload: boolean;
};

type Fetching = {
  fetching: true;
};

type SecurityHeaders = {
  fetching: false;
  hsts?: HSTS;
};

type SecurityHeadersOrFetching = SecurityHeaders | Fetching;

const parseHSTS = (hsts: string): HSTS | undefined => {
  const directives = hsts.replace(/[ "]/g, '').toLowerCase().split(';');

  const maxAge = directives.find((d) => d.startsWith('max-age='))?.slice(8);
  if (maxAge === undefined) return;

  return {
    maxAge: Number.parseInt(maxAge),
    includeSubDomains: directives.includes('includesubdomains'),
    preload: directives.includes('preload'),
  };
};

const fetchSecurityHeaders = async (
  url: string,
  cacheOnly: boolean,
): Promise<SecurityHeadersOrFetching | undefined> => {
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
      credentials: 'omit',
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
    hsts: hsts ? parseHSTS(hsts) : undefined,
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
  } catch {
    // Quota exceeded
    await browser.storage.session.clear();
    await browser.storage.session.set({ [host]: cache });
  }
  return cache;
};

const removeCache = async (host: string) => {
  await browser.storage.session.remove(host);
};

const setBadge = async (tabId: number, secHeaders: SecurityHeaders) => {
  const secure = secHeaders.hsts !== undefined && secHeaders.hsts.maxAge > 0;

  await browser.action.setBadgeText({
    text: secure ? '✓' : '✕',
    tabId,
  });
  browser.action.setBadgeTextColor({
    color: secure ? '#28a745' : '#dc3545',
    tabId,
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

    await setCache(new URL(url).host, {
      fetching: false,
      hsts: header ? parseHSTS(header) : undefined,
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
