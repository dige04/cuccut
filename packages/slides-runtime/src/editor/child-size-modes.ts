/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type {
  ContainerAlignment,
  FlowContainerNode,
  NodePlacement,
  SlideNode,
} from "../deck-contracts";
import type { SlideAxisName } from "../model/geometry";

/** Size dimension of a node: width or height. */
export type SizeDimension = "w" | "h";
/** How a dimension is laid out: along the container's flow, across it, or in a grid cell. */
export type PlacementAxisRole = "cell" | "main" | "cross";
/** Placement property that aligns a child on the cross axis of its container. */
export type SelfAlignmentKey = "justifySelf" | "alignSelf";
/** The alignment property for a dimension and the alignment the container gives children by default. */
export interface CrossAxisAlignment {
  key: SelfAlignmentKey;
  inherited: ContainerAlignment;
}
export type ChildSizeModeName = "hug" | "fixed" | "fill";
export interface ChildSizeModeOption {
  value: ChildSizeModeName;
  label: string;
}
/** How a child is sized along one dimension; `value` is the size when the mode is fixed. */
export interface ChildSizeMode {
  mode: ChildSizeModeName;
  value?: number;
}
/** Placement fields to set; an undefined value removes the field. */
export type NodePlacementPatch = {
  [Field in keyof NodePlacement]?: NodePlacement[Field] | undefined;
};

declare module "../bindings" {
  interface RuntimeBindings {
    placementAxisRole: (
      parent: FlowContainerNode,
      dimension: SizeDimension,
    ) => PlacementAxisRole;
    dimensionToAxis: (dimension: SizeDimension) => SlideAxisName;
    parentMainAxis: (parent: FlowContainerNode) => SlideAxisName | undefined;
    childCrossAxisAlignment: (
      node: SlideNode,
      parent: FlowContainerNode,
      dimension: SizeDimension,
    ) => CrossAxisAlignment;
    lockedPlacementDimension: (
      node: SlideNode,
      dimension: SizeDimension,
    ) => number | undefined;
    intrinsicNodeDimension: (
      node: SlideNode,
      dimension: SizeDimension,
    ) => number | undefined;
    fixedNodeDimension: (
      node: SlideNode,
      dimension: SizeDimension,
    ) => number | undefined;
    placementGrows: (place: NodePlacement | undefined) => boolean;
    childSizeModeOptions: (
      node: SlideNode,
      parent: FlowContainerNode,
      dimension: SizeDimension,
    ) => ChildSizeModeOption[];
    childSizeMode: (
      node: SlideNode,
      parent: FlowContainerNode,
      dimension: SizeDimension,
    ) => ChildSizeMode;
    childAxisFills: (
      node: SlideNode,
      parent: FlowContainerNode,
      axis: SlideAxisName,
    ) => boolean;
    patchNodePlacement: (
      node: SlideNode,
      patch: NodePlacementPatch,
    ) => SlideNode;
    updateChildSizeMode: (
      node: SlideNode,
      parent: FlowContainerNode,
      dimension: SizeDimension,
      mode: ChildSizeModeName,
      value?: number,
    ) => SlideNode;
    canResetChildSizeMode: (
      node: SlideNode,
      parent: FlowContainerNode,
      dimension: SizeDimension,
    ) => boolean;
    resetChildSizeMode: (
      node: SlideNode,
      parent: FlowContainerNode,
      dimension: SizeDimension,
    ) => SlideNode;
    dimensionLimitKeys: (
      dimension: SizeDimension,
    ) => ["minW", "maxW"] | ["minH", "maxH"];
  }
}

