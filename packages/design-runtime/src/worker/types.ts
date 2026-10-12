/** Values supplied by generated edit programs and versioned SDK payloads. */
// The code being edited is intentionally dynamic. Keep its boundary explicit.
export type Dynamic = any;
export interface RuntimeLimits {
  maxLines: number;
  maxChars: number;
  maxHtml: number;
  maxStmt: number;
  maxMsg: number;
  maxLogs: number;
  idleRunMs: number;
  splitter: "stream" | "lines";
  previewMs: number;
}
export interface Pace {
  frameCharsPerMs: number;
  frameMs: number;
  previewCharsPerMs: number;
  maxPreviews: number;
}
export interface RuntimeOptions {
  previewMs?: number;
  pace?: Pace;
  chains?: boolean;
}
export interface FileMetadata {
  id: string;
  title?: string;
}
export interface DeckMetadata {
  current: string;
  slides: FileMetadata[];
}
export interface FileSdk {
  version: 2 | 3;
  texts?: Record<string, string>;
  layouts?: Record<string, string>;
  title?: string;
  sections?: Array<{ start: string; title: string }>;
  paths?: Record<string, string>;
  names?: Record<string, string | null>;
}
import type { WorkerMessage } from "./protocol";
export type {
  WorkerMessage,
  WorkerCommand,
  FileOperation,
  DoneMessage,
} from "./protocol";
export type EmitWorkerMessage = (message: WorkerMessage) => void;
export interface EditRuntime {
  init(
    html: string,
    deck?: DeckMetadata | null,
    verbs?: DeckMetadata | null,
    sdk?: FileSdk | null,
    options?: RuntimeOptions,
  ): boolean;
  chunk(text: string): void;
  end(): void;
  flush(): void;
  finish(): void;
  exec(
    code: string,
    compiled?: (...args: unknown[]) => unknown,
    chain?: boolean,
  ): boolean;
  view(id: string, request?: unknown): void;
  handles(since?: number, request?: unknown): void;
  readonly html: string;
}
export interface StatementLocation {
  chain: boolean;
  start: number;
  end: number;
}
export interface StatementStream {
  push(chunk: string): void;
  end(): void;
  reset(): void;
  tail(): string;
  readonly count: number;
}
export interface StatementStreamOptions {
  joinChains?: boolean;
  regexAfterKeywords?: boolean;
  detailed?: boolean;
  onStatement?: (
    code: string,
    index: number,
    location: StatementLocation,
  ) => void;
  onError?: (error: unknown) => void;
  onDone?: (result: { statements: number; incomplete: boolean }) => void;
}

export interface DetailedStatement extends StatementLocation {
  code: string;
  index: number;
}
export interface SplitStatementsResult<Statement = string> {
  statements: Statement[];
  incomplete: string | null;
}

export interface StatementFailure extends Error {
  code?: "ENDED" | "INCOMPLETE";
  tail?: string;
  open?: string;
}
