/** Contracts recovered from the file browser, Markdown DOM serializer and editing call sites. */
import type * as React from "react";
import type {
  FileKind,
  FileTable,
  ParsedDesignSystem,
  MarkdownBlockSource,
  MarkdownFormatState,
} from "../contracts";
export type BrowserFileType =
  | "html"
  | "deck"
  | "jsx"
  | "css"
  | "js"
  | "image"
  | "md"
  | "json"
  | "other";
export type BrowserEntryType = BrowserFileType | "folder";
export type BrowserSection =
  | "Folders"
  | "Pages"
  | "Components"
  | "Stylesheets"
  | "Scripts"
  | "Images"
  | "Documents"
  | "Data"
  | "Other";
export interface BrowserListingEntry {
  path: string;
  size?: number;
  contentType?: string;
  attachment?: unknown;
  notCarried?: boolean;
}
export interface BrowserFile extends BrowserListingEntry {
  kind: "file";
  name: string;
  type: BrowserFileType;
}
export interface BrowserFolder {
  kind: "folder";
  name: string;
  path: string;
  folders: BrowserFolder[];
  files: BrowserFile[];
}
export type BrowserEntry = BrowserFile | BrowserFolder;
export interface BrowserRow {
  entry: BrowserEntry;
  depth: number;
  pos: number;
  of: number;
  section?: BrowserSection;
  first?: boolean;
}
export interface BrowserFileMetadata {
  size?: unknown;
  contentType?: unknown;
}
export interface VirtualFileStack {
  tops: number[];
  total: number;
}
export type VirtualFileItem =
  | { kind: "section"; label: BrowserSection; first: boolean }
  | { kind: "row"; row: BrowserRow; at: number };
export type FileBrowserSource =
  | { url: string }
  | { text: string }
  | { dataUri: string };
export interface FileBrowserReads {
  retryMs: number;
  fresh: boolean;
}
export interface FileDownloadSpec {
  url?: string;
  type?: string;
}
export interface DownloadData {
  bytes: Uint8Array<ArrayBuffer>;
  contentType: string;
}
export interface HttpError extends Error {
  status: number;
}
export interface BrowserPreviewOptions {
  htmlAsText?: boolean;
}
export interface BrowserReveal {
  path: string;
  n: number;
}
export type BrowserCustomPreview = (
  file: BrowserFile,
  width: number,
) => React.ReactNode | undefined;
export interface FilesBrowserProps extends BrowserPreviewOptions {
  tree: BrowserFolder;
  onClose(): void;
  sourceOf?(file: BrowserFile): FileBrowserSource;
  retryMs?: number;
  fresh?: boolean;
  downloadOf?(file: BrowserFile): FileDownloadSpec | undefined;
  typeOf?(file: BrowserFile): BrowserFileType | undefined;
  whyNot?(file: BrowserFile): string | undefined;
  openFile?(file: BrowserFile): (() => void) | undefined;
  preview?: BrowserCustomPreview;
  kindLine?(file: BrowserFile, label: string): string;
  tipOf?(file: BrowserFile, place: "row" | "card"): string | undefined;
  footerOf?(file: BrowserFile): React.ReactNode;
  rootLabel?: string;
  emptyText?: string;
  reveal?: BrowserReveal | null;
}
export interface BrowserBreadcrumbProps {
  root: string;
  folder: string;
  onEnter(path: string): void;
}
export interface BrowserHeadingProps {
  label: BrowserSection;
  first?: boolean;
  top: number;
  pinned?: boolean;
}
export interface BrowserRowProps {
  id: string;
  row: BrowserRow;
  top: number;
  type: BrowserEntryType;
  kind: string;
  tip?: string;
  selected: boolean;
  expanded: boolean;
  dimmed?: string;
  onSelect(): void;
  onOpen(): void;
  onToggle(): void;
}
export interface BrowserIconProps {
  type: BrowserEntryType;
  size: number;
}
export interface BrowserPreviewProps extends BrowserPreviewOptions {
  entry?: BrowserEntry;
  type: BrowserEntryType;
  kind: string;
  tip?: string;
  whyNot?: string;
  big?: boolean;
  withheld?: boolean;
  source?: FileBrowserSource;
  reads: FileBrowserReads;
  preview?: BrowserCustomPreview;
  download?: FileDownloadSpec;
  footer?: React.ReactNode;
  onOpen?(): void;
}
export interface BrowserPreviewCardProps extends BrowserPreviewOptions {
  entry: BrowserEntry;
  type: BrowserEntryType;
  tip?: string;
  tall?: boolean;
  source?: FileBrowserSource;
  reads: FileBrowserReads;
  preview?: BrowserCustomPreview;
  onOpen?(): void;
}
export interface BrowserImagePreviewProps {
  file: BrowserFile;
  source: FileBrowserSource;
  retryMs: number;
  tall?: boolean;
}
export interface BrowserTextPreviewProps {
  source: FileBrowserSource;
  reads: FileBrowserReads;
  tall?: boolean;
}
export interface BrowserDownloadButtonProps {
  file: BrowserFile;
  from: FileDownloadSpec;
  source: FileBrowserSource;
  reads: FileBrowserReads;
  withheld: boolean | undefined;
  noHover: boolean;
}
export interface BrowserDownloadState {
  tip: string | undefined;
  note: string | null;
  busy: boolean;
  run(): void;
}
export interface FileHomeContext {
  leftOut: ReadonlySet<string>;
  held(path: string): boolean;
  bareCover?: boolean;
  listsSection?(id: string): boolean;
}
export type FileHome =
  | { at: "nowhere" | "written" }
  | { at: "section"; id: string };
