import type * as Core from "../contracts";
import type * as FilesCore from "./files-core";
import type * as Application from "./application";
import type * as Platform from "./platform-host";
export type DocumentContent = Core.DesignSystemContent;
export interface DocumentSaveState extends Platform.SaveState {
  leftOut?: { id: string; cause: FilesCore.UnsendableCause }[];
}
export interface DocumentChange {
  remote?: boolean;
  auto?: boolean;
}
export interface DocumentUndoPair {
  before: DocumentContent;
  after: DocumentContent;
}
export interface UndoCommand extends FilesCore.FileMutation {
  touch(): void;
  spanTheirs(paths: readonly string[], index: Core.FilesIndex): void;
  needsTheirs(seq: number, latest: boolean): boolean;
  retoken(path: string): void;
  keepOut(paths: Iterable<string>): void;
  dropPaths(paths: ReadonlySet<string>): "untouched" | "emptied" | "trimmed";
  readonly dropped: boolean;
  leavesAlone(path: string): boolean;
}
export interface DocumentFlag {
  path: string;
  why: string;
  theirsSha: string | null | undefined;
  since: number;
  clash?: string;
}
export interface DocumentEvent {
  type: string;
  data: unknown;
}
export interface PreReadBase {
  sha: string | null;
  text?: string;
}
export interface RecentPublish {
  text: string;
  sha?: string | null;
  base?: string;
  healed?: boolean;
  at: number;
}
export interface ForeignIndexChange extends FilesCore.FileIndexDelta {
  seq: number;
}
export interface GeneratedReadme {
  text: string;
  wire?: string;
  sha?: string | null;
}
export interface ForeignFileNotice {
  name: string;
  wanted: string;
}
export interface IndexFieldSnapshot {
  title: string;
  manifest: string | undefined;
  ix: Core.FilesIndex;
}
export interface TimedCarriedFile extends FilesCore.CarriedFileEdit {
  at: number;
}
export interface TimedCarriedIndex extends FilesCore.CarriedIndexEdit {
  at: number;
}
export interface CarryStorageState {
  v: 1;
  files: Record<string, TimedCarriedFile>;
  index?: TimedCarriedIndex;
}
export interface HotCarrySnapshot extends FilesCore.CarriedView {
  mine?: Record<string, FilesCore.CarriedFileEdit>;
  unsaved?: Record<string, FilesCore.CarriedFileEdit>;
  unsavedNames?: string[];
  removed?: Record<string, string | null>;
  binariesLeft?: string[];
  binariesNew?: string[];
  indexUnsaved?: boolean;
  index?: FilesCore.CarriedIndexEdit;
}
export interface EntryProblem {
  why: string;
  cause: FilesCore.UnsendableCause;
}
export interface HeldWitness {
  rev: number;
  sha: string;
}
export interface HeldBytesResult {
  value: string;
  witness: HeldWitness;
}
export interface DesignSystemFilesDocumentOptions
  extends Omit<
    FilesCore.FilesDocumentOptions<Core.FilesIndex, DocumentContent>,
    "codec" | "onConflict" | "onIndexMerged" | "onRemoteApplied"
  > {
  port: Core.BrowserFilesPort & Partial<FilesCore.BrowserFilesPortExtended>;
  parseContent(value: unknown): DocumentContent;
  initialContent: DocumentContent;
  defaultTitle?: string;
  lazy?: boolean;
  indexPath?: string;
  clash?: "mine" | "theirs" | "ask";
  generated?: boolean;
  timers?: Core.FilesTimers;
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  stashKey?: string;
  commitMs?: number;
  paced?: boolean;
  isBusy?(): boolean;
  onEvent?(type: string, data: unknown): void;
  onNotice?(message: string): void;
  onHotEvent?: FilesCore.FilesDocumentOptions<
    Core.FilesIndex,
    DocumentContent
  >["onHotEvent"];
  onBeforeRestart?(reason: string): void;
  readOnlyReason?: string;
  saveStash?: Core.FilesCrashStash;
  snapshotView?(flagged: ReadonlySet<string>): FilesCore.CarriedView;
  restoreView?(view: unknown): string[];
  readAt?(url: string): Promise<Uint8Array | null>;
  home?: Readonly<Record<Core.FileKind, "file" | "blob">>;
}
export type BaseFilesDocument = FilesCore.FilesDocument<
  Core.FilesIndex,
  DocumentContent
>;
export interface DesignSystemFilesDocument extends BaseFilesDocument {
  dirty(): boolean;
  regenerate(): string[];
  writeReadmeTail(): Promise<boolean>;
  personChanged(): boolean;
  events(): DocumentEvent[];
  stuck():
    | { code: string; since: number; retryable: boolean; message: string }
    | undefined;
  retryStuck(): void;
  flagged(): Set<string>;
  flags(): Map<string, DocumentFlag>;
  subscribeFlagged(listener: () => void): () => void;
  resolveFlagged(path: string, choice: "mine" | "theirs" | "copy"): void;
  flaggedSides(
    path: string,
  ): Promise<{ mine: string | null; theirs: string | null }>;
  stepCommand(
    label: string,
    pair: () => DocumentUndoPair,
    options?: { applied?: boolean },
  ): UndoCommand;
  bindUndoStack(stack: FilesCore.FileMutationBatch): void;
  neverSaves(path: string, text: string): EntryProblem | undefined;
  editProblem(
    before: DocumentContent,
    after: DocumentContent,
  ): string | undefined;
  heldGone(path: string): boolean;
  heldShaOf(path: string): string | undefined;
  setPreparing(value: boolean): void;
  carrying(): void;
  busy(): boolean;
  sendProblem(path: string, text: string): string | undefined;
  tell(message: string): void;
  heldBytes(path: string): Promise<HeldBytesResult | null>;
  heldStillGood(
    path: string,
    witness: HeldWitness,
  ): "gone" | "changed" | "good";
  materializeOwed(
    read?: (id: string) => Promise<{ bytes: Uint8Array } | null>,
  ): Promise<string[]>;
}
export interface RawHotCarry {
  mine?: unknown;
  unsaved?: unknown;
  unsavedNames?: unknown;
  removed?: unknown;
  binariesLeft?: unknown;
  binariesNew?: unknown;
  indexUnsaved?: unknown;
  index?: unknown;
}
export interface CarryStorageWire {
  files?: Readonly<
    Record<
      string,
      ({ at?: unknown } & Partial<FilesCore.CarriedFileEdit>) | null
    >
  >;
  index?: { at?: unknown } & Partial<FilesCore.CarriedIndexEdit>;
}
export interface FilePublishReport {
  ok: boolean;
  paths: string[];
  version?: string;
  code?: string;
  texts?: Record<string, string | null>;
  shas?: Record<string, string>;
}
export interface DesignSystemTablePort extends FilesCore.SaveQueuePort {
  entryProblemDetail(
    path: string,
    value: Core.FilePublishInput,
  ): EntryProblem | undefined;
}
export interface FileReadMark {
  sha: string | null;
  text?: string;
}
