/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installCollaborationPeerSelections(
  runtime: RuntimeBindings,
): () => void {
  var jsxCollaborationPeerSelections: Dynamic;
  var CollaborationPeerSelectionsConstant: Dynamic;
  var CollaborationPeerSelectionsLimit: Dynamic;
  function normalizePeerSelectionPaths(input?: Dynamic): Dynamic {
    if (!Array.isArray(input)) return [];
    let value: Dynamic = input.filter(
      (items?: Dynamic): Dynamic =>
        typeof items == "string" &&
        items.length <= CollaborationPeerSelectionsLimit,
    );
    return value
      .filter(
        (input2?: Dynamic, options?: Dynamic): Dynamic =>
          value.lastIndexOf(input2) === options,
      )
      .slice(-CollaborationPeerSelectionsConstant);
  }
  function getPeerSelectionGroups(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = [],
  ): Dynamic {
    let items: Dynamic = [];
    for (let value of input as Dynamic) {
      if (value.sameTab) continue;
      let context2: Dynamic = value.presence.context;
      if (
        typeof context2 != "object" ||
        context2 === null ||
        Array.isArray(context2)
      )
        continue;
      let value2: Dynamic = context2;
      if (
        Object.keys(options).some(
          (input2?: Dynamic): Dynamic => value2[input2] !== options[input2],
        )
      )
        continue;
      let value3: Dynamic = normalizePeerSelectionPaths(value2.selected),
        state: Dynamic = {},
        value4: Dynamic = value3.length > 0;
      for (let value6 of context as Dynamic) {
        let value7: Dynamic = normalizePeerSelectionPaths(value2[value6]);
        state[value6] = value7;
        value7.length > 0 && (value4 = true);
      }
      if (!value4) continue;
      let who: Dynamic = value.presence.who,
        value5: Dynamic = typeof who == "object" && who !== null ? who : {};
      items.push({
        peer: value.peer,
        collaborator: (0, runtime.peerCollaboratorIndex)(value5.c, value.peer),
        selected: value3,
        lists: state,
      });
    }
    return items;
  }
  function usePeerSelectionGroups(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = (0,
    runtime.reactCollaborationPeerCursors_2.useSyncExternalStore)(
      runtime.roomPeersStore.subscribe,
      runtime.roomPeersStore.getSnapshot,
      runtime.roomPeersStore.getSnapshot,
    );
    return getPeerSelectionGroups(value, input, options);
  }
  function PeerSelectionRings({
    rings: rings,
    scale: scale,
  }: Dynamic): Dynamic {
    let value: Dynamic = Number.isFinite(scale) && scale > 0 ? scale : 1;
    return (
      <div
        aria-hidden={"true"}
        data-peer-selections={""}
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
        }}
      >
        {rings.map(
          (input?: Dynamic): Dynamic =>
            (() => {
              const _Component = runtime.SelectionRing;
              const _props = {
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
              } as const;
              const _key = input.key;
              return <_Component key={_key} {..._props} />;
            })(),
        )}
      </div>
    );
  }
  bindRuntimeValue(
    runtime,
    "jsxCollaborationPeerSelections",
    () => jsxCollaborationPeerSelections,
    (value) => {
      jsxCollaborationPeerSelections = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CollaborationPeerSelectionsConstant",
    () => CollaborationPeerSelectionsConstant,
    (value) => {
      CollaborationPeerSelectionsConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CollaborationPeerSelectionsLimit",
    () => CollaborationPeerSelectionsLimit,
    (value) => {
      CollaborationPeerSelectionsLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizePeerSelectionPaths",
    () => normalizePeerSelectionPaths,
  );
  bindRuntimeValue(
    runtime,
    "getPeerSelectionGroups",
    () => getPeerSelectionGroups,
  );
  bindRuntimeValue(
    runtime,
    "usePeerSelectionGroups",
    () => usePeerSelectionGroups,
  );
  bindRuntimeValue(runtime, "PeerSelectionRings", () => PeerSelectionRings);
  return () => {
    jsxCollaborationPeerSelections = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    CollaborationPeerSelectionsConstant = 20;
    CollaborationPeerSelectionsLimit = 256;
  };
}
