/** Platform APIs referenced in the shipped browser application. */
declare class EyeDropper {
  open(options?: { signal?: AbortSignal }): Promise<{ sRGBHex: string }>;
}

/** Optional CommonJS host used by the preserved bundler compatibility helper. */
declare const require: (id: string) => unknown;
