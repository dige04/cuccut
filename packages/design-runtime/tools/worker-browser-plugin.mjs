// esbuild plugin for the fast-edit Worker (src/worker/sandbox.ts): the Worker runs the canvas with happy-dom, and the Node built-in modules it needs are all swapped for the browser implementations in src/worker/browser-node-shims.ts (I/O is unavailable throughout).
// Used by apps/design-editor/build.mjs when building fast-edit-worker.js.

import { fileURLToPath } from 'node:url';

const adapter = fileURLToPath(new URL('../src/worker/browser-node-shims.ts', import.meta.url));

/** Node built-in module → the name exported from the shim file. */
const modules = {
  buffer: 'export {Buffer, Blob}',
  crypto: 'export {cryptoShim as default, webcrypto}',
  util: 'export {TextEncoder, TextDecoder}',
  url: 'export {URL, URLSearchParams}',
  'stream/web': 'export {ReadableStream}',
  stream: 'export {streamShim as default}',
  vm: 'export {vmShim as default, Script}',
  fs: 'export {fsShim as default}',
  path: 'export {pathShim as default}',
  net: 'export {isIP}',
  perf_hooks: 'export {PerformanceObserver, PerformanceEntry}',
  child_process: 'export {spawnSync, childProcessShim as default}',
  ws: 'export {WebSocket as default}',
  http: 'export {unavailableIo as default}',
  https: 'export {unavailableIo as default}',
  zlib: 'export {unavailableIo as default}',
};

export function workerBrowserPlugin() {
  return {
    name: 'worker-browser-environment',
    setup(build) {
      build.onResolve(
        { filter: /^(?:node:)?(?:buffer|crypto|util|url|stream(?:\/web)?|vm|fs|path|net|perf_hooks|child_process|ws|http|https|zlib)$/ },
        (args) => ({ path: args.path.replace(/^node:/, ''), namespace: 'worker-node-adapter' }),
      );
      build.onResolve({ filter: /.*/, namespace: 'worker-node-adapter' }, (args) => ({ path: args.path, namespace: 'file' }));
      build.onLoad({ filter: /.*/, namespace: 'worker-node-adapter' }, (args) => ({
        contents: `${modules[args.path]} from ${JSON.stringify(adapter)};`,
        loader: 'js',
      }));
    },
  };
}
