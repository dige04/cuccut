/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
} from "../bindings";
import type {
  Axis,
  Frame,
  NodePlacement,
  OverlayLayer,
  OverlayNode,
  Slide,
  SlideNode,
  StackNode,
} from "../deck-contracts";
import type {
  GroupMember,
  GroupRect,
  GroupRectMeasure,
  GroupSize,
  NodePath,
  NodeSelection,
} from "../layout/selection-groups";

/** The command a grouping shortcut stands for. */
export type GroupingCommand = "group" | "ungroup";
/** The main axis of a stack: "h" is a row, "v" a column. */
export type GroupAxis = StackNode["dir"];
/** The key event fields that decide whether a keystroke is a grouping shortcut. */
export interface GroupingKeyEvent {
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  shiftKey: boolean;
  key: string;
  code: string;
}
/** The user-facing reasons a group or ungroup command is refused, or the note it leaves. */
export interface GroupRefusalMessages {
  few: string;
  where: string;
  stuck: string;
  styled: string;
  apart: string;
  inside: string;
  already: string;
  labels: string;
  many: string;
  embed: string;
  deep: string;
  full: string;
  nothing: string;
  card: string;
  labelsStay: string;
  painted: string;
  unmarked: string;
  later: string;
}
/** A top-left position for an overlay layer, in slide px. */
export interface GroupLayerOrigin {
  x: number;
  y: number;
}
/** A frame whose node is a group overlay. */
export interface OverlayGroupFrame extends Frame {
  node: OverlayNode;
}

declare module "../bindings" {
  interface RuntimeBindings {
    GROUP_COMMAND: GroupingCommand;
    GROUP_TEXT_TAP_ENABLED: boolean;
    GROUP_MEMBER_SIZES_FROM_MODEL: boolean;
    GROUP_RESIZING_ENABLED: boolean;
    GROUP_GROWING_STACK_CHILDREN_ENABLED: boolean;
    GROUP_MIXED_FRAME_STACK_CHILDREN_ENABLED: boolean;
    UNGROUP_UNMARKED_STACK_ENABLED: boolean;
    GROUP_ALT_MODIFIER: boolean;
    GROUP_REFUSAL_MESSAGES: GroupRefusalMessages;
    GROUP_COORDINATE_TOLERANCE: number;
    GROUP_ZERO_ANCHOR: Axis;
    groupingKeyCommand: (event: GroupingKeyEvent) => GroupingCommand | undefined;
    roundGroupCoordinate: (value: number) => number;
    groupMainDimension: (rectangle: GroupSize, direction: GroupAxis) => number;
    structurallyEqualGroupValues: (left: unknown, right: unknown) => boolean;
    normalizedGroupSelection: (
      slide: Slide,
      selection: readonly NodeSelection[],
    ) => NodeSelection[];
    nodeMainAxisInsets: (node: SlideNode, direction: GroupAxis) => number;
    hasGroupSizingConstraint: (
      place: NodePlacement | undefined,
      direction: GroupAxis,
    ) => boolean;
    stackChildrenFitMeasuredBounds: (
      frame: Frame,
      path: NodePath,
      measure: GroupRectMeasure,
    ) => boolean;
    stackMainAxisSizeIsKnown: (
      frame: Frame,
      path: NodePath,
      measure: GroupRectMeasure,
    ) => boolean;
    childHasGrow: (node: SlideNode) => boolean;
    canGroupStackChildren: (
      stack: SlideNode,
      selected: number | undefined,
      startIndex: number,
      hasKnownSize: boolean,
    ) => boolean;
    groupedChildrenPlacement: (
      stack: StackNode,
      children: readonly SlideNode[],
    ) => NodePlacement | undefined;
    groupRelativeAnchor: (
      anchor: Axis,
      relative: number,
      size: number,
      preserveHug: boolean,
    ) => Axis;
    groupFrameSelection: (selected: readonly GroupMember[]) => Frame;
    regroupOverlayLayers: (
      frame: Frame,
      overlay: SlideNode,
      rectangles: readonly GroupLayerOrigin[],
      fallbackRectangles: ReadonlyArray<GroupRect | undefined>,
    ) => Frame | undefined;
    hasLeadingOverlayAnchors: (frame: Frame, overlay: SlideNode) => boolean;
    isLeadingOverlayGroup: (frame: Frame) => frame is OverlayGroupFrame;
    moveLeadingGroupLayer: (
      frame: Frame,
      index: number,
      dx: number,
      dy2: number,
      rectangles: ReadonlyArray<GroupRect | undefined>,
    ) => Frame | undefined;
    scaleLeadingOverlayGroup: (before: Frame, after: Frame) => Frame | undefined;
    /** `after` is a layer of the group; callers may pass an array element they have already counted. */
    resizeGroupedFrame(
      before: Frame,
      after: OverlayLayer | undefined,
      rectangle: GroupRect | undefined,
    ): Frame | undefined;
    canFlattenNestedStackGroup: (parent: SlideNode, child: SlideNode) => boolean;
  }
}

