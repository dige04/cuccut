import type { OwnedBytes } from "./export";
export type UnicodeRange = [start: number, end: number];
export type FontLoadState = "unloaded" | "loading" | "loaded" | "error";
export interface FontDescriptor {
  family: string;
  style: string;
  weight: string;
  unicodeRange: string;
  status: FontLoadState;
}
export interface ExportFontFace {
  family: string;
  face: string;
  ranges: string | null;
  coversSpace: boolean;
  files: string[];
}
export interface FontUsageIndex {
  byRule: Map<string, string[]>;
  drawnByFamily: Map<string, Set<string>>;
}
export interface FontPruning {
  keep: Set<string>;
  leave: Set<string>;
}
export interface ExportAsset {
  data: OwnedBytes;
  mime: string;
}
export type ExportAssetResolver = (
  url: string,
  options?: unknown,
) => Promise<ExportAsset | null>;
export interface FontAwareResolver {
  resolve: ExportAssetResolver;
  leftOut(): string[];
}
