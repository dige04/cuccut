/** Restored application module; prepare first, initialize in original order. */
import type { ReactElement } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type { PeerWhoPresence, RoomPeer } from "../host/room-presence";

/** Fields of a peer's published context that must equal ours for its selection to show (deck, slide ...). */
export interface PeerSelectionContext {
  [field: string]: unknown;
}
/** What one peer has selected in our context. */
export interface PeerSelection {
  peer: string;
  /** Color slot of the peer. */
  collaborator: number;
  selected: string[];
  /** Extra selected-key lists named by the caller's `exclude` argument. */
  lists: Record<string, string[]>;
}
/** A peer's selection box in slide coordinates. */
export interface PeerSelectionRing {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  collaborator: number;
}
export interface PeerSelectionRingsProps {
  rings: readonly PeerSelectionRing[];
  scale: number;
}

declare module "../bindings" {
  interface RuntimeBindings {
    ReactPeerSelectionMeasurement: ReactNamespace;
    ReactPeerSelections: ReactNamespace;
    PeerSelectionJsx: JsxNamespace;
    MAX_PEER_SELECTED_UNITS: number;
    MAX_PEER_SELECTION_KEY_CHARS: number;
    normalizePeerSelectedKeys: (selection: unknown) => string[];
    collectPeerSelections: (
      peers: readonly RoomPeer[],
      context: PeerSelectionContext,
      exclude?: readonly string[],
    ) => PeerSelection[];
    usePeerSelections: (
      context: PeerSelectionContext,
      exclude?: readonly string[],
    ) => PeerSelection[];
    PeerSelectionRings: (props: PeerSelectionRingsProps) => ReactElement;
  }
}

export function installCollaborationSelectionRings(
  runtime: RuntimeBindings,
): () => void {
  var ReactPeerSelectionMeasurement: ReactNamespace;
  var ReactPeerSelections: ReactNamespace;
  var PeerSelectionJsx: JsxNamespace;
  var MAX_PEER_SELECTED_UNITS: number;
  var MAX_PEER_SELECTION_KEY_CHARS: number;
  function normalizePeerSelectedKeys(selection: unknown): string[] {
    if (!Array.isArray(selection)) {
      return [];
    }
    let keys = selection.filter(
      (items: unknown): items is string =>
        typeof items === "string" &&
        items.length <= MAX_PEER_SELECTION_KEY_CHARS,
    );
    return keys
      .filter(
        (input, options) => keys.lastIndexOf(input) === options,
      )
      .slice(-MAX_PEER_SELECTED_UNITS);
  }
  function collectPeerSelections(
    peers: readonly RoomPeer[],
    context: PeerSelectionContext,
    exclude: readonly string[] = [],
  ): PeerSelection[] {
    let items: PeerSelection[] = [];
    for (let value of peers) {
      if (value.sameTab) {
        continue;
      }
      let context2 = value.presence.context;
      if (
        typeof context2 !== "object" ||
        context2 === null ||
        Array.isArray(context2)
      ) {
        continue;
      }
      let value2 = context2;
      if (
        Object.keys(context).some(
          (input) => value2[input] !== context[input],
        )
      ) {
        continue;
      }
      let value3 = normalizePeerSelectedKeys(value2.selected),
        state: Record<string, string[]> = {},
        value4 = value3.length > 0;
      for (let value6 of exclude) {
        let value7 = normalizePeerSelectedKeys(value2[value6]);
        state[value6] = value7;
        if (value7.length > 0) {
          value4 = true;
        }
      }
      if (!value4) {
        continue;
      }
      let who = value.presence.who,
        value5: PeerWhoPresence =
          typeof who === "object" && who !== null ? who : {};
      items.push({
        peer: value.peer,
        collaborator: (0, runtime.peerColorIndex)(value5.c, value.peer),
        selected: value3,
        lists: state,
      });
    }
    return items;
  }
  function usePeerSelections(
    context: PeerSelectionContext,
    exclude?: readonly string[],
  ): PeerSelection[] {
    let value = ReactPeerSelections.useSyncExternalStore(
      runtime.roomPeerStore.subscribe,
      runtime.roomPeerStore.getSnapshot,
      runtime.roomPeerStore.getSnapshot,
    );
    return collectPeerSelections(value, context, exclude);
  }
  function PeerSelectionRings({
    rings: rings,
    scale: scale,
  }: PeerSelectionRingsProps): ReactElement {
    let value = Number.isFinite(scale) && scale > 0 ? scale : 1;
    return PeerSelectionJsx.jsx("div", {
      "aria-hidden": "true",
      "data-peer-selections": "",
      style: {
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      },
      children: rings.map(
        (input) =>
          PeerSelectionJsx.jsx(
            runtime.SelectionRing,
            {
              "data-peer-ring": "",
              frame: {
                x: input.x,
                y: input.y,
                w: input.w,
                h: input.h,
              },
              scale: value,
              rotation: input.rotation,
              collaborator: input.collaborator,
            },
            input.key,
          ),
      ),
    });
  }
  bindRuntimeValue(
    runtime,
    "ReactPeerSelectionMeasurement",
    () => ReactPeerSelectionMeasurement,
    (value) => {
      ReactPeerSelectionMeasurement = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ReactPeerSelections",
    () => ReactPeerSelections,
    (value) => {
      ReactPeerSelections = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PeerSelectionJsx",
    () => PeerSelectionJsx,
    (value) => {
      PeerSelectionJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_PEER_SELECTED_UNITS",
    () => MAX_PEER_SELECTED_UNITS,
    (value) => {
      MAX_PEER_SELECTED_UNITS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_PEER_SELECTION_KEY_CHARS",
    () => MAX_PEER_SELECTION_KEY_CHARS,
    (value) => {
      MAX_PEER_SELECTION_KEY_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizePeerSelectedKeys",
    () => normalizePeerSelectedKeys,
  );
  bindRuntimeValue(
    runtime,
    "collectPeerSelections",
    () => collectPeerSelections,
  );
  bindRuntimeValue(runtime, "usePeerSelections", () => usePeerSelections);
  bindRuntimeValue(runtime, "PeerSelectionRings", () => PeerSelectionRings);
  return () => {
    ReactPeerSelectionMeasurement = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    (0, runtime.initializeUiInputs210)();
    ReactPeerSelections = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    PeerSelectionJsx = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    MAX_PEER_SELECTED_UNITS = 20;
    MAX_PEER_SELECTION_KEY_CHARS = 256;
  };
}
