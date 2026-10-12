/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { Frame, OverlayNode, Slide, SlideNode } from "../deck-contracts";
import type { NodeSelection } from "../layout/selection-groups";
import type { TableCellAddress } from "./selection";

/** Spoken role of a node, as announced to assistive technology. */
export type AccessibleNodeKind =
  | "heading"
  | "text"
  | "image"
  | "icon"
  | "shape"
  | "web embed"
  | "table"
  | "group"
  | "layered group"
  | "spacer";
/** What Enter does on a navigable node. */
export type NodeDefaultAction = "edit-text" | "edit-cell" | "enter" | "none";
/** Sibling units around a selection, in keyboard order, and the selection's position among them. */
export interface SelectionNavigationGroup {
  units: NodeSelection[];
  /** Index of the selection in `units`, -1 when it is not a member. */
  index: number;
}
/** Which end of a navigation group Home/End jump to. */
export type NavigationBoundary = "first" | "last";
/** One row of the flattened keyboard-navigation tree. */
export interface NavigationTreeEntry {
  unit: NodeSelection;
  key: string;
  /** Accessible name including the position among siblings. */
  name: string;
  opens: NodeDefaultAction;
  depth: number;
  parentKey: string | null;
  /** True when Tab stops on this entry. */
  stop: boolean;
}

declare module "../bindings" {
  interface RuntimeBindings {
    isNavigableNode: (node: SlideNode) => boolean;
    childNavigationSelections: (
      slide: Slide,
      selection: NodeSelection,
    ) => NodeSelection[];
    slideNavigationSelections: (slide: Slide) => NodeSelection[];
    navigationParentSelection: (
      slide: Slide,
      selection: NodeSelection,
    ) => NodeSelection | null;
    selectionNavigationGroup: (
      slide: Slide,
      selection: NodeSelection,
    ) => SelectionNavigationGroup;
    nextNavigationSelection: (
      slide: Slide,
      selection: NodeSelection,
      direction: number,
    ) => NodeSelection | undefined;
    boundaryNavigationSelection: (
      slide: Slide,
      selection: NodeSelection,
      edge: NavigationBoundary,
    ) => NodeSelection | undefined;
    ellipsizeAccessibleLabel: (text: string, maxLength: number) => string;
    quotedAccessibleLabel: (text: string) => string;
    pluralCountLabel: (count: number, label: string) => string;
    accessibleNodeKind: (node: SlideNode) => AccessibleNodeKind;
    accessibleNodeDetail: (node: SlideNode) => string;
    capitalizeLabel: (text: string) => string;
    accessibleNodePositionLabel: (
      node: SlideNode,
      index: number,
      total: number,
    ) => string;
    accessibleSelectionLabel: (slide: Slide, selection: NodeSelection) => string;
    accessibleNodeTypeLabel: (node: SlideNode) => string;
    accessibleTableCellLabel: (cell: TableCellAddress) => string;
    nodeDefaultAction: (node: SlideNode) => NodeDefaultAction;
    slideNavigationTree: (slide: Slide) => NavigationTreeEntry[];
    visibleNavigationTree: (
      tree: readonly NavigationTreeEntry[],
      slide: Slide,
      current?: NodeSelection,
    ) => NavigationTreeEntry[];
    maxAccessibleLabelLength: number;
    initializeObjectNavigation: () => void;
  }
}

