interface EyeDropperResult { sRGBHex: string }
interface EyeDropperOptions { signal?: AbortSignal }
declare class EyeDropper {
  open(options?: EyeDropperOptions): Promise<EyeDropperResult>;
}
