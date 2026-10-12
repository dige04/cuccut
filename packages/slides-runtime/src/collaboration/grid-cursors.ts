/** Restored application module; prepare first, initialize in original order. */
import type { ReactElement } from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
  type ReactNamespace,
} from "../bindings";
import type { RoomPeer } from "../host/room-presence";

/** One slide tile of the grid, positioned in grid pixels. */
export interface GridPeerCursorTile {
  id: string;
  x: number;
  y: number;
}
export interface GridPeerCursorLayersProps {
  tiles: readonly GridPeerCursorTile[];
  /** Cursor surface key a tile publishes under. */
  surfaceOf: (tileId: string) => string;
  glyphScale?: number;
}

declare module "../bindings" {
  interface RuntimeBindings {
    ReactGridPeerCursors: ReactNamespace;
    GridPeerCursorsJsx: JsxNamespace;
    collectPeerCursorSurfaceKeys: (peers: readonly RoomPeer[]) => string;
    peerCursorSurfaceSnapshot: () => string;
    GridPeerCursorLayers: (
      props: GridPeerCursorLayersProps,
    ) => ReactElement | null;
  }
}

export function installCollaborationGridCursors(
  runtime: RuntimeBindings,
): () => void {
  var ReactGridPeerCursors: ReactNamespace;
  var GridPeerCursorsJsx: JsxNamespace;
  var peerCursorSurfaceSnapshot: () => string;
  function collectPeerCursorSurfaceKeys(peers: readonly RoomPeer[]): string {
    let surfaces = new Set<string>();
    for (let value of peers) {
      if (value.sameTab) {
        continue;
      }
      let cursor = value.presence.cursor,
        value2 =
          typeof cursor === "object" && cursor !== null ? cursor.s : undefined;
      if (
        typeof value2 === "string" &&
        value2.length <= 128 &&
        !value2.includes(`
`)
      ) {
        surfaces.add(value2);
      }
    }
    return [...surfaces].sort().join(`
`);
  }
  function GridPeerCursorLayers({
    tiles: tiles,
    surfaceOf: surfaceOf,
    glyphScale: glyphScale,
  }: GridPeerCursorLayersProps): ReactElement | null {
    let value = ReactGridPeerCursors.useSyncExternalStore(
      runtime.roomPeerStore.subscribe,
      peerCursorSurfaceSnapshot,
      peerCursorSurfaceSnapshot,
    );
    if (value === "") {
      return null;
    }
    let values = new Set(
      value.split(`
`),
    );
    return GridPeerCursorsJsx.jsx(GridPeerCursorsJsx.Fragment, {
      children: tiles.map((input) => {
        let value2 = surfaceOf(input.id);
        if (!values.has(value2)) {
          return null;
        }
        return GridPeerCursorsJsx.jsx(
          "div",
          {
            "data-grid-peers": input.id,
            className: "pointer-events-none absolute",
            style: {
              left: input.x,
              top: input.y,
              width: runtime.GRID_SLIDE_WIDTH,
              height: runtime.GRID_SLIDE_HEIGHT,
            },
            children: GridPeerCursorsJsx.jsx(runtime.PeerCursors, {
              surface: value2,
              toLocal: (input2: number, options: number) => ({
                left: input2 * runtime.GRID_SLIDE_WIDTH,
                top: options * runtime.GRID_SLIDE_HEIGHT,
              }),
              glyphScale: glyphScale,
            }),
          },
          input.id,
        );
      }),
    });
  }
  bindRuntimeValue(
    runtime,
    "ReactGridPeerCursors",
    () => ReactGridPeerCursors,
    (value) => {
      ReactGridPeerCursors = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GridPeerCursorsJsx",
    () => GridPeerCursorsJsx,
    (value) => {
      GridPeerCursorsJsx = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "collectPeerCursorSurfaceKeys",
    () => collectPeerCursorSurfaceKeys,
  );
  bindRuntimeValue(
    runtime,
    "peerCursorSurfaceSnapshot",
    () => peerCursorSurfaceSnapshot,
    (value) => {
      peerCursorSurfaceSnapshot = value;
    },
  );
  bindRuntimeValue(runtime, "GridPeerCursorLayers", () => GridPeerCursorLayers);
  return () => {
    ReactGridPeerCursors = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    GridPeerCursorsJsx = (0, runtime.toModuleNamespace)(
      (0, runtime.loadJsxNamespace)(),
      1,
    );
    peerCursorSurfaceSnapshot = () =>
      collectPeerCursorSurfaceKeys(runtime.roomPeerStore.getSnapshot());
  };
}
