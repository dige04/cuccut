/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { SlidesHost } from "../../../slides/src/editor/slides-host";

/** A peer's published cursor; every field comes from the host and is untrusted. */
export interface PeerCursorPresence {
  /** Surface the cursor is on (slide or grid tile key). */
  s?: unknown;
  [field: string]: unknown;
}
/** Where a peer is working (deck, slide, selection); untrusted host data. */
export interface PeerContextPresence {
  deck?: unknown;
  slideId?: unknown;
  selected?: unknown;
  [field: string]: unknown;
}
/** Display identity a peer publishes: `n` name, `c` color index. */
export interface PeerWhoPresence {
  n?: unknown;
  c?: unknown;
}
/** Everything a peer publishes through the room. */
export interface RoomPeerPresence {
  cursor?: PeerCursorPresence | null;
  context?: PeerContextPresence | null;
  who?: PeerWhoPresence | null;
  [field: string]: unknown;
}
/** A normalized entry of the host's peer list. */
export interface RoomPeer {
  peer: string;
  /** Account id, or null for anonymous peers. */
  by: string | null;
  isMe: boolean;
  sameTab: boolean;
  presence: RoomPeerPresence;
  updatedAt: number;
}
/** Partial presence update sent to the host (a field set to null clears it). */
export interface RoomPresencePatch {
  cursor?: unknown;
  context?: unknown;
  who?: unknown;
  [field: string]: unknown;
}
/** Peer-list notification from the host; `peers` is validated by `normalizeRoomPeers`. */
export interface RoomPeersEvent {
  peers?: unknown;
}
/** The host's `room` capability. CucCut's own host omits it, so every member is optional. */
export interface HostRoom {
  presence?(patch: RoomPresencePatch): Promise<unknown>;
  onPeers?(
    onChange: (event: RoomPeersEvent) => void,
    onClose?: () => void,
  ): (() => void) | void;
  /** Event subscription used by diagnostics. */
  on?(...args: unknown[]): unknown;
  [member: string]: unknown;
}
/** Host object that may carry a `room` capability next to the declared ones. */
export type RoomHost = SlidesHost & { room?: HostRoom };
/** Outcome of publishing presence: sent, retry later, or room unavailable. */
export type RoomPresenceResult = "ok" | "retry" | "off";
/** `useSyncExternalStore`-shaped store of the current peer list. */
export interface RoomPeerStore {
  getSnapshot: () => readonly RoomPeer[];
  subscribe: (listener: () => void) => () => boolean;
}
interface RawRoomPeer {
  peer?: unknown;
  by?: unknown;
  isMe?: unknown;
  sameTab?: unknown;
  /** Untrusted: only object values are kept. */
  presence?: RoomPeerPresence | string | number | boolean | null;
  updatedAt?: unknown;
}

declare module "../bindings" {
  interface RuntimeBindings {
    hasHostRoomApi: () => boolean;
    resolveHostRoom: () => Promise<HostRoom | null>;
    hostErrorCode: (error: unknown) => string;
    reportRoomPresence: (
      presence: RoomPresencePatch,
    ) => Promise<RoomPresenceResult>;
    roomApiOwner: SlidesHost | undefined;
    roomApiPromise: Promise<HostRoom | null> | undefined;
    cachedHostRoom: () => Promise<HostRoom | null>;
    EMPTY_ROOM_PEERS: readonly RoomPeer[];
    normalizeRoomPeers: (peers: unknown) => readonly RoomPeer[];
    roomPeers: readonly RoomPeer[];
    roomPeerSubscribers: Set<() => void>;
    roomPeerListenerStarted: boolean;
    roomPeerUnsubscribe: (() => void) | null;
    startRoomPeerListener: () => void;
    roomPeerStore: RoomPeerStore;
  }
}

