/* eslint-disable no-var */
const globalScope =
  typeof globalThis !== "undefined"
    ? globalThis
    : typeof self !== "undefined"
      ? self
      : typeof window !== "undefined"
        ? window
        : {};

if (!(globalScope as any).process) {
  (globalScope as any).process = { env: {} };
} else if (!(globalScope as any).process.env) {
  (globalScope as any).process.env = {};
}