export function installEditorChildSizeModes(
  runtime: RuntimeBindings,
): () => void {
  function placementAxisRole(
    parent: FlowContainerNode,
    dimension: SizeDimension,
  ): PlacementAxisRole {
    if (parent.kind === "grid") {
      return "cell";
    }
    if ((parent.dir === "h") === (dimension === "w")) {
      return "main";
    } else {
      return "cross";
    }
  }
  function dimensionToAxis(dimension: SizeDimension): SlideAxisName {
    if (dimension === "w") {
      return "x";
    } else {
      return "y";
    }
  }
  function parentMainAxis(parent: FlowContainerNode): SlideAxisName | undefined {
    if (parent.kind === "stack") {
      if (parent.dir === "h") {
        return "x";
      } else {
        return "y";
      }
    } else {
      return undefined;
    }
  }
  function childCrossAxisAlignment(
    node: SlideNode,
    parent: FlowContainerNode,
    dimension: SizeDimension,
  ): CrossAxisAlignment {
    let value: SelfAlignmentKey =
        parent.kind === "grid" && dimension === "w"
          ? "justifySelf"
          : "alignSelf",
      value2: ContainerAlignment =
        parent.kind === "stack"
          ? parent.align
          : dimension === "h"
            ? (parent.alignItems ?? "stretch")
            : (parent.justifyItems ?? "stretch"),
      value3: ContainerAlignment =
        value2 === "stretch" &&
        !(0, runtime.nodeSupportsSelfAlignment)(node, value)
          ? "start"
          : value2;
    return {
      key: value,
      inherited: value3,
    };
  }
  function lockedPlacementDimension(
    node: SlideNode,
    dimension: SizeDimension,
  ): number | undefined {
    let place = node.place,
      value = dimension === "w" ? place?.minW : place?.minH,
      value2 = dimension === "w" ? place?.maxW : place?.maxH;
    if (value !== undefined && value === value2) {
      return value;
    } else {
      return undefined;
    }
  }
  function intrinsicNodeDimension(
    node: SlideNode,
    dimension: SizeDimension,
  ): number | undefined {
    if ((0, runtime.isMediaSizeNode)(node)) {
      if (dimension === "w") {
        return node.w;
      } else {
        return node.h;
      }
    } else {
      return undefined;
    }
  }
  function fixedNodeDimension(
    node: SlideNode,
    dimension: SizeDimension,
  ): number | undefined {
    return (
      lockedPlacementDimension(node, dimension) ??
      intrinsicNodeDimension(node, dimension)
    );
  }
  function placementGrows(place: NodePlacement | undefined): boolean {
    return (place?.grow ?? 0) > 0;
  }
  function childSizeModeOptions(
    node: SlideNode,
    parent: FlowContainerNode,
    dimension: SizeDimension,
  ): ChildSizeModeOption[] {
    if (!(0, runtime.nodeSupportsSizing)(node)) {
      return [];
    }
    let items: ChildSizeModeOption[] = [
      {
        value: "hug",
        label: "Hug",
      },
      {
        value: "fixed",
        label: "Fixed",
      },
      {
        value: "fill",
        label: "Fill",
      },
    ];
    if ((0, runtime.nodeSupportsIntrinsicSizing)(node)) {
      return items;
    }
    if (placementAxisRole(parent, dimension) === "main") {
      return items.filter(
        (input: ChildSizeModeOption): boolean => input.value !== "hug",
      );
    } else {
      return [items[1]!];
    }
  }
  function childSizeMode(
    node: SlideNode,
    parent: FlowContainerNode,
    dimension: SizeDimension,
  ): ChildSizeMode {
    let value = fixedNodeDimension(node, dimension);
    if (placementAxisRole(parent, dimension) === "main") {
      let value2 = lockedPlacementDimension(node, dimension);
      if (value2 !== undefined) {
        return {
          mode: "fixed",
          value: value2,
        };
      }
      if (placementGrows(node.place)) {
        return {
          mode: "fill",
        };
      }
      if (value !== undefined) {
        return {
          mode: "fixed",
          value: value,
        };
      }
    } else {
      if (value !== undefined) {
        return {
          mode: "fixed",
          value: value,
        };
      }
      let { key: value2, inherited: value3 } = childCrossAxisAlignment(
        node,
        parent,
        dimension,
      );
      if (
        (node.place?.[value2] ?? value3) === "stretch" &&
        (0, runtime.nodeSupportsIntrinsicSizing)(node)
      ) {
        return {
          mode: "fill",
        };
      }
    }
    return {
      mode: (0, runtime.nodeSupportsIntrinsicSizing)(node) ? "hug" : "fixed",
    };
  }
  function childAxisFills(
    node: SlideNode,
    parent: FlowContainerNode,
    axis: SlideAxisName,
  ): boolean {
    let value = (0, runtime.setNodeAxisSize)(
      node,
      axis,
      undefined,
      parentMainAxis(parent),
    );
    return (
      (0, runtime.nodeHasIntrinsicSize)(node, axis) ||
      childSizeMode(value, parent, axis === "x" ? "w" : "h").mode === "fill"
    );
  }
  function patchNodePlacement(
    node: SlideNode,
    patch: NodePlacementPatch,
  ): SlideNode {
    let state: NodePlacement = {
      ...node.place,
      ...patch,
    };
    for (let value of Object.keys(state) as (keyof NodePlacement)[])
      if (state[value] === undefined) {
        delete state[value];
      }
    let state2: SlideNode = {
      ...node,
    };
    if (Object.keys(state).length === 0) {
      delete state2.place;
    } else {
      state2.place = state;
    }
    return state2;
  }
  function updateChildSizeMode(
    node: SlideNode,
    parent: FlowContainerNode,
    dimension: SizeDimension,
    mode: ChildSizeModeName,
    value?: number,
  ): SlideNode {
    if (!(0, runtime.nodeSupportsSizing)(node)) {
      return node;
    }
    let value2 = parentMainAxis(parent);
    if (mode === "fixed") {
      if (value === undefined || !Number.isFinite(value)) {
        return node;
      }
      return (0, runtime.setNodeAxisIntrinsicSize)(
        node,
        dimensionToAxis(dimension),
        value,
        value2,
      );
    }
    let value3 = (0, runtime.setNodeAxisIntrinsicSize)(
        node,
        dimensionToAxis(dimension),
        undefined,
        value2,
      ),
      place = value3.place;
    if (placementAxisRole(parent, dimension) === "main") {
      if (mode === "fill") {
        if (placementGrows(place)) {
          return value3;
        } else {
          return patchNodePlacement(value3, {
            grow: 1,
          });
        }
      }
      return patchNodePlacement(value3, {
        grow: undefined,
        basis: undefined,
      });
    }
    let { key: key, inherited: inherited } = childCrossAxisAlignment(
        node,
        parent,
        dimension,
      ),
      value4 = place?.[key];
    if (mode === "fill") {
      if (inherited === "stretch") {
        return patchNodePlacement(value3, {
          [key]: undefined,
        });
      }
      if (value4 === "stretch") {
        return value3;
      } else {
        return patchNodePlacement(value3, {
          [key]: "stretch",
        });
      }
    }
    if (inherited === "stretch") {
      if (value4 !== undefined && value4 !== "stretch") {
        return value3;
      } else {
        return patchNodePlacement(value3, {
          [key]: "start",
        });
      }
    }
    if (value4 === "stretch") {
      return patchNodePlacement(value3, {
        [key]: undefined,
      });
    } else {
      return value3;
    }
  }
  function canResetChildSizeMode(
    node: SlideNode,
    parent: FlowContainerNode,
    dimension: SizeDimension,
  ): boolean {
    return resetChildSizeMode(node, parent, dimension) !== node;
  }
  function resetChildSizeMode(
    node: SlideNode,
    parent: FlowContainerNode,
    dimension: SizeDimension,
  ): SlideNode {
    let value = parentMainAxis(parent),
      value2: SlideNode =
        fixedNodeDimension(node, dimension) !== undefined
          ? (0, runtime.setNodeAxisIntrinsicSize)(
              node,
              dimensionToAxis(dimension),
              undefined,
              value,
            )
          : node,
      place = value2.place;
    if (placementAxisRole(parent, dimension) === "main") {
      if (place?.grow !== undefined || place?.basis !== undefined) {
        value2 = patchNodePlacement(value2, {
          grow: undefined,
          basis: undefined,
        });
      }
    } else {
      let { key: value3, inherited: value4 } = childCrossAxisAlignment(
          node,
          parent,
          dimension,
        ),
        value5 = place?.[value3];
      if (
        value5 === "stretch" ||
        (value5 === "start" && value4 === "stretch")
      ) {
        value2 = patchNodePlacement(value2, {
          [value3]: undefined,
        });
      }
    }
    return value2;
  }
  function dimensionLimitKeys(
    dimension: SizeDimension,
  ): ["minW", "maxW"] | ["minH", "maxH"] {
    if (dimension === "w") {
      return ["minW", "maxW"];
    } else {
      return ["minH", "maxH"];
    }
  }
  bindRuntimeValue(runtime, "placementAxisRole", () => placementAxisRole);
  bindRuntimeValue(runtime, "dimensionToAxis", () => dimensionToAxis);
  bindRuntimeValue(runtime, "parentMainAxis", () => parentMainAxis);
  bindRuntimeValue(
    runtime,
    "childCrossAxisAlignment",
    () => childCrossAxisAlignment,
  );
  bindRuntimeValue(
    runtime,
    "lockedPlacementDimension",
    () => lockedPlacementDimension,
  );
  bindRuntimeValue(
    runtime,
    "intrinsicNodeDimension",
    () => intrinsicNodeDimension,
  );
  bindRuntimeValue(runtime, "fixedNodeDimension", () => fixedNodeDimension);
  bindRuntimeValue(runtime, "placementGrows", () => placementGrows);
  bindRuntimeValue(runtime, "childSizeModeOptions", () => childSizeModeOptions);
  bindRuntimeValue(runtime, "childSizeMode", () => childSizeMode);
  bindRuntimeValue(runtime, "childAxisFills", () => childAxisFills);
  bindRuntimeValue(runtime, "patchNodePlacement", () => patchNodePlacement);
  bindRuntimeValue(runtime, "updateChildSizeMode", () => updateChildSizeMode);
  bindRuntimeValue(
    runtime,
    "canResetChildSizeMode",
    () => canResetChildSizeMode,
  );
  bindRuntimeValue(runtime, "resetChildSizeMode", () => resetChildSizeMode);
  bindRuntimeValue(runtime, "dimensionLimitKeys", () => dimensionLimitKeys);
  return () => {
    (0, runtime.initializeFontVariants)();
    (0, runtime.initializeSlideModel)();
    (0, runtime.initializeModelGeometry)();
    (0, runtime.initializeModelGeometry)();
  };
}
