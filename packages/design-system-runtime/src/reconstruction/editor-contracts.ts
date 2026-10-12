/** Contracts recovered from shipped app.js statements 3895–4631.
 * These describe the bundle's existing boundary shapes; they add no validation.
 */
export type EditorLinkMode = "live" | "edit" | (string & {});
export interface EditorLinkOptions {
  storedUrl?: boolean;
}
export interface InlineMarkdownOptions {
  escapes?: boolean;
  literalUnsafeLinks?: boolean;
  linksTo?: ReadonlySet<string>;
  links?: EditorLinkMode;
  linkTabIndex?: number;
}
export type InlineMarkdownToken =
  | { kind: "text" | "bold" | "italic" | "code"; text: string }
  | { kind: "link"; text: string; href: string };
export interface MarkdownCodeSpan {
  start: number;
  end: number;
  from: number;
  to: number;
}
export type MarkdownBlock =
  | { type: "p" | "h1" | "h2" | "h3" | "code" | "quote"; text: string }
  | { type: "ul" | "ol"; items: string[] }
  | { type: "divider" }
  | { type: "img"; src: string; alt: string; size: "s" | "m" | "full" }
  | { type: "table"; header: boolean; rows: string[][] };
export interface MarkdownBlockSource {
  text: string;
  lead: string;
}
export interface MarkdownParseResult {
  blocks: MarkdownBlock[];
  sources: MarkdownBlockSource[];
}
export interface MarkdownFormatState {
  bold: boolean;
  italic: boolean;
  ul: boolean;
  ol: boolean;
  code: boolean;
  block: "p" | "h1" | "h2" | "h3" | "quote" | "pre";
  link?: string;
}
export interface MarkdownCommitClock {
  now(): number;
  setTimeout(
    callback: () => void,
    delay: number,
  ): ReturnType<typeof setTimeout>;
  clearTimeout(timer: ReturnType<typeof setTimeout>): void;
}
export interface MarkdownCommitQueue<T> {
  push(value: T, commit: (value: T) => void): void;
  flush(): void;
  pending(): boolean;
  dispose(): void;
}
export interface IndexBlobRecord {
  name: string;
  blob: string;
  size: number;
  type: string;
  sha256?: string;
  storedSha256?: string;
}
export interface FilesIndexAssetGroup {
  name: string;
  order: string[];
  files: Record<string, IndexBlobRecord>;
  tile?: "xs" | "s" | "m" | "l" | "xl";
}
export interface FilesIndex {
  v: number;
  layout: "files";
  title: string;
  namespace?: string;
  libraries: unknown[];
  sections: Record<string, string>;
  groups: string[];
  assetGroups: Record<string, FilesIndexAssetGroup>;
  blobs: Record<string, IndexBlobRecord>;
  docs: { readme?: string; sections: string[] };
  source?: unknown;
  upgraded?: unknown;
  editing?: unknown;
  convertedFrom?: Record<string, unknown>;
  createdOnFiles?: Record<string, unknown>;
}
export type FileStorageClassification =
  | { to: "derived" }
  | { to: "record"; id: string; owed: boolean }
  | { to: "file"; owed: boolean };
export interface UnpublishableFileProblem {
  why: string;
  cause: "name" | "kind" | "unreadable" | "damaged_text";
}
export type MergeSchema =
  | { kind: "leaf" }
  | { kind: "map"; keys?: Record<string, MergeSchema>; of?: MergeSchema }
  | { kind: "records"; by: string }
  | { kind: "list"; membersOf?: string };
export interface MergeOptions {
  conflicts?: string[];
  externalMembers?: (path: string) => ReadonlySet<string> | undefined;
}
export interface AddressedFileLoadState {
  last?: string;
  loads: number;
  src?: string;
  loaded: boolean;
  stay: boolean;
  again: boolean;
  other: boolean;
  gaveUpAt: string | null;
  next: { src?: string } | null;
  refused: { under?: string } | null;
  rounds: number;
}
export interface PublishedFileFacts {
  sha256: string;
  size: number;
  contentType: string;
}
export interface PublishedFileReference {
  url: string;
  integrity: string;
}
export interface SwatchRuntimeTag {
  src: string;
  integrity: string;
}
export interface SwatchFontReference extends PublishedFileReference {
  face?: { family: string; weight: string; style: string };
}
export interface SwatchPublishedUrls {
  bundleCss?: PublishedFileReference;
  bundleJs?: PublishedFileReference;
  runtimeScripts: Array<PublishedFileReference | undefined>;
  fonts: SwatchFontReference[];
}
export interface SwatchHead {
  tokensCss: string;
  fontsCss: string;
  fontsCssHeld?: string;
  fontsKey: string;
  bundleCss: string;
  bundleJs: string;
  runtimeScripts: string[];
  runtimeTags?: SwatchRuntimeTag[];
  urls?: SwatchPublishedUrls;
  themeId?: string;
  mode?: "light" | "dark";
  colorScheme?: "light" | "dark";
}
export interface SwatchDocumentOptions {
  html: string;
  title: string;
  head: SwatchHead;
  doc?: Document;
  win?: Window;
  cardFile?: string;
  declaredHeight?: number;
  runnerAskMs?: number;
  fromProps?: boolean;
  urlOffered?: (url: string) => boolean;
  onUrlMissed?: (reference: PublishedFileReference & { file: string }) => void;
  onNavigated(): void;
  onReady?: (height?: number) => void;
  onContentHeight?: (height: number) => void;
  onError?: (reason?: "react") => void;
  onUndelivered?: () => void;
}
export interface AssetSelection {
  selected: string[];
  anchor: string | null;
  focus: string | null;
}
export type AssetDropTarget =
  | { kind: "new" }
  | { kind: "group"; group: string }
  | { kind: "slot"; group: string; before: string | null };
export interface AssetDragState {
  lead: string;
  ids: string[];
  target: AssetDropTarget | null;
}
export interface AssetUploadBatchState {
  rateLimited: boolean;
}
export interface UploadedAssetFile {
  file: File;
  kind: string | null;
  name: string;
}
export interface AssetUploadRecord {
  store: "blob";
  id: string;
  sha256: string;
  bytes: number;
  type: string;
  name: string;
  addedAt: string;
  via: "page";
  url?: string;
}
export type AssetUploadResult =
  | {
      ok: true;
      fileName: string;
      value: string;
      tier: "inline";
      warning?: string;
    }
  | {
      ok: true;
      fileName: string;
      value: string;
      tier: "blob";
      record: AssetUploadRecord;
      deduped?: boolean;
    }
  | { ok: false; reason: string; handOff?: string };
