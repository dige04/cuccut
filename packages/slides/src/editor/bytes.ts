/** 浏览器和 Node 都能用的字节小工具（Web Crypto、btoa/atob）。 */
import type { Sha256 } from '../file-protocol.ts';

export async function bytesOf(content: string | Blob): Promise<Uint8Array> {
  return typeof content === 'string' ? new TextEncoder().encode(content) : new Uint8Array(await content.arrayBuffer());
}

export function toBase64(bytes: Uint8Array): string {
  let s = '';
  // 分块转，避免大文件时 String.fromCharCode 的参数个数超限
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

export async function sha256Hex(bytes: Uint8Array): Promise<Sha256> {
  const digest = await crypto.subtle.digest('SHA-256', bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** 拷一份独立的 ArrayBuffer（Uint8Array 可能只是更大缓冲区的一段）。 */
export function ownBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer;
}