export function installModelNavigation(runtime: RuntimeBindings): () => void {
  var maxAccessibleLabelLength: RuntimeBindings["maxAccessibleLabelLength"];
  var initializeObjectNavigation: RuntimeBindings["initializeObjectNavigation"];
  function isNavigableNode(node: SlideNode): boolean {
    return node.kind !== "spacer";
  }
  function childNavigationSelections(
    slide: Slide,
    selection: NodeSelection,
  ): NodeSelection[] {
    let node: SlideNode | undefined = (0, runtime.selectedNode)(
      slide,
      selection,
    );
    if (node === undefined) {
      return [];
    }
    let children: SlideNode[] | undefined = (0, runtime.nodeChildren)(node);
    if (children === undefined) {
      return [];
    }
    let path: number[] = (0, runtime.selectionNodePath)(selection),
      selections: NodeSelection[] = [];
    children.forEach((input: SlideNode, options: number): void => {
      if (
        isNavigableNode(input) &&
        !(options === 0 && (0, runtime.isEmptyGroupBase)(node))
      ) {
        selections.push(
          (0, runtime.createNodeSelection)(selection.frameId, [
            ...path,
            options,
          ]),
        );
      }
    });
    return selections;
  }
  function slideNavigationSelections(slide: Slide): NodeSelection[] {
    let primaryFrameId: string | undefined = (0, runtime.slidePrimaryLayoutFrame)(
        slide,
      )?.id,
      selections: NodeSelection[] = [];
    for (let value of slide.frames) {
      if ((0, runtime.isEmptyBackgroundFrame)(value)) {
        continue;
      }
      if (value.id === primaryFrameId) {
        selections.push(
          ...childNavigationSelections(slide, {
            frameId: value.id,
          }),
        );
      } else if (isNavigableNode(value.node)) {
        selections.push({
          frameId: value.id,
        });
      }
    }
    return selections;
  }
  function navigationParentSelection(
    slide: Slide,
    selection: NodeSelection,
  ): NodeSelection | null {
    let parent: NodeSelection | undefined = (0, runtime.parentNodeSelection)(
      selection,
    );
    if (parent === undefined) {
      return null;
    }
    if (
      (0, runtime.selectionNodePath)(parent).length === 0 &&
      (0, runtime.slidePrimaryLayoutFrame)(slide)?.id === parent.frameId
    ) {
      return null;
    }
    return parent;
  }
  function selectionNavigationGroup(
    slide: Slide,
    selection: NodeSelection,
  ): SelectionNavigationGroup {
    let parent: NodeSelection | null = navigationParentSelection(
        slide,
        selection,
      ),
      units: NodeSelection[] =
        parent === null
          ? slideNavigationSelections(slide)
          : childNavigationSelections(slide, parent);
    return {
      units: units,
      index: units.findIndex(
        (input: NodeSelection): boolean =>
          (0, runtime.selectionsEqual)(input, selection),
      ),
    };
  }
  function nextNavigationSelection(
    slide: Slide,
    selection: NodeSelection,
    direction: number,
  ): NodeSelection | undefined {
    let { units: units, index: index }: SelectionNavigationGroup =
      selectionNavigationGroup(slide, selection);
    if (units.length === 0) {
      return;
    }
    if (index < 0) {
      if (direction > 0) {
        return units[0];
      } else {
        return units[units.length - 1];
      }
    }
    return units[(index + direction + units.length) % units.length];
  }
  function boundaryNavigationSelection(
    slide: Slide,
    selection: NodeSelection,
    edge: NavigationBoundary,
  ): NodeSelection | undefined {
    let { units: units }: SelectionNavigationGroup = selectionNavigationGroup(
      slide,
      selection,
    );
    if (edge === "first") {
      return units[0];
    } else {
      return units[units.length - 1];
    }
  }
  function ellipsizeAccessibleLabel(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    } else {
      return (0, runtime.truncateUtf16Safely)(text, maxLength - 1) + "…";
    }
  }
  function quotedAccessibleLabel(text: string): string {
    return "“" + ellipsizeAccessibleLabel(text, maxAccessibleLabelLength) + "”";
  }
  function pluralCountLabel(count: number, label: string): string {
    return String(count) + " " + label + (count === 1 ? "" : "s");
  }
  function accessibleNodeKind(node: SlideNode): AccessibleNodeKind {
    switch (node.kind) {
      case "text":
        if (
          node.role === "display" ||
          node.role === "h1" ||
          node.role === "h2" ||
          node.role === "h3"
        ) {
          return "heading";
        } else {
          return "text";
        }
      case "img":
        return "image";
      case "icon":
        return "icon";
      case "shape":
        return "shape";
      case "html":
        return "web embed";
      case "table":
        return "table";
      case "stack":
      case "grid":
        return "group";
      case "overlay":
        if ((0, runtime.isEmptyGroupBase)(node)) {
          return "group";
        } else {
          return "layered group";
        }
      case "spacer":
        return "spacer";
    }
  }
  function accessibleNodeDetail(node: SlideNode): string {
    switch (node.kind) {
      case "text": {
        let value: string = node.text.trim().replace(/\s+/g, " ");
        if (value === "") {
          return "Empty";
        } else {
          return quotedAccessibleLabel(value);
        }
      }
      case "img": {
        let value: string = node.alt.trim().replace(/\s+/g, " ");
        if (value === "") {
          return "No description";
        } else {
          return quotedAccessibleLabel(value);
        }
      }
      case "icon":
        return node.icon.replace(/-/g, " ") || "Unnamed";
      case "shape":
        return runtime.shapeVariantLabels[node.shape];
      case "html":
        return "Interactive content";
      case "table":
        return (
          pluralCountLabel(node.rows.length, "row") +
          ", " +
          pluralCountLabel(node.cols, "column")
        );
      case "stack":
      case "grid":
      case "overlay": {
        let length: number = ((0, runtime.nodeChildren)(node) ?? []).filter(
            isNavigableNode,
          ).length,
          value: string =
            node.kind === "grid"
              ? "Grid of " + String(length)
              : (0, runtime.isEmptyGroupBase)(node)
                ? pluralCountLabel((node as OverlayNode).layers.length, "object")
                : node.kind === "overlay"
                  ? "Stack of " + pluralCountLabel(length, "layer")
                  : (node.dir === "h" ? "Row of " : "Column of ") +
                    String(length),
          value2: string | undefined = (0, runtime.nodeTextLabel)(node);
        return (
          value +
          (value2 === undefined ? "" : ", " + quotedAccessibleLabel(value2))
        );
      }
      case "spacer":
        return "";
    }
  }
  function capitalizeLabel(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }
  function accessibleNodePositionLabel(
    node: SlideNode,
    index: number,
    total: number,
  ): string {
    let detail: string = accessibleNodeDetail(node),
      label: string =
        capitalizeLabel(accessibleNodeKind(node)) +
        (detail === "" ? "" : ", " + detail);
    if (index < 0) {
      return label;
    } else {
      return label + ", " + String(index + 1) + " of " + String(total);
    }
  }
  function accessibleSelectionLabel(
    slide: Slide,
    selection: NodeSelection,
  ): string {
    let node: SlideNode | undefined = (0, runtime.selectedNode)(
      slide,
      selection,
    );
    if (node === undefined) {
      return "Object";
    }
    let { units: units, index: index }: SelectionNavigationGroup =
      selectionNavigationGroup(slide, selection);
    return accessibleNodePositionLabel(node, index, units.length);
  }
  function accessibleNodeTypeLabel(node: SlideNode): string {
    return capitalizeLabel(accessibleNodeKind(node));
  }
  function accessibleTableCellLabel(cell: TableCellAddress): string {
    return "Row " + String(cell.r + 1) + ", column " + String(cell.c + 1);
  }
  function nodeDefaultAction(node: SlideNode): NodeDefaultAction {
    if (node.kind === "text") {
      return "edit-text";
    }
    if (node.kind === "table") {
      if (node.rows.length > 0 && node.cols > 0) {
        return "edit-cell";
      } else {
        return "none";
      }
    }
    let value: SlideNode[] | undefined = (0, runtime.nodeChildren)(node);
    if (value !== undefined && value.some(isNavigableNode)) {
      return "enter";
    } else {
      return "none";
    }
  }
  function slideNavigationTree(slide: Slide): NavigationTreeEntry[] {
    let tree: NavigationTreeEntry[] = [],
      visit = (
        items: NodeSelection[],
        options: number,
        context: string | null,
      ): void => {
        items.forEach((input: NodeSelection, options2: number): void => {
          let value: SlideNode | undefined = (0, runtime.selectedNode)(
            slide,
            input,
          );
          if (value === undefined) {
            return;
          }
          let value2: string = (0, runtime.selectionKey)(input);
          tree.push({
            unit: input,
            key: value2,
            name: accessibleNodePositionLabel(value, options2, items.length),
            opens: nodeDefaultAction(value),
            depth: options,
            parentKey: context,
            stop: true,
          });
          visit(childNavigationSelections(slide, input), options + 1, value2);
        });
      };
    visit(slideNavigationSelections(slide), 1, null);
    return tree;
  }
  function visibleNavigationTree(
    tree: readonly NavigationTreeEntry[],
    slide: Slide,
    current?: NodeSelection,
  ): NavigationTreeEntry[] {
    if (current === undefined) {
      return tree.filter(
        (input: NavigationTreeEntry): boolean => input.parentKey === null,
      );
    }
    let items: string[] = [];
    for (
      let value5: NodeSelection | null = navigationParentSelection(
        slide,
        current,
      );
      value5 !== null;
      value5 = navigationParentSelection(slide, value5)
    )
      items.push((0, runtime.selectionKey)(value5));
    let value: SlideNode | undefined = (0, runtime.selectedNode)(
        slide,
        current,
      ),
      value2: NodeDefaultAction =
        value === undefined ? "none" : nodeDefaultAction(value),
      value3: string = (0, runtime.selectionKey)(current),
      values: Set<string | null> = new Set<string | null>([
        null,
        ...items,
        ...(value2 === "enter" ? [value3] : []),
      ]),
      value4: NavigationTreeEntry[] = tree.filter(
        (input: NavigationTreeEntry): boolean => values.has(input.parentKey),
      );
    if (
      value !== undefined &&
      !value4.some((input: NavigationTreeEntry): boolean => input.key === value3)
    ) {
      value4.push({
        unit: current,
        key: value3,
        name: accessibleSelectionLabel(slide, current),
        opens: value2,
        depth: items.length + 1,
        parentKey: items[0] ?? null,
        stop: false,
      });
    }
    return value4;
  }
  bindRuntimeValue(runtime, "isNavigableNode", () => isNavigableNode);
  bindRuntimeValue(
    runtime,
    "childNavigationSelections",
    () => childNavigationSelections,
  );
  bindRuntimeValue(
    runtime,
    "slideNavigationSelections",
    () => slideNavigationSelections,
  );
  bindRuntimeValue(
    runtime,
    "navigationParentSelection",
    () => navigationParentSelection,
  );
  bindRuntimeValue(
    runtime,
    "selectionNavigationGroup",
    () => selectionNavigationGroup,
  );
  bindRuntimeValue(
    runtime,
    "nextNavigationSelection",
    () => nextNavigationSelection,
  );
  bindRuntimeValue(
    runtime,
    "boundaryNavigationSelection",
    () => boundaryNavigationSelection,
  );
  bindRuntimeValue(
    runtime,
    "ellipsizeAccessibleLabel",
    () => ellipsizeAccessibleLabel,
  );
  bindRuntimeValue(
    runtime,
    "quotedAccessibleLabel",
    () => quotedAccessibleLabel,
  );
  bindRuntimeValue(runtime, "pluralCountLabel", () => pluralCountLabel);
  bindRuntimeValue(runtime, "accessibleNodeKind", () => accessibleNodeKind);
  bindRuntimeValue(runtime, "accessibleNodeDetail", () => accessibleNodeDetail);
  bindRuntimeValue(runtime, "capitalizeLabel", () => capitalizeLabel);
  bindRuntimeValue(
    runtime,
    "accessibleNodePositionLabel",
    () => accessibleNodePositionLabel,
  );
  bindRuntimeValue(
    runtime,
    "accessibleSelectionLabel",
    () => accessibleSelectionLabel,
  );
  bindRuntimeValue(
    runtime,
    "accessibleNodeTypeLabel",
    () => accessibleNodeTypeLabel,
  );
  bindRuntimeValue(
    runtime,
    "accessibleTableCellLabel",
    () => accessibleTableCellLabel,
  );
  bindRuntimeValue(runtime, "nodeDefaultAction", () => nodeDefaultAction);
  bindRuntimeValue(runtime, "slideNavigationTree", () => slideNavigationTree);
  bindRuntimeValue(
    runtime,
    "visibleNavigationTree",
    () => visibleNavigationTree,
  );
  bindRuntimeValue(
    runtime,
    "maxAccessibleLabelLength",
    () => maxAccessibleLabelLength,
    (value) => {
      maxAccessibleLabelLength = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeObjectNavigation",
    () => initializeObjectNavigation,
    (value) => {
      initializeObjectNavigation = value;
    },
  );
  return () => {
    maxAccessibleLabelLength = 60;
    initializeObjectNavigation = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeSlideModel)();
      (0, runtime.initializeModelEditing)();
      (0, runtime.initializeModelSelection)();
    });
  };
}
