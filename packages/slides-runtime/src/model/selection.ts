/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type {
  Frame,
  OverlayNode,
  Slide,
  SlideNode,
  SlideNodeKind,
  StyleBag,
} from "../deck-contracts";
import type { NodePath, NodeSelection } from "../layout/selection-groups";

/** Row and column of a table cell. */
export interface TableCellAddress {
  r: number;
  c: number;
}
/** The open text edit, as far as object context ids are concerned (`cell` is set while editing a table cell). */
export interface ObjectContextEditing {
  frameId: string;
  path: NodePath;
  cell?: TableCellAddress | null;
}
/** One selected object (or table cell) offered as context, identified by its context id. */
export interface ObjectContextItem {
  id: string;
  kind: SlideNodeKind | "cell";
  label: string;
}
/** An object context id split into its frame id and node path. */
export interface ObjectContextSelection {
  frameId: string;
  path: NodePath;
}
/** What a pointer press resolves to: the unit to drag, to select on release, and to add on a modifier click. */
export interface PointerSelection {
  grab: NodeSelection | null;
  tap: NodeSelection | null;
  add: NodeSelection | null;
}
/** Hit-test behaviour of the frame under the pointer. */
export interface PointerSelectionOptions {
  /** The frame is the slide's primary layout frame, so its root node itself is not selectable. */
  flow: boolean;
  /** Groups are selected before their members. */
  groupFirst: boolean;
  /** A tap on already-selected text selects the text node instead of the group. */
  textTap: boolean;
}

declare module "../bindings" {
  interface RuntimeBindings {
    selectionNodePath: (selection: NodeSelection) => NodePath;
    createNodeSelection: (
      frameId: string,
      path: readonly number[],
    ) => NodeSelection;
    parentNodeSelection: (selection: NodeSelection) => NodeSelection | undefined;
    nodePathsEqual: (
      path: readonly number[],
      otherPath: readonly number[],
    ) => boolean;
    compareNodePaths: (
      path: readonly number[],
      otherPath: readonly number[],
    ) => number;
    sortSelectionsInDocumentOrder: (
      slide: Slide,
      selections: readonly NodeSelection[],
    ) => NodeSelection[];
    selectionsEqual: (
      selection: NodeSelection,
      otherSelection: NodeSelection,
    ) => boolean;
    selectionKey: (selection: NodeSelection) => string;
    selectionsKey: (selections: readonly NodeSelection[]) => string;
    selectedObjectContextIds: (
      selections: readonly NodeSelection[],
      editing?: ObjectContextEditing | null,
    ) => string[];
    selectedObjectContext: (
      slide: Slide,
      selections: readonly NodeSelection[],
      editing?: ObjectContextEditing | null,
    ) => ObjectContextItem[];
    parseObjectContextId: (contextId: string) => ObjectContextSelection | null;
    frameContextId: (contextId: string | null | undefined) => string | null;
    normalizeObjectContextIds: (contextIds: readonly string[]) => string[];
    selectedNode: (
      slide: Slide,
      selection: NodeSelection,
    ) => SlideNode | undefined;
    filterValidSelections: (
      slide: Slide,
      selections: readonly NodeSelection[],
    ) => NodeSelection[];
    toggleNodeSelection: (
      selections: readonly NodeSelection[],
      selection: NodeSelection,
    ) => NodeSelection[];
    selectionContainsNode: (
      selections: readonly NodeSelection[],
      selection: NodeSelection,
    ) => boolean;
    updateSelectedNode: (
      slide: Slide,
      selection: NodeSelection,
      update: (node: SlideNode) => SlideNode,
    ) => Slide;
    cssColorOpacity: (color: string) => number;
    styleHasVisiblePaint: (style?: StyleBag) => boolean;
    resolvePaintedSelection: (
      frameId: string,
      node: SlideNode,
      path: readonly number[],
    ) => NodeSelection | null;
    isEmptyGroupBase: (node: SlideNode) => boolean;
    resolvePointerSelection: (
      frameId: string,
      node: SlideNode,
      path: readonly number[],
      selected: readonly NodeSelection[],
      options: PointerSelectionOptions,
    ) => PointerSelection;
    togglePointerSelection: (
      selections: readonly NodeSelection[],
      pointerSelection: PointerSelection,
    ) => NodeSelection[] | null;
    pointerSelectsGroup: (
      frameId: string,
      node: SlideNode,
      path: readonly number[],
      selected: readonly NodeSelection[],
      options: PointerSelectionOptions,
    ) => NodeSelection | null;
    /** `slide` is the frame id and `rect` the frame's root node (the parameter names are leftovers of the restored bundle). */
    collectMarqueeSelection: (
      slide: string,
      rect: SlideNode,
    ) => NodeSelection[];
    commonSelectedNodeKind: (
      slide: Slide,
      selections: readonly NodeSelection[],
    ) => SlideNodeKind | undefined;
    objectContextIdPattern: RegExp;
    overlayHasVisiblePaint: (node: OverlayNode) => boolean;
    initializeModelSelection: () => void;
  }
}

