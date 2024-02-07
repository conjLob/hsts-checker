type Browser = typeof self.browser | typeof self.chrome;

const browser: Browser = self.browser ?? self.chrome;

export default browser;
