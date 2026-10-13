import type { Id } from './domain.ts';

/** A random ID with a prefix, for example `conv_6f1c…`. Both the browser and Node have `crypto.randomUUID`. */
export function newId(prefix: string): Id {
  return `${prefix}_${globalThis.crypto.randomUUID().replaceAll('-', '')}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}
