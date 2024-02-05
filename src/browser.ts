export default (self.browser ?? self.chrome) as
  | typeof self.browser
  | typeof self.chrome;
