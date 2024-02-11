/// <reference types="vite/client" />

declare namespace browser.runtime {
  // biome-ignore lint/suspicious/noExplicitAny: to match `chrome.runtime.sendMessage` interface
  function sendMessage<M = any, R = any>(message: M): Promise<R>;
}

declare namespace browser.tabs {
  // biome-ignore lint/suspicious/noExplicitAny: to match `chrome.tabs.sendMessage` interface
  function sendMessage<M = any, R = any>(tabId: number, message: M): Promise<R>;
}
