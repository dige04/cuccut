/** Optional Chromium API used by the original color picker. */
interface EyeDropper {
  open(options?: { signal?: AbortSignal }): Promise<{ sRGBHex: string }>;
}
declare var EyeDropper: {
  prototype: EyeDropper;
  new (): EyeDropper;
};
