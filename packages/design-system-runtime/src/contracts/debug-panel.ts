import type * as Core from "./files-core";
export type DebugSide = "bottom" | "right";
export type DebugEventLevel =
  | "hot"
  | "save"
  | "boot"
  | "room"
  | "error"
  | "other";
export interface DebugEvent {
  t: number;
  type: string;
  data?: unknown;
}
export interface DebugEventData {
  status?: number;
  ok?: boolean;
  changed?: { path: string; klass?: string }[] | null;
  decision?: unknown;
  from?: unknown;
  to?: unknown;
  toSeq?: unknown;
  required?: unknown;
  why?: unknown;
  early?: unknown;
  path?: unknown;
  attempt?: unknown;
  msAfterAdopt?: unknown;
  paths?: unknown;
  applied?: unknown;
  rows?: unknown;
  ms?: unknown;
  grantLagMs?: unknown;
  retries?: unknown;
  reason?: unknown;
  error?: unknown;
  timedOut?: unknown;
  heldMs?: unknown;
  carried?: unknown;
  regions?: { template: unknown; script: unknown; outer: unknown };
  guard?: { baseTheirs: unknown; baseMine: unknown };
  overlapList?: { name: string; to: unknown; theirs: unknown }[];
  overlaps?: unknown;
  file?: unknown;
  trigger?: unknown;
  choice?: unknown;
  how?: unknown;
  n?: unknown;
  bytes?: unknown;
  version?: unknown;
  code?: unknown;
  raw?: unknown;
  name?: unknown;
  fresh?: boolean;
}
export interface DebugEventDescription {
  cls: string;
  text: string | undefined;
}
export interface DebugPeerPing {
  tab: string;
  n: number;
  phase: "saving" | "saved";
  version?: string;
  at: number;
  recvAt: number;
  paths?: unknown[];
}
export interface DebugPeerWire {
  tab?: unknown;
  n?: unknown;
  phase?: unknown;
  version?: unknown;
  at?: unknown;
  paths?: unknown;
}
export interface DebugRoomPeer {
  sameTab?: unknown;
  presence?: { hotdbg?: DebugPeerWire };
}
export interface DebugRoom {
  on?: (
    topic: string,
    success: (event: unknown) => void,
    failure: () => void,
  ) => unknown;
  onPeers?: (
    success: (event: { peers: readonly unknown[] }) => void,
  ) => unknown;
  presence?: (value: { hotdbg: DebugPingSent }) => Promise<unknown> | undefined;
  emit?: (topic: string, value: DebugPingSent) => Promise<unknown>;
}
export interface DebugPingSent {
  tab: string;
  at: number;
  n: number;
  phase: "saving" | "saved";
  version?: string;
  paths?: string[];
}
export type DebugPingInput = Omit<DebugPingSent, "tab" | "at">;
export interface DebugRestartBreadcrumb {
  phase: "hot-restart" | "publishing";
  reason?: string;
  paths?: string[];
  at: number;
}
export interface DebugReload {
  t: number;
  reason: string;
}
export interface DebugPublish {
  t: number;
  paths: string[];
  bytes: number;
}
export interface DebugLastPublish {
  n: number;
  ms: number;
  version?: string;
  at: number;
}
export interface DebugPublishError {
  t: number;
  n: number;
  code?: string;
  raw?: unknown;
}
export interface DebugPublishOutcome {
  ok: boolean;
  version?: string;
  code?: string;
  raw?: unknown;
}
export interface DebugVisibilitySample {
  how: string;
  ms: number;
}
export interface DebugPhase {
  name: string;
  ms: number;
}
export interface DebugPanelUi {
  open: boolean;
  side: DebugSide;
  size: Record<DebugSide, number>;
  tab: string;
  kinds: Record<DebugEventLevel, boolean>;
  text: string;
  paused: boolean;
}
export interface DebugStoredUi
  extends Partial<Omit<DebugPanelUi, "size" | "kinds">> {
  size?: Partial<DebugPanelUi["size"]>;
  kinds?: Partial<DebugPanelUi["kinds"]>;
}
/** Private session records are written by this panel under its product prefix. */
export interface DebugStoredValues {
  tab: string;
  log: DebugEvent[];
  crumb: DebugRestartBreadcrumb | null;
  seen: boolean;
  reasons: Record<string, number>;
  reloads: DebugReload[];
  pings: DebugPeerPing[];
  saveN: number;
  ui: DebugStoredUi;
  open: boolean;
  [key: `opt/${string}`]: boolean;
}
export interface DebugToggle {
  label: string;
  on: boolean;
}
export type DebugHotEvent = Core.FilesHotEvent & {
  shape?: "calls" | "strings";
};
export interface DebugQuantiles {
  p50: number;
  p95: number;
  max: number | undefined;
  n: number;
}
export type DebugSavePairs = Partial<Record<"saving" | "saved", DebugPeerPing>>;