export function installHostRoomPresence(runtime: RuntimeBindings): () => void {
  var roomApiOwner: SlidesHost | undefined;
  var roomApiPromise: Promise<HostRoom | null> | undefined;
  var EMPTY_ROOM_PEERS: readonly RoomPeer[];
  var roomPeers: readonly RoomPeer[];
  var roomPeerSubscribers: Set<() => void>;
  var roomPeerListenerStarted: boolean;
  var roomPeerUnsubscribe: (() => void) | null;
  var roomPeerStore: RoomPeerStore;
  function hasHostRoomApi(): boolean {
    let slidesHost: RoomHost | undefined = globalThis.slidesHost;
    return (
      typeof slidesHost?.use === "function" ||
      typeof slidesHost?.room?.presence === "function"
    );
  }
  async function resolveHostRoom(): Promise<HostRoom | null> {
    let slidesHost: RoomHost | undefined = globalThis.slidesHost;
    try {
      if (typeof slidesHost?.use === "function") {
        let value = await (0, runtime.loadHostCapability)("room");
        if (typeof value === "object" && value !== null) {
          return value as HostRoom;
        } else {
          return null;
        }
      }
    } catch {
      return null;
    }
    if (typeof slidesHost?.room?.presence === "function") {
      return slidesHost.room;
    } else {
      return null;
    }
  }
  function hostErrorCode(error: unknown): string {
    let value =
      typeof error === "object" && error !== null
        ? (error as { code?: unknown }).code
        : "";
    if (typeof value === "string") {
      return value;
    } else {
      return "";
    }
  }
  async function reportRoomPresence(
    presence: RoomPresencePatch,
  ): Promise<RoomPresenceResult> {
    let value = await resolveHostRoom();
    if (typeof value?.presence !== "function") {
      return "off";
    }
    try {
      await value.presence.call(value, presence);
      return "ok";
    } catch (value2) {
      let value3 = hostErrorCode(value2);
      if (value3 === "upstream_error") {
        return "retry";
      }
      if (value3 === "invalid_argument") {
        console.warn("appifact room: rejected presence patch", value2);
      }
      return "off";
    }
  }
  function cachedHostRoom(): Promise<HostRoom | null> {
    let slidesHost: SlidesHost | undefined = globalThis.slidesHost;
    if (roomApiPromise === undefined || roomApiOwner !== slidesHost) {
      roomApiOwner = slidesHost;
      roomApiPromise = resolveHostRoom();
    }
    return roomApiPromise;
  }
  function normalizeRoomPeers(peers: unknown): readonly RoomPeer[] {
    if (!Array.isArray(peers)) {
      return EMPTY_ROOM_PEERS;
    }
    let items: RoomPeer[] = [];
    for (let value of peers as unknown[]) {
      if (typeof value !== "object" || value === null) {
        continue;
      }
      let value2: RawRoomPeer = value;
      if (typeof value2.peer !== "string") {
        continue;
      }
      items.push({
        peer: value2.peer,
        by:
          typeof value2.by === "string" && value2.by !== "" ? value2.by : null,
        isMe: value2.isMe === true,
        sameTab: value2.sameTab === true,
        presence:
          typeof value2.presence === "object" && value2.presence !== null
            ? value2.presence
            : {},
        updatedAt: typeof value2.updatedAt === "number" ? value2.updatedAt : 0,
      });
    }
    return items;
  }
  function startRoomPeerListener(): void {
    if (roomPeerListenerStarted) {
      return;
    }
    roomPeerListenerStarted = true;
    cachedHostRoom().then((input) => {
      if (typeof input?.onPeers !== "function" || !roomPeerListenerStarted) {
        return;
      }
      try {
        let value = input.onPeers.call(
          input,
          (input2) => {
            roomPeers = normalizeRoomPeers(input2.peers);
            for (let value2 of [...roomPeerSubscribers]) value2();
          },
          () => {
            roomPeers = EMPTY_ROOM_PEERS;
            for (let value2 of [...roomPeerSubscribers]) value2();
          },
        );
        if (typeof value === "function") {
          roomPeerUnsubscribe = value;
        }
      } catch {}
    });
  }
  bindRuntimeValue(runtime, "hasHostRoomApi", () => hasHostRoomApi);
  bindRuntimeValue(runtime, "resolveHostRoom", () => resolveHostRoom);
  bindRuntimeValue(runtime, "hostErrorCode", () => hostErrorCode);
  bindRuntimeValue(runtime, "reportRoomPresence", () => reportRoomPresence);
  bindRuntimeValue(
    runtime,
    "roomApiOwner",
    () => roomApiOwner,
    (value) => {
      roomApiOwner = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "roomApiPromise",
    () => roomApiPromise,
    (value) => {
      roomApiPromise = value;
    },
  );
  bindRuntimeValue(runtime, "cachedHostRoom", () => cachedHostRoom);
  bindRuntimeValue(
    runtime,
    "EMPTY_ROOM_PEERS",
    () => EMPTY_ROOM_PEERS,
    (value) => {
      EMPTY_ROOM_PEERS = value;
    },
  );
  bindRuntimeValue(runtime, "normalizeRoomPeers", () => normalizeRoomPeers);
  bindRuntimeValue(
    runtime,
    "roomPeers",
    () => roomPeers,
    (value) => {
      roomPeers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "roomPeerSubscribers",
    () => roomPeerSubscribers,
    (value) => {
      roomPeerSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "roomPeerListenerStarted",
    () => roomPeerListenerStarted,
    (value) => {
      roomPeerListenerStarted = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "roomPeerUnsubscribe",
    () => roomPeerUnsubscribe,
    (value) => {
      roomPeerUnsubscribe = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "startRoomPeerListener",
    () => startRoomPeerListener,
  );
  bindRuntimeValue(
    runtime,
    "roomPeerStore",
    () => roomPeerStore,
    (value) => {
      roomPeerStore = value;
    },
  );
  return () => {
    EMPTY_ROOM_PEERS = Object.freeze([]);
    roomPeers = EMPTY_ROOM_PEERS;
    roomPeerSubscribers = new Set();
    roomPeerListenerStarted = false;
    roomPeerUnsubscribe = null;
    roomPeerStore = {
      getSnapshot: () => roomPeers,
      subscribe(input) {
        roomPeerSubscribers.add(input);
        startRoomPeerListener();
        return () => roomPeerSubscribers.delete(input);
      },
    };
  };
}
