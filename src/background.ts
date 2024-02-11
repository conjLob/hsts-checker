import browser from './browser.ts';
import {
  fetchSecurityHeaders,
  isHSTS,
  updateCacheWithHeaders,
} from './headers.ts';

const setBadge = async (tabId: number, secure: boolean) => {
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

      await setBadge(tabId, isHSTS(secHeaders));
      return;
    }

    await updateCacheWithHeaders(new URL(url).host, responseHeaders);
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

    await setBadge(tabId, isHSTS(secHeaders));
  },
  {
    url: [{ schemes: ['https'] }],
  },
);
