/** JSON values accepted at serialization boundaries. Undefined is permitted in in-memory records. */
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };
export type DataRecord = Record<string, unknown>;
export interface VersionedIndex extends DataRecord {
  v: number;
}
export interface LeafMergePolicy {
  kind: "leaf";
}
export interface MapMergePolicy {
  kind: "map";
  keys?: Record<string, MergePolicy>;
  of?: MergePolicy;
}
export interface ListMergePolicy {
  kind: "list";
  membersOf?: string;
}
export interface RecordsMergePolicy {
  kind: "records";
  by: string;
}
export type MergePolicy =
  | LeafMergePolicy
  | MapMergePolicy
  | ListMergePolicy
  | RecordsMergePolicy;
export interface MergeContext {
  conflicts?: string[];
  externalMembers?: (
    path: string,
  ) => ReadonlySet<string> | readonly string[] | undefined;
}
export interface IndexReadResult {
  text: string;
  sha256: string | null;
}
export interface IndexTextPort {
  readText(path: string): Promise<IndexReadResult>;
}
export type IndexWriteListener = (
  path: string,
  serialize: () => string,
  baseSha: string | null,
) => void;
/** Nested values are normalized by the application codec; the index layer checks version/container kinds. */
export interface IndexStateOptions<Index extends VersionedIndex> {
  path: string;
  empty(): Index;
  port: IndexTextPort;
  schema: MergePolicy;
  maxVersion?: number;
  externalMembers?: MergeContext["externalMembers"];
  validate?: (record: VersionedIndex) => record is Index;
}
export interface IndexFileState<Index extends VersionedIndex> {
  readonly path: string;
  parse(text: string): Index;
  load(): Promise<Index>;
  loadText(text: string, sha256: string | null): Index;
  init(index?: Index | null): Index;
  get(): Index;
  base(): Index;
  baseSha(): string | null;
  dirty(): boolean;
  lastConflicts(): string[];
  update(change: (index: Index) => void): void;
  mergeFrom(remote: Index): Index;
  serialize(): string;
  bind(listener?: IndexWriteListener): void;
  markSaved(text: string, sha256: string | null): void;
  reloadAndMerge(): Promise<string[]>;
}
export type IndexFileErrorCode = "unreadable" | "newer_version" | "not_found";
export interface IndexFileErrorInstance extends Error {
  code: IndexFileErrorCode;
}
export interface IndexFileErrorConstructor {
  new (code: IndexFileErrorCode, message: string): IndexFileErrorInstance;
}

/** A concrete document type is exposed only when its decoder validates it. */
export interface ValidatedIndexStateOptions<Index extends VersionedIndex>
  extends IndexStateOptions<Index> {
  validate(record: VersionedIndex): record is Index;
}
