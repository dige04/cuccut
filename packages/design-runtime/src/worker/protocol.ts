import type { DeckMetadata, FileSdk, RuntimeOptions } from "./types";
export interface InitCommand extends RuntimeOptions {
  kind: "init";
  html: string;
  deck?: DeckMetadata | null;
  verbs?: DeckMetadata | null;
  sdk?: FileSdk | null;
}
export type WorkerCommand =
  | InitCommand
  | { kind: "chunk"; text: string }
  | { kind: "flush" }
  | { kind: "end" }
  | { kind: "view"; id: string; req?: unknown }
  | { kind: "handles"; since?: number; req?: unknown };
export interface HandleRow {
  k: string;
  file: string;
  tag: string;
  words: string;
}
export type PreviewTarget =
  | { root: true }
  | { file: string | null; id: string | null };
export interface SequencedMessage {
  seq: number;
  stmt: string;
}
export interface DoneMessage extends SequencedMessage {
  kind: "done";
  n: number;
  changed?: string[];
  logged?: number;
  skipped?: boolean;
  handles?: string[];
  threw?: { message: string };
}
export type WorkerMessage =
  | { kind: "ready" }
  | { kind: "beat" }
  | { kind: "log"; message: string; n?: number; cut?: boolean }
  | {
      kind: "error";
      message: string;
      stmt: string;
      code?: string;
      seq?: number;
      slideId?: string;
    }
  | (SequencedMessage & {
      kind: "html";
      html: string;
      slideId?: string | null;
      final?: boolean;
    })
  | DoneMessage
  | (SequencedMessage & { kind: "op"; op: FileOperation })
  | { kind: "touch"; seq: number; n: number; slideId?: string }
  | {
      kind: "view";
      req?: unknown;
      slideId: string;
      attr: "id";
      prefix: string;
      html: string;
    }
  | {
      kind: "handles";
      req?: unknown;
      attr: "id";
      prefix: string;
      rows: HandleRow[];
    }
  | {
      kind: "preview";
      seq: number;
      method: string;
      target: PreviewTarget | null;
      html: string;
      head: string;
    }
  | (SequencedMessage & {
      kind: "deck";
      order: string[];
      added: { id: string; html: string }[];
      clones: { id: string; cloneOf: string }[];
      removed: string[];
    });
/** v2 before/after placement; v3 where is decoded by the canvas host. */
export interface FilePlacement {
  before?: string;
  after?: string;
  where?: unknown;
}
export type FileOperation =
  | ({ op: "add"; html: string; id?: string } & FilePlacement)
  | ({ op: "move"; id: string } & FilePlacement)
  | ({
      op: "duplicate";
      id: string;
      newId?: string;
      minted?: boolean;
    } & FilePlacement)
  | { op: "remove"; id: string }
  | { op: "order"; ids: string[] }
  | { op: "title"; title: string }
  | {
      op: "section";
      action: "start" | "remove" | "rename";
      id: string;
      title?: string;
    }
  | { op: "undo" }
  | { op: "askClaude"; prompt?: string };
/** A compiler-enforced exhaustive branch for consumers of the protocol. */
export function assertNever(value: never): never {
  throw new Error("Unhandled worker message: " + String(value));
}