export interface DesignFilesDocument {
  flagged?(): Iterable<string>;
  readOnly?(): boolean;
  subscribeFlagged?(listener: () => void): () => void;
}
export interface DesignFilesSection {
  id: string;
  label: string;
}
export interface DesignFilesBrowserProps {
  doc: DesignFilesDocument;
  snap: Pick<
    ParsedDesignSystem,
    "files" | "otherFiles" | "docsLeftOut" | "components"
  >;
  sections: DesignFilesSection[];
  jump(id: string): void;
  mayEdit: boolean;
}
export type FileListingState =
  | null
  | "failed"
  | { files: BrowserListingEntry[]; narrowed: boolean };
export interface ExternalFileListing {
  files?: Record<string, unknown> | null;
  narrowed?: boolean;
}
export type ListingUncertainty = "listing" | "failed" | "narrowed";
export interface DesignFilesLayerProps {
  files: FileTable;
  doc: DesignFilesDocument;
  page: FileHomeContext;
  sections: DesignFilesSection[];
  listed: BrowserListingEntry[];
  paths: string[];
  reveal: BrowserReveal | null;
  unsure: ListingUncertainty | null;
  retry(): void;
  onClose(): void;
  goTo(id: string): void;
}
export interface UsageNoteEditorProps {
  value?: string;
  label: string;
  onChange?(value: string): void;
  onDone?(): void;
  title?: string;
  placeholder?: string;
  size?: "note" | "doc";
  "data-testid"?: string;
  anchorKey?: string;
}
export interface NotesPopoverEditorProps
  extends Omit<UsageNoteEditorProps, "data-testid"> {
  title: string;
  takeCaret?: boolean;
  stripPress: React.RefObject<boolean>;
  popup: React.RefObject<HTMLElement | null>;
  onClose(): void;
  testid?: string;
}
export interface ToolbarSelectOption {
  value: string;
  label: React.ReactNode;
  text?: string;
}
export interface ToolbarSelectProps {
  value: string | null;
  options: ToolbarSelectOption[];
  onChange(value: string): void;
  title: string;
  testid?: string;
  chipLabel?: React.ReactNode;
  popoverClassName?: string;
  disabled?: boolean;
  popupAttrs?: React.HTMLAttributes<HTMLDivElement>;
}
export type MarkdownBlockKind = MarkdownFormatState["block"];
export type MarkdownCommand =
  | "bold"
  | "italic"
  | "ul"
  | "ol"
  | "p"
  | "h2"
  | "h3"
  | "quote"
  | "unlink";
export interface ComposingEvent {
  nativeEvent?: { isComposing?: boolean };
  isComposing?: boolean;
  keyCode?: number;
}
export interface MarkdownInlineOutput {
  s: string;
  ticks: number;
}
export interface MarkdownSource extends MarkdownBlockSource {
  at: number;
}
export interface MarkdownSerializedItem {
  text: string;
  typed: boolean;
  source?: MarkdownSource;
}
export interface MarkdownEditorProps {
  markdown: string;
  onMarkdown?(markdown: string): void;
  onDone?(): void;
  placeholder?: string;
  readOnly?: boolean;
  label?: string;
  testId?: string;
  stripClassName?: string;
}
export type FileContentSections = Partial<Record<FileKind, string>>;
