/**
 * Browser environment adapters used by the shipped happy-dom worker build.
 * DOM parsing and CSS editing do not need Node I/O. VM evaluation stays disabled.
 * These preserve the original worker's small adapters; happy-dom itself comes from npm.
 */
import type { Dynamic } from './types';
const host = globalThis as Dynamic;
if (!host.setImmediate) {
  host.setImmediate = (callback: Dynamic, ...args: Dynamic[]) => setTimeout(callback, 0, ...args);
  host.clearImmediate = (id: Dynamic) => clearTimeout(id);
}
if (!host.process) {
  host.process = {platform: 'browser', arch: '', argv: [], env: {}, versions: {}, on() {}, off() {}, cwd: () => '/'};
}
export class Buffer extends Uint8Array {
  static from(input: Dynamic, ..._options: Dynamic[]): Dynamic {
    return typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input);
  }
  static isBuffer(_input?: Dynamic): boolean { return false; }
  static concat(items: Uint8Array[]): Uint8Array {
    const joined = new Uint8Array(items.reduce((length,item) => length + item.length,0));
    let offset=0;
    for (const item of items) { joined.set(item, offset); offset += item.length; }
    return joined;
  }
  static alloc(length: number): Uint8Array { return new Uint8Array(length); }
}
export const Blob = host.Blob;
export const TextEncoder = host.TextEncoder;
export const TextDecoder = host.TextDecoder;
export const URL = host.URL;
export const URLSearchParams = host.URLSearchParams;
export const ReadableStream = host.ReadableStream;
export const webcrypto = host.crypto;
export const cryptoShim = {webcrypto, randomUUID: () => host.crypto.randomUUID()};
export const fsShim = {promises: {}};
const join = (...segments: string[]) => segments.join('/');
export const pathShim = {join, resolve: join, sep: '/', dirname: (path: string) => path, basename: (path: string) => path, extname: () => ''};
class DisabledStream {}
export const streamShim = {Readable: DisabledStream, Writable: DisabledStream, Transform: DisabledStream, PassThrough: DisabledStream, pipeline() {}};
export class Script {
  constructor(..._args: Dynamic[]) {}
  runInContext(..._args: Dynamic[]): void {}
}
export const vmShim = {Script, createContext() {}, isContext: () => false};
export class PerformanceObserver {
  constructor(..._args: Dynamic[]) {}
  observe(..._args: Dynamic[]) {} disconnect() {} takeRecords() {return [];}
}
export class PerformanceEntry {}
export class WebSocket {
  constructor(..._args: Dynamic[]) {}
}
export const unavailableIo = {};
export const isIP = (_address: string) => 0;
export const spawnSync = (..._args: Dynamic[]) => ({status: 1});

export const childProcessShim = {spawnSync};
