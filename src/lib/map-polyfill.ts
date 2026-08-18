// pdfjs-dist v6 uses the very new Map.prototype.getOrInsert / getOrInsertComputed
// methods, which are missing in Safari/iOS and older Chrome. Polyfill them so
// PDF parsing works on mobile browsers.
type AnyMap = Map<unknown, unknown> & {
  getOrInsert?: (key: unknown, value: unknown) => unknown;
  getOrInsertComputed?: (key: unknown, fn: (key: unknown) => unknown) => unknown;
};

export function installMapPolyfill() {
  const proto = Map.prototype as unknown as AnyMap;
  if (typeof proto.getOrInsert !== "function") {
    proto.getOrInsert = function (key: unknown, value: unknown) {
      if (!this.has(key)) this.set(key, value);
      return this.get(key);
    };
  }
  if (typeof proto.getOrInsertComputed !== "function") {
    proto.getOrInsertComputed = function (key: unknown, fn: (key: unknown) => unknown) {
      if (!this.has(key)) this.set(key, fn(key));
      return this.get(key);
    };
  }
}

installMapPolyfill();