export function installModelSelection(runtime: RuntimeBindings): () => void {
  var objectContextIdPattern: RuntimeBindings["objectContextIdPattern"];
  var overlayHasVisiblePaint: RuntimeBindings["overlayHasVisiblePaint"];
  var initializeModelSelection: RuntimeBindings["initializeModelSelection"];
  function selectionNodePath(selection: NodeSelection): NodePath {
    if (selection.path !== undefined) {
      return selection.path;
    }
    if (selection.child === undefined) {
      return [];
    } else {
      return [selection.child];
    }
  }
  function createNodeSelection(
    frameId: string,
    path: readonly number[],
  ): NodeSelection {
    if (path.length === 0) {
      return {
        frameId: frameId,
      };
    }
    if (path.length === 1) {
      return {
        frameId: frameId,
        child: path[0],
      };
    }
    return {
      frameId: frameId,
      child: path[0],
      path: [...path],
    };
  }
  function parentNodeSelection(
    selection: NodeSelection,
  ): NodeSelection | undefined {
    let value: NodePath = selectionNodePath(selection);
    if (value.length === 0) {
      return undefined;
    } else {
      return createNodeSelection(selection.frameId, value.slice(0, -1));
    }
  }
  function nodePathsEqual(
    path: readonly number[],
    otherPath: readonly number[],
  ): boolean {
    return (
      path.length === otherPath.length &&
      path.every(
        (input: number, options: number): boolean =>
          input === otherPath[options],
      )
    );
  }
  function compareNodePaths(
    path: readonly number[],
    otherPath: readonly number[],
  ): number {
    let value: number = Math.min(path.length, otherPath.length);
    for (let index: number = 0; index < value; index++)
      if (path[index] !== otherPath[index]) {
        return path[index]! - otherPath[index]!;
      }
    return path.length - otherPath.length;
  }
  function sortSelectionsInDocumentOrder(
    slide: Slide,
    selections: readonly NodeSelection[],
  ): NodeSelection[] {
    let frameIndex = (input: NodeSelection): number =>
      slide.frames.findIndex(
        (input2: Frame): boolean => input2.id === input.frameId,
      );
    return [...selections].sort(
      (input: NodeSelection, options: NodeSelection): number =>
        frameIndex(input) - frameIndex(options) ||
        compareNodePaths(selectionNodePath(input), selectionNodePath(options)),
    );
  }
  function selectionsEqual(
    selection: NodeSelection,
    otherSelection: NodeSelection,
  ): boolean {
    return (
      selection.frameId === otherSelection.frameId &&
      nodePathsEqual(
        selectionNodePath(selection),
        selectionNodePath(otherSelection),
      )
    );
  }
  function selectionKey(selection: NodeSelection): string {
    let value: NodePath = selectionNodePath(selection);
    if (value.length === 0) {
      return selection.frameId;
    } else {
      return selection.frameId + ":" + value.join(".");
    }
  }
  function selectionsKey(selections: readonly NodeSelection[]): string {
    return selections.map(selectionKey).join("|");
  }
  function selectedObjectContextIds(
    selections: readonly NodeSelection[],
    editing?: ObjectContextEditing | null,
  ): string[] {
    let value: string[] = selections.map(
      (input: NodeSelection): string =>
        [input.frameId, ...selectionNodePath(input)].join("/"),
    );
    if (editing) {
      let value2: number[] = editing.cell
        ? [editing.cell.r, editing.cell.c]
        : [];
      value.push([editing.frameId, ...editing.path, ...value2].join("/"));
    }
    return normalizeObjectContextIds(value);
  }
  function selectedObjectContext(
    slide: Slide,
    selections: readonly NodeSelection[],
    editing?: ObjectContextEditing | null,
  ): ObjectContextItem[] {
    let items: ObjectContextItem[] = [];
    for (let value of selections) {
      let value2: SlideNode | undefined = selectedNode(slide, value);
      if (value2) {
        items.push({
          id: [value.frameId, ...selectionNodePath(value)].join("/"),
          kind: value2.kind,
          label: (0, runtime.nodeDisplayLabel)(value2, 1 / 0),
        });
      }
    }
    if (editing) {
      let value: SlideNode | undefined = selectedNode(
          slide,
          createNodeSelection(editing.frameId, editing.path),
        ),
        { cell: value2 } = editing,
        value3: string | undefined =
          value2 && value?.kind === "table"
            ? value.rows[value2.r]?.[value2.c]
            : undefined;
      if (value2 && value3 !== undefined) {
        items.push({
          id: [editing.frameId, ...editing.path, value2.r, value2.c].join("/"),
          kind: "cell",
          label: value3,
        });
      } else if (!value2 && value) {
        items.push({
          id: [editing.frameId, ...editing.path].join("/"),
          kind: value.kind,
          label: (0, runtime.nodeDisplayLabel)(value, 1 / 0),
        });
      }
    }
    return items
      .filter(
        (input: ObjectContextItem, options: number): boolean =>
          items.findLastIndex(
            (input2: ObjectContextItem): boolean => input2.id === input.id,
          ) === options,
      )
      .filter((input: ObjectContextItem): boolean =>
        objectContextIdPattern.test(input.id),
      );
  }
  function parseObjectContextId(
    contextId: string,
  ): ObjectContextSelection | null {
    if (!objectContextIdPattern.test(contextId)) {
      return null;
    }
    let [value, ...value2]: string[] = contextId.split("/");
    return {
      frameId: value!,
      path: value2.map(Number),
    };
  }
  function frameContextId(contextId: string | null | undefined): string | null {
    if (
      contextId != null &&
      objectContextIdPattern.test(contextId) &&
      !contextId.includes("/")
    ) {
      return contextId;
    } else {
      return null;
    }
  }
  function normalizeObjectContextIds(contextIds: readonly string[]): string[] {
    return contextIds
      .filter(
        (input: string, options: number): boolean =>
          contextIds.lastIndexOf(input) === options,
      )
      .filter((input: string): boolean => objectContextIdPattern.test(input))
      .slice(-20);
  }
  function selectedNode(
    slide: Slide,
    selection: NodeSelection,
  ): SlideNode | undefined {
    let frame: Frame | undefined = (0, runtime.frameById)(
      slide,
      selection.frameId,
    );
    if (!frame) {
      return;
    }
    return (0, runtime.nodeAtPath)(frame.node, selectionNodePath(selection));
  }
  function filterValidSelections(
    slide: Slide,
    selections: readonly NodeSelection[],
  ): NodeSelection[] {
    return selections.filter(
      (input: NodeSelection): boolean =>
        selectedNode(slide, input) !== undefined,
    );
  }
  function toggleNodeSelection(
    selections: readonly NodeSelection[],
    selection: NodeSelection,
  ): NodeSelection[] {
    let value: NodeSelection[] = selections.filter(
      (input: NodeSelection): boolean => !selectionsEqual(input, selection),
    );
    if (value.length === selections.length) {
      return [...selections, selection];
    } else {
      return value;
    }
  }
  function selectionContainsNode(
    selections: readonly NodeSelection[],
    selection: NodeSelection,
  ): boolean {
    return selections.some((input: NodeSelection): boolean =>
      selectionsEqual(input, selection),
    );
  }
  function updateSelectedNode(
    slide: Slide,
    selection: NodeSelection,
    update: (node: SlideNode) => SlideNode,
  ): Slide {
    if (selectedNode(slide, selection) === undefined) {
      return slide;
    }
    let frame: Frame | undefined = (0, runtime.frameById)(
      slide,
      selection.frameId,
    );
    if (!frame) {
      return slide;
    }
    let updatedNode: SlideNode = (0, runtime.updateNodeAtPath)(
      frame.node,
      selectionNodePath(selection),
      update,
    );
    if (
      !(0, runtime.nodeTreeWithinDepthLimit)(updatedNode, 0) &&
      (0, runtime.nodeTreeWithinDepthLimit)(frame.node, 0)
    ) {
      return slide;
    }
    return (0, runtime.updateSlideFrame)(
      slide,
      selection.frameId,
      (input: Frame): Frame => ({
        ...input,
        node: updatedNode,
      }),
    );
  }
  function cssColorOpacity(color: string): number {
    let value: string = color.trim().toLowerCase();
    if (value === "transparent") {
      return 0;
    }
    let value2: RegExpExecArray | null = /^#([0-9a-f]{3,8})$/.exec(value);
    if (value2 !== null) {
      let value4: string = value2[1]!;
      if (value4.length === 4) {
        return parseInt(value4[3]! + value4[3]!, 16) / 255;
      }
      if (value4.length === 8) {
        return parseInt(value4.slice(6, 8), 16) / 255;
      }
      return 1;
    }
    let value3: RegExpExecArray | null = /^(?:rgba?|hsla?)\(([^)]*)\)$/.exec(
      value,
    );
    if (value3 !== null) {
      let value4: string = value3[1]!,
        callback = (input: number): number =>
          Number.isFinite(input) ? Math.min(1, Math.max(0, input)) : 1,
        callback2 = (input: string): number =>
          callback(
            input.endsWith("%")
              ? Number(input.slice(0, -1)) / 100
              : Number(input),
          ),
        value5: number = value4.indexOf("/");
      if (value5 >= 0) {
        return callback2(value4.slice(value5 + 1).trim());
      }
      let value6: string[] = value4.split(",");
      if (value6.length < 4) {
        return 1;
      }
      return callback2(value6[3]!.trim());
    }
    return 1;
  }
  function styleHasVisiblePaint(style?: StyleBag): boolean {
    if (style === undefined) {
      return false;
    }
    let backgroundColor: string | undefined = style.backgroundColor;
    if (
      typeof backgroundColor === "string" &&
      cssColorOpacity(backgroundColor) > 0
    ) {
      return true;
    }
    let backgroundGradient = style.backgroundGradient;
    if (
      backgroundGradient !== undefined &&
      backgroundGradient.stops.some(
        (input): boolean => cssColorOpacity(input.color) > 0,
      )
    ) {
      return true;
    }
    if (style.borderStyle !== undefined && style.borderStyle !== "none") {
      let borderWidth: number | undefined = style.borderWidth,
        value: boolean = borderWidth === undefined || borderWidth > 0,
        borderColor: string | undefined = style.borderColor,
        value2: boolean =
          borderColor === undefined ||
          (typeof borderColor === "string" && cssColorOpacity(borderColor) > 0);
      if (value && value2) {
        return true;
      }
    }
    if (
      style.boxShadow?.some(
        (input): boolean => cssColorOpacity(input.color) > 0,
      ) === true
    ) {
      return true;
    }
    return false;
  }
  function resolvePaintedSelection(
    frameId: string,
    node: SlideNode,
    path: readonly number[],
  ): NodeSelection | null {
    if ((0, runtime.isOverlayNode)(node)) {
      if (node.group === true && path.length > 0) {
        let value2: number = path[0]!,
          value3: SlideNode | undefined =
            value2 === 0
              ? isEmptyGroupBase(node)
                ? undefined
                : node.base
              : node.layers[value2 - 1]?.node;
        if (value3 === undefined) {
          return {
            frameId: frameId,
          };
        }
        let value4: NodeSelection | null = resolvePaintedSelection(
          frameId,
          value3,
          path.slice(1),
        );
        if (
          value2 === 0 &&
          (value4 === null || selectionNodePath(value4).length === 0)
        ) {
          return {
            frameId: frameId,
          };
        }
        return createNodeSelection(frameId, [
          value2,
          ...(value4 === null ? [] : selectionNodePath(value4)),
        ]);
      }
      if (path.length > 0) {
        return createNodeSelection(frameId, [path[0]!]);
      }
      if (styleHasVisiblePaint(node.style)) {
        return {
          frameId: frameId,
        };
      } else {
        return null;
      }
    }
    if (!(0, runtime.isFlowContainer)(node)) {
      return {
        frameId: frameId,
      };
    }
    let items: number[] = [...path];
    while (
      items.length > 0 &&
      (0, runtime.nodeAtPath)(node, items) === undefined
    )
      items.pop();
    let value: SlideNode = (0, runtime.nodeAtPath)(node, items)!;
    if (
      !(0, runtime.isFlowContainer)(value) &&
      !(0, runtime.isOverlayNode)(value)
    ) {
      return createNodeSelection(frameId, items);
    }
    for (let length: number = items.length; length >= 0; length--) {
      let value2: number[] = items.slice(0, length),
        value3: SlideNode | undefined = (0, runtime.nodeAtPath)(node, value2);
      if (value3 !== undefined && styleHasVisiblePaint(value3.style)) {
        return createNodeSelection(frameId, value2);
      }
    }
    return null;
  }
  function isEmptyGroupBase(node: SlideNode): boolean {
    return (
      (0, runtime.isOverlayNode)(node) &&
      node.group === true &&
      node.base.kind === "stack" &&
      node.base.children.length === 0
    );
  }
  function resolvePointerSelection(
    frameId: string,
    node: SlideNode,
    path: readonly number[],
    selected: readonly NodeSelection[],
    options: PointerSelectionOptions,
  ): PointerSelection {
    let items: number[] = [...path];
    while (
      items.length > 0 &&
      (0, runtime.nodeAtPath)(node, items) === undefined
    )
      items.pop();
    let value: NodeSelection | null = resolvePaintedSelection(
        frameId,
        node,
        items,
      ),
      value2: NodeSelection | null = value;
    for (
      let value5: number = options.flow === true ? 1 : 0;
      options.groupFirst && value5 <= items.length;
      value5++
    ) {
      let value6: SlideNode | undefined = (0, runtime.nodeAtPath)(
          node,
          items.slice(0, value5),
        ),
        value7: boolean =
          value6 !== undefined &&
          ((0, runtime.isFlowContainer)(value6) ||
            (0, runtime.isOverlayNode)(value6)) &&
          value6.group === true,
        value8: boolean =
          value5 < items.length &&
          selected.some(
            (input: NodeSelection): boolean =>
              input.frameId === frameId &&
              selectionNodePath(input).length > value5 &&
              nodePathsEqual(
                selectionNodePath(input).slice(0, value5),
                items.slice(0, value5),
              ),
          );
      if (value7 && !value8) {
        value2 = createNodeSelection(frameId, items.slice(0, value5));
        break;
      }
    }
    let value3: NodeSelection | null =
        value2 !== null &&
        (0, runtime.isOverlayNode)(node) &&
        node.group === true &&
        selectionNodePath(value2).length > 1 &&
        value2 !== null
          ? selectionNodePath(value2)[0] === 0
            ? {
                frameId: frameId,
              }
            : createNodeSelection(frameId, [selectionNodePath(value2)[0]!])
          : value2,
      value4: boolean =
        options.textTap &&
        value2 !== null &&
        value !== null &&
        !selectionsEqual(value2, value) &&
        (0, runtime.nodeAtPath)(node, selectionNodePath(value))?.kind ===
          "text";
    return {
      grab: value3,
      tap: value4 ? value : value2,
      add: value2,
    };
  }
  function togglePointerSelection(
    selections: readonly NodeSelection[],
    pointerSelection: PointerSelection,
  ): NodeSelection[] | null {
    if (
      pointerSelection.add === null ||
      pointerSelection.grab === null ||
      selectionsEqual(pointerSelection.add, pointerSelection.grab)
    ) {
      return null;
    } else {
      return toggleNodeSelection(selections, pointerSelection.add);
    }
  }
  function pointerSelectsGroup(
    frameId: string,
    node: SlideNode,
    path: readonly number[],
    selected: readonly NodeSelection[],
    options: PointerSelectionOptions,
  ): NodeSelection | null {
    let tap: NodeSelection | null = resolvePointerSelection(
        frameId,
        node,
        path,
        selected,
        {
          ...options,
          textTap: false,
        },
      ).tap,
      value: number = tap === null ? 0 : selectionNodePath(tap).length,
      value2: SlideNode | undefined =
        tap === null
          ? undefined
          : (0, runtime.nodeAtPath)(node, selectionNodePath(tap));
    if (
      tap === null ||
      value2 === undefined ||
      !("group" in value2) ||
      value2.group !== true ||
      path.length <= value
    ) {
      return null;
    }
    return resolvePointerSelection(
      frameId,
      node,
      path,
      [...selected, createNodeSelection(frameId, path.slice(0, value + 1))],
      options,
    ).tap;
  }
  function collectMarqueeSelection(
    slide: string,
    rect: SlideNode,
  ): NodeSelection[] {
    let items: NodeSelection[] = [],
      callback = (source: SlideNode, items2: number[]): void => {
        let value: SlideNode[] | undefined = (0, runtime.nodeChildren)(source),
          value2: boolean =
            items2.length > 0 &&
            ((0, runtime.isFlowContainer)(source) ||
              (0, runtime.isOverlayNode)(source)) &&
            source.group === true;
        if (
          value !== undefined &&
          !value2 &&
          (items2.length === 0 || !styleHasVisiblePaint(source.style))
        ) {
          value.forEach(
            (input: SlideNode, options: number): void =>
              callback(input, [...items2, options]),
          );
        } else if (items2.length > 0 && source.kind !== "spacer") {
          items.push(createNodeSelection(slide, items2));
        }
      };
    callback(rect, []);
    return items;
  }
  function commonSelectedNodeKind(
    slide: Slide,
    selections: readonly NodeSelection[],
  ): SlideNodeKind | undefined {
    let value: SlideNodeKind | undefined;
    for (let value2 of selections) {
      let value3: SlideNode | undefined = selectedNode(slide, value2);
      if (!value3) {
        return;
      }
      if (value === undefined) {
        value = value3.kind;
      } else if (value !== value3.kind) {
        return;
      }
    }
    return value;
  }
  bindRuntimeValue(runtime, "selectionNodePath", () => selectionNodePath);
  bindRuntimeValue(runtime, "createNodeSelection", () => createNodeSelection);
  bindRuntimeValue(runtime, "parentNodeSelection", () => parentNodeSelection);
  bindRuntimeValue(runtime, "nodePathsEqual", () => nodePathsEqual);
  bindRuntimeValue(runtime, "compareNodePaths", () => compareNodePaths);
  bindRuntimeValue(
    runtime,
    "sortSelectionsInDocumentOrder",
    () => sortSelectionsInDocumentOrder,
  );
  bindRuntimeValue(runtime, "selectionsEqual", () => selectionsEqual);
  bindRuntimeValue(runtime, "selectionKey", () => selectionKey);
  bindRuntimeValue(runtime, "selectionsKey", () => selectionsKey);
  bindRuntimeValue(
    runtime,
    "selectedObjectContextIds",
    () => selectedObjectContextIds,
  );
  bindRuntimeValue(
    runtime,
    "selectedObjectContext",
    () => selectedObjectContext,
  );
  bindRuntimeValue(runtime, "parseObjectContextId", () => parseObjectContextId);
  bindRuntimeValue(runtime, "frameContextId", () => frameContextId);
  bindRuntimeValue(
    runtime,
    "normalizeObjectContextIds",
    () => normalizeObjectContextIds,
  );
  bindRuntimeValue(runtime, "selectedNode", () => selectedNode);
  bindRuntimeValue(
    runtime,
    "filterValidSelections",
    () => filterValidSelections,
  );
  bindRuntimeValue(runtime, "toggleNodeSelection", () => toggleNodeSelection);
  bindRuntimeValue(
    runtime,
    "selectionContainsNode",
    () => selectionContainsNode,
  );
  bindRuntimeValue(runtime, "updateSelectedNode", () => updateSelectedNode);
  bindRuntimeValue(runtime, "cssColorOpacity", () => cssColorOpacity);
  bindRuntimeValue(runtime, "styleHasVisiblePaint", () => styleHasVisiblePaint);
  bindRuntimeValue(
    runtime,
    "resolvePaintedSelection",
    () => resolvePaintedSelection,
  );
  bindRuntimeValue(runtime, "isEmptyGroupBase", () => isEmptyGroupBase);
  bindRuntimeValue(
    runtime,
    "resolvePointerSelection",
    () => resolvePointerSelection,
  );
  bindRuntimeValue(
    runtime,
    "togglePointerSelection",
    () => togglePointerSelection,
  );
  bindRuntimeValue(runtime, "pointerSelectsGroup", () => pointerSelectsGroup);
  bindRuntimeValue(
    runtime,
    "collectMarqueeSelection",
    () => collectMarqueeSelection,
  );
  bindRuntimeValue(
    runtime,
    "commonSelectedNodeKind",
    () => commonSelectedNodeKind,
  );
  bindRuntimeValue(
    runtime,
    "objectContextIdPattern",
    () => objectContextIdPattern,
    (value) => {
      objectContextIdPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "overlayHasVisiblePaint",
    () => overlayHasVisiblePaint,
    (value) => {
      overlayHasVisiblePaint = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "initializeModelSelection",
    () => initializeModelSelection,
    (value) => {
      initializeModelSelection = value;
    },
  );
  return () => {
    overlayHasVisiblePaint = (input: OverlayNode): boolean =>
      styleHasVisiblePaint(input.style) ||
      styleHasVisiblePaint(input.base.style);
    initializeModelSelection = (0, runtime.initializeOnce)((): void => {
      (0, runtime.initializeSlideModel)();
      (0, runtime.initializeModelEditing)();
      objectContextIdPattern = /^[A-Za-z0-9_-]{1,64}(\/\d{1,2}){0,4}$/;
    });
  };
}
