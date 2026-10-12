import type { Size } from "./geometry";
export type OwnedBytes = Uint8Array<ArrayBuffer>;
export interface StoredZipEntry {
  name: string;
  data: string | OwnedBytes;
}
export interface ExportNameOptions {
  slide?: number | null;
}
export type ExportNameAllocator = (path: string, title?: string) => string;
export type PaperSizeName = "letter" | "a4";
export interface PaperSize {
  label: string;
  wPt: number;
  hPt: number;
}
export interface ExportArtboard extends Size {
  paper?: PaperSizeName;
  print?: "flow";
  frameless?: boolean;
  expand?: "fill";
}
export interface ImageCaptureScale {
  scale: number;
  outW: number;
  outH: number;
  fits: boolean;
}
export type ExportHeight = number | "fits" | "capped";
export interface CssImageUrl {
  full: string;
  url: string;
}
export interface EmbeddedCssImageUrl extends CssImageUrl {
  d: string;
}