export function installEditorGrouping(runtime: RuntimeBindings): () => void {
  var GROUP_COMMAND: RuntimeBindings["GROUP_COMMAND"];
  var GROUP_TEXT_TAP_ENABLED: RuntimeBindings["GROUP_TEXT_TAP_ENABLED"];
  var GROUP_MEMBER_SIZES_FROM_MODEL: RuntimeBindings["GROUP_MEMBER_SIZES_FROM_MODEL"];
  var GROUP_RESIZING_ENABLED: RuntimeBindings["GROUP_RESIZING_ENABLED"];
  var GROUP_GROWING_STACK_CHILDREN_ENABLED: RuntimeBindings["GROUP_GROWING_STACK_CHILDREN_ENABLED"];
  var GROUP_MIXED_FRAME_STACK_CHILDREN_ENABLED: RuntimeBindings["GROUP_MIXED_FRAME_STACK_CHILDREN_ENABLED"];
  var UNGROUP_UNMARKED_STACK_ENABLED: RuntimeBindings["UNGROUP_UNMARKED_STACK_ENABLED"];
  var GROUP_ALT_MODIFIER: RuntimeBindings["GROUP_ALT_MODIFIER"];
  var GROUP_REFUSAL_MESSAGES: RuntimeBindings["GROUP_REFUSAL_MESSAGES"];
  var GROUP_COORDINATE_TOLERANCE: RuntimeBindings["GROUP_COORDINATE_TOLERANCE"];
  var roundGroupCoordinate: RuntimeBindings["roundGroupCoordinate"];
  var groupMainDimension: RuntimeBindings["groupMainDimension"];
  var structurallyEqualGroupValues: RuntimeBindings["structurallyEqualGroupValues"];
  var hasGroupSizingConstraint: RuntimeBindings["hasGroupSizingConstraint"];
  var childHasGrow: RuntimeBindings["childHasGrow"];
  var GROUP_ZERO_ANCHOR: RuntimeBindings["GROUP_ZERO_ANCHOR"];
  var hasLeadingOverlayAnchors: RuntimeBindings["hasLeadingOverlayAnchors"];
  var isLeadingOverlayGroup: RuntimeBindings["isLeadingOverlayGroup"];
  function groupingKeyCommand(
    event: GroupingKeyEvent,
  ): GroupingCommand | undefined {
    if (
      !(event.metaKey || event.ctrlKey) ||
      event.altKey !== GROUP_ALT_MODIFIER
    ) {
      return;
    }
    let value: boolean =
      /^[\p{L}\p{M}]$/u.test(event.key) && !/\p{Script=Latin}/u.test(event.key);
    if (
      event.key.toLowerCase() !== "g" &&
      !(event.code === "KeyG" && (event.altKey || value))
    ) {
      return;
    }
    if (event.shiftKey) {
      return "ungroup";
    } else {
      return "group";
    }
  }
  function normalizedGroupSelection(
    slide: Slide,
    selection: readonly NodeSelection[],
  ): NodeSelection[] {
    let value = selection.flatMap((input: NodeSelection): NodeSelection[] => {
        let value2 = (0, runtime.frameById)(slide, input.frameId);
        if (
          value2 === undefined ||
          (0, runtime.isEmptyBackgroundFrame)(value2) ||
          ((0, runtime.selectedNode)(slide, input)?.kind ?? "spacer") ===
            "spacer"
        ) {
          return [];
        }
        return [
          (0, runtime.isEmptyGroupBase)(value2.node) &&
          (0, runtime.nodePathsEqual)((0, runtime.selectionNodePath)(input), [
            0,
          ])
            ? {
                frameId: input.frameId,
              }
            : input,
        ];
      }),
      callback = (input: NodeSelection, options: NodeSelection): boolean =>
        options.frameId === input.frameId &&
        (0, runtime.selectionNodePath)(options).length <
          (0, runtime.selectionNodePath)(input).length &&
        (0, runtime.nodePathsEqual)(
          (0, runtime.selectionNodePath)(options),
          (0, runtime.selectionNodePath)(input).slice(
            0,
            (0, runtime.selectionNodePath)(options).length,
          ),
        );
    return (0, runtime.sortSelectionsInDocumentOrder)(
      slide,
      value.filter(
        (input: NodeSelection, options: number): boolean =>
          value.findIndex(
            (input2: NodeSelection): boolean =>
              (0, runtime.selectionsEqual)(input2, input),
          ) === options &&
          !value.some((input2: NodeSelection): boolean =>
            callback(input, input2),
          ),
      ),
    );
  }
  function nodeMainAxisInsets(node: SlideNode, direction: GroupAxis): number {
    let callback = (input: unknown): number =>
        typeof input === "number" ? input : 0,
      value = (0, runtime.borderWidthsBySide)(node.style);
    if (direction === "h") {
      return (
        callback(node.style?.paddingLeft) +
        callback(node.style?.paddingRight) +
        value.left +
        value.right
      );
    } else {
      return (
        callback(node.style?.paddingTop) +
        callback(node.style?.paddingBottom) +
        value.top +
        value.bottom
      );
    }
  }
  function stackChildrenFitMeasuredBounds(
    frame: Frame,
    path: NodePath,
    measure: GroupRectMeasure,
  ): boolean {
    let value = (0, runtime.nodeAtPath)(frame.node, path),
      value2 = measure.rect(
        (0, runtime.createNodeSelection)(frame.id, path),
      );
    if (value === undefined || value.kind !== "stack" || value2 === undefined) {
      return false;
    }
    let value3 = value.children.map(
      (input: SlideNode, options: number): GroupRect | undefined =>
        measure.rect(
          (0, runtime.createNodeSelection)(frame.id, [...path, options]),
        ),
    );
    if (value3.some((input): boolean => input === undefined)) {
      return false;
    }
    let value4: number =
      value3.reduce(
        (input: number, options): number =>
          input + groupMainDimension(options!, value.dir),
        0,
      ) +
      value.gap * Math.max(0, value.children.length - 1);
    if (
      groupMainDimension(value2, value.dir) -
        nodeMainAxisInsets(value, value.dir) -
        value4 >
      GROUP_COORDINATE_TOLERANCE
    ) {
      return true;
    }
    return value.children.some(
      (source: SlideNode, options: number): boolean => {
        let place = source.place,
          value5: number | undefined =
            source.kind === "spacer" ? (place?.basis ?? 0) : place?.basis;
        return (
          (place?.grow ?? 0) > 0 &&
          value5 !== undefined &&
          place?.minW === undefined &&
          place?.minH === undefined &&
          place?.minWFit === undefined &&
          !hasGroupSizingConstraint(place, value.dir) &&
          groupMainDimension(value3[options]!, value.dir) -
            Math.max(value5, nodeMainAxisInsets(source, value.dir)) >
            GROUP_COORDINATE_TOLERANCE
        );
      },
    );
  }
  function stackMainAxisSizeIsKnown(
    frame: Frame,
    path: NodePath,
    measure: GroupRectMeasure,
  ): boolean {
    let value = (0, runtime.nodeAtPath)(frame.node, path);
    if (value === undefined || value.kind !== "stack") {
      return false;
    }
    let dir = value.dir;
    if (stackChildrenFitMeasuredBounds(frame, path, measure)) {
      return true;
    }
    for (let items: NodePath = [...path]; ; items = items.slice(0, -1)) {
      if (items.length === 0) {
        let value5 = dir === "h" ? frame.x : frame.y;
        if (value5.anchor === "fill" || value5.size !== undefined) {
          return false;
        }
        let value6 = measure.rect({
          frameId: frame.id,
        });
        if (dir === "v" || value6 === undefined) {
          return dir === "v";
        }
        if (value5.anchor === "center") {
          return (
            value6.w <
            runtime.SLIDE_WIDTH / 2 - value5.offset - GROUP_COORDINATE_TOLERANCE
          );
        }
        if (value5.anchor === "trailing") {
          return value6.x > GROUP_COORDINATE_TOLERANCE;
        } else {
          return (
            value6.x + value6.w <
            runtime.SLIDE_WIDTH - GROUP_COORDINATE_TOLERANCE
          );
        }
      }
      let value2 = items.slice(0, -1),
        value3 = (0, runtime.nodeAtPath)(frame.node, value2),
        value4 = (0, runtime.nodeAtPath)(frame.node, items)?.place;
      if (value3 === undefined || hasGroupSizingConstraint(value4, dir)) {
        return false;
      }
      if (value3.kind === "grid") {
        return dir === "v" && value3.rows === undefined;
      }
      if (value3.kind !== "stack") {
        return false;
      }
      if (value3.dir === dir) {
        if ((value4?.grow ?? 0) > 0 || value4?.basis !== undefined) {
          return false;
        }
        if (stackChildrenFitMeasuredBounds(frame, value2, measure)) {
          return true;
        }
      } else if ((value4?.alignSelf ?? value3.align) !== "stretch") {
        let value5 = measure.rect(
            (0, runtime.createNodeSelection)(frame.id, items),
          ),
          value6 = measure.rect(
            (0, runtime.createNodeSelection)(frame.id, value2),
          );
        if (value5 === undefined || value6 === undefined) {
          return false;
        }
        if (
          groupMainDimension(value5, dir) <
          groupMainDimension(value6, dir) -
            nodeMainAxisInsets(value3, dir) -
            GROUP_COORDINATE_TOLERANCE
        ) {
          return true;
        }
      }
    }
  }
  function canGroupStackChildren(
    stack: SlideNode,
    selected: number | undefined,
    startIndex: number,
    hasKnownSize: boolean,
  ): boolean {
    if (
      stack.kind !== "stack" ||
      stack.wrap === true ||
      !hasKnownSize ||
      startIndex < 1 ||
      startIndex >= stack.children.length
    ) {
      return false;
    }
    if (
      stack.justify === "between" ||
      stack.justify === "around" ||
      stack.justify === "evenly" ||
      stack.align === "baseline"
    ) {
      return false;
    }
    let value = stack.children.slice(selected, selected! + startIndex);
    if (
      value.length !== startIndex ||
      value.some((source: SlideNode): boolean => source.kind === "spacer")
    ) {
      return false;
    }
    if (
      stack.align !== "stretch" &&
      value.some(
        (input: SlideNode): boolean => input.place?.alignSelf !== undefined,
      )
    ) {
      return false;
    }
    if (!value.some(childHasGrow)) {
      return (
        stack.dir === "v" ||
        !value.some(
          (input: SlideNode): boolean =>
            input.place?.basis !== undefined && input.place.shrink !== 0,
        )
      );
    }
    let callback = (input: NodePlacement | undefined): boolean =>
      (input?.grow ?? 0) >= 1 &&
      input?.basis === 0 &&
      input.shrink === undefined &&
      input.minW === undefined &&
      input.maxW === undefined &&
      input.minWFit === undefined &&
      input.aspect === undefined;
    return (
      GROUP_GROWING_STACK_CHILDREN_ENABLED &&
      stack.dir === "h" &&
      value.every(
        (input: SlideNode): boolean =>
          childHasGrow(input) && callback(input.place),
      )
    );
  }
  function groupedChildrenPlacement(
    stack: StackNode,
    children: readonly SlideNode[],
  ): NodePlacement | undefined {
    if (!children.some(childHasGrow)) {
      return;
    }
    return {
      grow: children.reduce(
        (input: number, options: SlideNode): number =>
          input + (options.place?.grow ?? 0),
        0,
      ),
      basis:
        stack.gap * (children.length - 1) +
        children.reduce(
          (input: number, options: SlideNode): number =>
            input + nodeMainAxisInsets(options, stack.dir),
          0,
        ),
    };
  }
  function groupRelativeAnchor(
    anchor: Axis,
    relative: number,
    size: number,
    preserveHug: boolean,
  ): Axis {
    let value: number | undefined =
      anchor.anchor !== "fill" && anchor.size !== undefined
        ? anchor.size
        : preserveHug && anchor.anchor !== "fill"
          ? undefined
          : (0, runtime.ceilMeasuredNodeSize)(size);
    return {
      anchor: "leading",
      margin: roundGroupCoordinate(relative),
      offset: 0,
      ...(value !== undefined
        ? {
            size: value,
          }
        : {}),
    };
  }
  function groupFrameSelection(selected: readonly GroupMember[]): Frame {
    let value: number = Math.floor(
        Math.min(...selected.map((input: GroupMember): number => input.rect.x)),
      ),
      value2: number = Math.floor(
        Math.min(...selected.map((input: GroupMember): number => input.rect.y)),
      ),
      value3: OverlayLayer[] = selected.map(
        (input: GroupMember): OverlayLayer => ({
          node: input.node,
          x: groupRelativeAnchor(
            input.x,
            input.rect.x - value,
            input.rect.w,
            false,
          ),
          y: groupRelativeAnchor(
            input.y,
            input.rect.y - value2,
            input.rect.h,
            true,
          ),
        }),
      ),
      value4: number = (0, runtime.ceilMeasuredNodeSize)(
        Math.max(
          ...value3.map(
            (input: OverlayLayer, options: number): number =>
              input.x.margin + (input.x.size ?? selected[options]!.rect.w),
          ),
        ),
      ),
      value5: number = (0, runtime.ceilMeasuredNodeSize)(
        Math.max(
          ...value3.map(
            (input: OverlayLayer, options: number): number =>
              input.y.margin + (input.y.size ?? selected[options]!.rect.h),
          ),
        ),
      ),
      state: OverlayNode = {
        kind: "overlay",
        base: {
          kind: "stack",
          dir: "v",
          align: "stretch",
          gap: 0,
          children: [],
        },
        layers: value3,
        group: true,
      };
    return {
      id: (0, runtime.createModelId)(),
      x: (0, runtime.axisSpecFromRect)(
        GROUP_ZERO_ANCHOR,
        value,
        value4,
        runtime.SLIDE_WIDTH,
      ),
      y: (0, runtime.axisSpecFromRect)(
        GROUP_ZERO_ANCHOR,
        value2,
        value5,
        runtime.SLIDE_HEIGHT,
      ),
      node: state,
    };
  }
  function regroupOverlayLayers(
    frame: Frame,
    overlay: SlideNode,
    rectangles: readonly GroupLayerOrigin[],
    fallbackRectangles: ReadonlyArray<GroupRect | undefined>,
  ): Frame | undefined {
    if (
      (overlay as OverlayNode).layers.some(
        (input: OverlayLayer, options: number): boolean =>
          (input.x.size === undefined || input.y.size === undefined) &&
          fallbackRectangles[options] === undefined,
      )
    ) {
      return;
    }
    let value: number = Math.floor(
        Math.min(
          ...rectangles.map((input: GroupLayerOrigin): number => input.x),
        ),
      ),
      value2: number = Math.floor(
        Math.min(
          ...rectangles.map((input: GroupLayerOrigin): number => input.y),
        ),
      ),
      value3: OverlayLayer[] = (overlay as OverlayNode).layers.map(
        (input: OverlayLayer, options: number): OverlayLayer => ({
          ...input,
          x: {
            ...input.x,
            margin: roundGroupCoordinate(rectangles[options]!.x - value),
          },
          y: {
            ...input.y,
            margin: roundGroupCoordinate(rectangles[options]!.y - value2),
          },
        }),
      ),
      value4: number = (0, runtime.ceilMeasuredNodeSize)(
        Math.max(
          ...value3.map(
            (input: OverlayLayer, options: number): number =>
              input.x.margin + (input.x.size ?? fallbackRectangles[options]!.w),
          ),
        ),
      ),
      value5: number = (0, runtime.ceilMeasuredNodeSize)(
        Math.max(
          ...value3.map(
            (input: OverlayLayer, options: number): number =>
              input.y.margin + (input.y.size ?? fallbackRectangles[options]!.h),
          ),
        ),
      );
    return {
      ...frame,
      x: {
        ...frame.x,
        margin: value,
        size: value4,
      },
      y: {
        ...frame.y,
        margin: value2,
        size: value5,
      },
      node: {
        ...(overlay as OverlayNode),
        layers: value3,
      },
    };
  }
  function moveLeadingGroupLayer(
    frame: Frame,
    index: number,
    dx: number,
    dy2: number,
    rectangles: ReadonlyArray<GroupRect | undefined>,
  ): Frame | undefined {
    let node = frame.node as OverlayNode;
    if (
      !(0, runtime.isEmptyGroupBase)(node) ||
      !hasLeadingOverlayAnchors(frame, node) ||
      node.layers[index] === undefined
    ) {
      return;
    }
    let value = node.layers.map(
      (input: OverlayLayer, options: number): GroupLayerOrigin => ({
        x:
          options === index
            ? Math.max(0, frame.x.margin + input.x.margin + dx)
            : frame.x.margin + input.x.margin,
        y:
          options === index
            ? Math.max(0, frame.y.margin + input.y.margin + dy2)
            : frame.y.margin + input.y.margin,
      }),
    );
    return regroupOverlayLayers(frame, node, value, rectangles);
  }
  function scaleLeadingOverlayGroup(
    before: Frame,
    after: Frame,
  ): Frame | undefined {
    let node = before.node as OverlayNode;
    if (
      !(0, runtime.isEmptyGroupBase)(node) ||
      before.x.size === undefined ||
      before.y.size === undefined ||
      after.x.size === undefined ||
      after.y.size === undefined
    ) {
      return;
    }
    let value = after.x.size / before.x.size,
      value2 = after.y.size / before.y.size,
      callback = (input: Axis, options: number): Axis => ({
        ...input,
        margin: roundGroupCoordinate(input.margin * options),
        offset: roundGroupCoordinate(input.offset * options),
        ...(input.size !== undefined
          ? {
              size: Math.max(1, roundGroupCoordinate(input.size * options)),
            }
          : {}),
      });
    return {
      ...after,
      node: {
        ...node,
        layers: node.layers.map(
          (input: OverlayLayer): OverlayLayer => ({
            ...input,
            x: callback(input.x, value),
            y: callback(input.y, value2),
          }),
        ),
      },
    };
  }
  function resizeGroupedFrame(
    before: Frame,
    after: OverlayLayer,
    rectangle: GroupRect | undefined,
  ): Frame | undefined {
    let value: boolean =
      !(
        (0, runtime.isOverlayNode)(before.node) &&
        [before.node.style, before.node.base.style].some(
          (input): boolean =>
            input?.borderStyle !== undefined && input.borderStyle !== "none",
        )
      ) &&
      [before.x, before.y, after.x, after.y].every(
        (input: Axis): boolean => input.anchor === "leading",
      );
    if (!value && rectangle === undefined) {
      return;
    }
    let { place: place, ...remainingProps } = after.node,
      callback = (input: Axis, options: Axis): Axis =>
        options.size !== undefined
          ? {
              ...input,
              size: options.size,
            }
          : input,
      value2: Frame | undefined =
        !value && rectangle !== undefined
          ? (0, runtime.createFreeFrameFromNode)(after.node, rectangle)
          : undefined,
      value3: Frame =
        value2 !== undefined && rectangle !== undefined
          ? (0, runtime.normalizeNegativeFrameMargins)(
              {
                ...value2,
                x: callback(value2.x, after.x),
                y: callback(value2.y, after.y),
              },
              rectangle,
            )
          : {
              id: (0, runtime.createModelId)(),
              x: {
                ...after.x,
                margin: roundGroupCoordinate(before.x.margin + after.x.margin),
              },
              y: {
                ...after.y,
                margin: roundGroupCoordinate(before.y.margin + after.y.margin),
              },
              node: remainingProps,
            };
    if (before.build !== undefined) {
      return {
        ...value3,
        build: before.build,
      };
    } else {
      return value3;
    }
  }
  function canFlattenNestedStackGroup(
    parent: SlideNode,
    child: SlideNode,
  ): boolean {
    if (
      parent.kind !== "stack" ||
      child.kind !== "stack" ||
      parent.group !== true ||
      (parent.style !== undefined && Object.keys(parent.style).length > 0)
    ) {
      return false;
    }
    return (
      parent.dir === child.dir &&
      parent.gap === child.gap &&
      parent.align === child.align &&
      parent.wrap !== true &&
      parent.justify === undefined &&
      !parent.children.some(
        (source: SlideNode): boolean => source.kind === "spacer",
      )
    );
  }
  bindRuntimeValue(
    runtime,
    "GROUP_COMMAND",
    () => GROUP_COMMAND,
    (value) => {
      GROUP_COMMAND = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GROUP_TEXT_TAP_ENABLED",
    () => GROUP_TEXT_TAP_ENABLED,
    (value) => {
      GROUP_TEXT_TAP_ENABLED = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GROUP_MEMBER_SIZES_FROM_MODEL",
    () => GROUP_MEMBER_SIZES_FROM_MODEL,
    (value) => {
      GROUP_MEMBER_SIZES_FROM_MODEL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GROUP_RESIZING_ENABLED",
    () => GROUP_RESIZING_ENABLED,
    (value) => {
      GROUP_RESIZING_ENABLED = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GROUP_GROWING_STACK_CHILDREN_ENABLED",
    () => GROUP_GROWING_STACK_CHILDREN_ENABLED,
    (value) => {
      GROUP_GROWING_STACK_CHILDREN_ENABLED = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GROUP_MIXED_FRAME_STACK_CHILDREN_ENABLED",
    () => GROUP_MIXED_FRAME_STACK_CHILDREN_ENABLED,
    (value) => {
      GROUP_MIXED_FRAME_STACK_CHILDREN_ENABLED = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "UNGROUP_UNMARKED_STACK_ENABLED",
    () => UNGROUP_UNMARKED_STACK_ENABLED,
    (value) => {
      UNGROUP_UNMARKED_STACK_ENABLED = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GROUP_ALT_MODIFIER",
    () => GROUP_ALT_MODIFIER,
    (value) => {
      GROUP_ALT_MODIFIER = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GROUP_REFUSAL_MESSAGES",
    () => GROUP_REFUSAL_MESSAGES,
    (value) => {
      GROUP_REFUSAL_MESSAGES = value;
    },
  );
  bindRuntimeValue(runtime, "groupingKeyCommand", () => groupingKeyCommand);
  bindRuntimeValue(
    runtime,
    "GROUP_COORDINATE_TOLERANCE",
    () => GROUP_COORDINATE_TOLERANCE,
    (value) => {
      GROUP_COORDINATE_TOLERANCE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "roundGroupCoordinate",
    () => roundGroupCoordinate,
    (value) => {
      roundGroupCoordinate = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "groupMainDimension",
    () => groupMainDimension,
    (value) => {
      groupMainDimension = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "structurallyEqualGroupValues",
    () => structurallyEqualGroupValues,
    (value) => {
      structurallyEqualGroupValues = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizedGroupSelection",
    () => normalizedGroupSelection,
  );
  bindRuntimeValue(runtime, "nodeMainAxisInsets", () => nodeMainAxisInsets);
  bindRuntimeValue(
    runtime,
    "hasGroupSizingConstraint",
    () => hasGroupSizingConstraint,
    (value) => {
      hasGroupSizingConstraint = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "stackChildrenFitMeasuredBounds",
    () => stackChildrenFitMeasuredBounds,
  );
  bindRuntimeValue(
    runtime,
    "stackMainAxisSizeIsKnown",
    () => stackMainAxisSizeIsKnown,
  );
  bindRuntimeValue(
    runtime,
    "childHasGrow",
    () => childHasGrow,
    (value) => {
      childHasGrow = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "canGroupStackChildren",
    () => canGroupStackChildren,
  );
  bindRuntimeValue(
    runtime,
    "groupedChildrenPlacement",
    () => groupedChildrenPlacement,
  );
  bindRuntimeValue(runtime, "groupRelativeAnchor", () => groupRelativeAnchor);
  bindRuntimeValue(
    runtime,
    "GROUP_ZERO_ANCHOR",
    () => GROUP_ZERO_ANCHOR,
    (value) => {
      GROUP_ZERO_ANCHOR = value;
    },
  );
  bindRuntimeValue(runtime, "groupFrameSelection", () => groupFrameSelection);
  bindRuntimeValue(runtime, "regroupOverlayLayers", () => regroupOverlayLayers);
  bindRuntimeValue(
    runtime,
    "hasLeadingOverlayAnchors",
    () => hasLeadingOverlayAnchors,
    (value) => {
      hasLeadingOverlayAnchors = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isLeadingOverlayGroup",
    () => isLeadingOverlayGroup,
    (value) => {
      isLeadingOverlayGroup = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "moveLeadingGroupLayer",
    () => moveLeadingGroupLayer,
  );
  bindRuntimeValue(
    runtime,
    "scaleLeadingOverlayGroup",
    () => scaleLeadingOverlayGroup,
  );
  bindRuntimeValue(runtime, "resizeGroupedFrame", () => resizeGroupedFrame);
  bindRuntimeValue(
    runtime,
    "canFlattenNestedStackGroup",
    () => canFlattenNestedStackGroup,
  );
  return () => {
    (0, runtime.initializeSlideModel)();
    (0, runtime.initializeModelGeometry)();
    (0, runtime.initializeModelEditing)();
    (0, runtime.initializeModelSelection)();
    GROUP_COMMAND = "group";
    GROUP_TEXT_TAP_ENABLED = true;
    GROUP_MEMBER_SIZES_FROM_MODEL = false;
    GROUP_RESIZING_ENABLED = true;
    GROUP_GROWING_STACK_CHILDREN_ENABLED = true;
    GROUP_MIXED_FRAME_STACK_CHILDREN_ENABLED = true;
    UNGROUP_UNMARKED_STACK_ENABLED = false;
    GROUP_ALT_MODIFIER = false;
    GROUP_REFUSAL_MESSAGES = {
      few: "Select two or more objects to group.",
      where:
        "These can’t be grouped where they sit yet. Select everything in the same row or column, or drag them out first.",
      stuck:
        "These can’t be grouped where they sit yet. Drag them out first, then group them.",
      styled:
        "An object that is shifted or scaled by its own styling can’t be grouped yet.",
      apart:
        "Items in different rows or cards can’t be grouped yet. Group the rows or cards themselves, or drag the items out first.",
      inside: "Objects inside a group can’t be grouped again yet.",
      already: "These are already one group.",
      labels: "An object with items pinned on it can’t join a group yet.",
      many:
        "A group holds up to " +
        String(runtime.maxTextLineSpacing) +
        " objects.",
      embed: "A web embed can’t be grouped.",
      deep: "These sit too many levels deep to group. Drag them out first.",
      full: "This slide is full. Remove an element first.",
      nothing: "Nothing to ungroup. Select a group.",
      card: "A card can’t be ungrouped yet. Drag items out of it instead.",
      labelsStay: "An object with items pinned on it can’t be ungrouped yet.",
      painted:
        "A group that has a fill, border or shadow of its own can’t be grouped with other objects yet. Ungroup it first, or remove its fill, border and shadow.",
      unmarked: "No longer a group. Its contents stay where they are.",
      later: "That couldn’t be ungrouped just now. Try again.",
    };
    GROUP_COORDINATE_TOLERANCE = 0.5;
    roundGroupCoordinate = (value: number): number =>
      Math.round(value * 100) / 100;
    groupMainDimension = (rectangle: GroupSize, direction: GroupAxis): number =>
      direction === "h" ? rectangle.w : rectangle.h;
    structurallyEqualGroupValues = (left: unknown, right: unknown): boolean =>
      JSON.stringify(left) === JSON.stringify(right);
    hasGroupSizingConstraint = (
      place: NodePlacement | undefined,
      direction: GroupAxis,
    ): boolean =>
      place?.aspect !== undefined ||
      (direction === "h" ? place?.maxW : place?.maxH) !== undefined;
    childHasGrow = (node: SlideNode): boolean => (node.place?.grow ?? 0) > 0;
    GROUP_ZERO_ANCHOR = {
      anchor: "leading",
      margin: 0,
      offset: 0,
    };
    hasLeadingOverlayAnchors = (frame: Frame, overlay: SlideNode): boolean =>
      [
        frame.x,
        frame.y,
        ...(overlay as OverlayNode).layers.flatMap(
          (input: OverlayLayer): Axis[] => [input.x, input.y],
        ),
      ].every((input: Axis): boolean => input.anchor === "leading");
    isLeadingOverlayGroup = (frame: Frame): frame is OverlayGroupFrame =>
      (0, runtime.isEmptyGroupBase)(frame.node) &&
      hasLeadingOverlayAnchors(frame, frame.node);
  };
}
