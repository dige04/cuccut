// 快速编辑 Worker（src/worker/sandbox.ts）的 esbuild 插件：Worker 里用 happy-dom 跑画板，
// 它要的 Node 内置模块都换成 src/worker/browser-node-shims.ts 里的浏览器实现（I/O 一律不可用）。
// apps/design-editor/build.mjs 打 fast-edit-worker.js 时用。

import { fileURLToPath } from 'node:url';

const adapter = fileURLToPath(new URL('../src/worker/browser-node-shims.ts', import.meta.url));

/** Node 内置模块 → 从适配文件里转出的名字。 */
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
