/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type {
  Axis,
  Frame,
  Slide,
  SlideNode,
  StackNode,
  FlowContainerNode,
  FrameBuild,
  NodePlacement,
  OverlayNode,
} from "../deck-contracts";

/** Child indexes from a frame's root node down to a nested node. */
export type NodePath = number[];
/** A selected frame (no path) or a node inside it; `child` is the first path step. */
export interface NodeSelection {
  frameId: string;
  child?: number;
  path?: NodePath;
}
/** Measured box in slide coordinates. */
export interface GroupRect {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** Width and height only. */
export interface GroupSize {
  w: number;
  h: number;
}
/** Rect measurements the grouping code asks the canvas for. */
export interface GroupRectMeasure {
  rect(selection: NodeSelection): GroupRect | undefined;
}
/** Measurements for grouping and ungrouping, including whether a node was shrunk by its container. */
export interface GroupMeasure extends GroupRectMeasure {
  shrunk(selection: NodeSelection): boolean;
}
/** The grouping command was refused; `refused` is the user-facing explanation. */
export interface GroupRefusal {
  refused: string;
}
/** Successful grouping or ungrouping edit. */
export interface GroupOutcome {
  slide: Slide;
  selection: NodeSelection[];
  note?: string;
}
export type GroupResult = GroupRefusal | GroupOutcome;
/** What ungrouping does to one selected unit. */
export type UngroupKind = "free" | "dissolve" | "unmark" | "unwrap";
export type UngroupTarget = { kind: UngroupKind } | GroupRefusal;
/** Transform fields that make a node ineligible for grouping. */
export interface GroupNodeTransform {
  scale?: number;
  skewX?: number;
  skewY?: number;
  translateX?: number;
  translateY?: number;
}
/** A layer or frame about to be merged into an overlay group; the rect may still be unmeasured. */
export interface GroupMemberDraft {
  node: SlideNode;
  x: Axis;
  y: Axis;
  rect: GroupRect | undefined;
}
/** A measured group member. */
export interface GroupMember extends GroupMemberDraft {
  rect: GroupRect;
}
/** A flow container split into frames, one per child. */
export interface FlowGroupRects {
  slide: Slide;
  minted: Array<Frame | null>;
}
/** The part of a flow drag extraction that grouping reads. */
export interface FlowDragExtraction {
  newFrames: Array<Frame | null>;
}

declare module "../bindings" {
  interface RuntimeBindings {
    measureOverlayGroupLayout: (frame: Frame) => GroupSize | undefined;
    rewriteNestedOverlayPlacements: (
      node: Slide,
      visit: ReadonlySet<string>,
      options: GroupRectMeasure,
    ) => Slide;
    groupSelectedFramesAsOverlay: (
      slide: Slide,
      selectedFrameIds: ReadonlySet<string>,
      measure: GroupRectMeasure,
    ) => GroupRefusal | GroupOutcome;
    hasNodeTransform: (node: SlideNode) => boolean;
    normalizeNegativeFrameMargins: (frame: Frame, rect: GroupSize) => Frame;
    measureFlowGroupChildRects: (
      slide: Slide,
      frame: Frame,
      measure: GroupRectMeasure,
    ) => FlowGroupRects | undefined;
    groupSelectedUnits: (
      slide: Slide,
      selection: NodeSelection[],
      measure: GroupMeasure,
    ) => GroupResult;
    inspectUngroupTarget: (
      slide: Slide,
      unit: NodeSelection,
      measure: GroupMeasure,
      singleSelection: boolean,
    ) => UngroupTarget;
    removeGroupMarker: (node: SlideNode) => SlideNode;
    ungroupSelectedUnits: (
      slide: Slide,
      selection: NodeSelection[],
      measure: GroupMeasure,
    ) => GroupResult;
  }
}

export function installLayoutSelectionGroups(
  runtime: RuntimeBindings,
): () => void {
  function measureOverlayGroupLayout(frame: Frame): GroupSize | undefined {
    if (
      !(0, runtime.isEmptyGroupBase)(frame.node) ||
      frame.x.size === undefined ||
      frame.y.size === undefined
    ) {
      return;
    }
    let layerSizes = (frame.node as OverlayNode).layers.map(
      (input) => ({
        w: input.x.size ?? 0,
        h: input.y.size ?? 0,
        min: {
          w: 24,
          h: 24,
        },
      }),
    );
    return (0, runtime.selectionResizeScaleLimits)(
      {
        x: 0,
        y: 0,
        w: frame.x.size,
        h: frame.y.size,
      },
      layerSizes,
    ).min;
  }
  function rewriteNestedOverlayPlacements(
    node: Slide,
    visit: ReadonlySet<string>,
    options: GroupRectMeasure,
  ): Slide {
    let callback: (source: SlideNode) => SlideNode = (source) => {
        if ((0, runtime.isOverlayNode)(source)) {
          let value3 = callback((source as OverlayNode).base),
            value4 = (source as OverlayNode).layers.map(
              (input) => ({
                l: input,
                node: callback(input.node),
              }),
            );
          if (
            value3 === (source as OverlayNode).base &&
            value4.every(
              (input) => input.node === input.l.node,
            )
          ) {
            return source;
          } else {
            return {
              ...source,
              base: value3,
              layers: value4.map(
                (input) =>
                  input.node === input.l.node
                    ? input.l
                    : {
                        ...input.l,
                        node: input.node,
                      },
              ),
            };
          }
        }
        if (!(0, runtime.isFlowContainer)(source)) {
          return source;
        }
        let value2: SlideNode[] = (source as FlowContainerNode).children.flatMap(
          (input): SlideNode[] => {
            let value3 = callback(input);
            if (!(0, runtime.canFlattenNestedStackGroup)(value3, source)) {
              return [value3];
            }
            if ((value3 as StackNode).children.length <= 1) {
              return (value3 as StackNode).children;
            }
            let value4: NodePlacement | undefined =
              source.kind === "stack" && value3.place?.grow !== undefined
                ? (0, runtime.groupedChildrenPlacement)(source, (value3 as StackNode).children)
                : value3.place;
            return [
              (0, runtime.structurallyEqualGroupValues)(value4, value3.place)
                ? value3
                : {
                    ...value3,
                    ...(value4 !== undefined
                      ? {
                          place: value4,
                        }
                      : {}),
                  },
            ];
          },
        );
        if (
          value2.length === (source as FlowContainerNode).children.length &&
          value2.every(
            (input, options2) =>
              input === (source as FlowContainerNode).children[options2],
          )
        ) {
          return source;
        } else {
          return {
            ...source,
            children: value2,
          };
        }
      },
      value: Frame[] = node.frames.flatMap((input): Frame[] => {
        if (!visit.has(input.id)) {
          return [input];
        }
        let value2 = callback(input.node),
          value3: Frame =
            value2 === input.node
              ? input
              : {
                  ...input,
                  node: value2,
                };
        if (!(0, runtime.isEmptyGroupBase)(value2)) {
          return [value3];
        }
        let value4: boolean = !(0, runtime.overlayHasVisiblePaint)(value2 as OverlayNode);
        if (value4 && (value2 as OverlayNode).layers.length === 0) {
          return [];
        }
        if (value4 && (value2 as OverlayNode).layers.length === 1) {
          return [
            (0, runtime.resizeGroupedFrame)(
              value3,
              (value2 as OverlayNode).layers[0],
              options.rect((0, runtime.createNodeSelection)(input.id, [1])),
            ) ?? value3,
          ];
        }
        if (
          (value2 as OverlayNode).layers.length === 0 ||
          !(0, runtime.hasLeadingOverlayAnchors)(value3, value2)
        ) {
          return [value3];
        }
        let value5: Frame | undefined = (0, runtime.regroupOverlayLayers)(
          value3,
          value2,
          (value2 as OverlayNode).layers.map(
            (input2) => ({
              x: input.x.margin + input2.x.margin,
              y: input.y.margin + input2.y.margin,
            }),
          ),
          (value2 as OverlayNode).layers.map(
            (input2, options2) =>
              options.rect(
                (0, runtime.createNodeSelection)(input.id, [options2 + 1]),
              ),
          ),
        );
        return [
          value5 !== undefined &&
          !(0, runtime.structurallyEqualGroupValues)(value5, value3)
            ? value5
            : value3,
        ];
      });
    if (
      value.length === node.frames.length &&
      value.every(
        (input, options2) =>
          input === node.frames[options2],
      )
    ) {
      return node;
    } else {
      return {
        ...node,
        frames: value,
      };
    }
  }
  function groupSelectedFramesAsOverlay(
    slide: Slide,
    selectedFrameIds: ReadonlySet<string>,
    measure: GroupRectMeasure,
  ): GroupRefusal | GroupOutcome {
    let value = slide.frames.filter(
        (input) => selectedFrameIds.has(input.id),
      ),
      items: GroupMember[] = [];
    for (let value3 of value) {
      if (value3.node.kind === "html") {
        return {
          refused: runtime.GROUP_REFUSAL_MESSAGES.embed,
        };
      }
      if (
        (0, runtime.isOverlayNode)(value3.node) &&
        !(0, runtime.isEmptyGroupBase)(value3.node)
      ) {
        return {
          refused: runtime.GROUP_REFUSAL_MESSAGES.labels,
        };
      }
      if (
        (0, runtime.isEmptyGroupBase)(value3.node) &&
        (0, runtime.overlayHasVisiblePaint)(value3.node as OverlayNode)
      ) {
        return {
          refused: runtime.GROUP_REFUSAL_MESSAGES.painted,
        };
      }
      let value4: GroupMemberDraft[] = (0, runtime.isEmptyGroupBase)(value3.node)
        ? (value3.node as OverlayNode).layers.map(
            (input, options) => ({
              ...input,
              rect: measure.rect(
                (0, runtime.createNodeSelection)(value3.id, [options + 1]),
              ),
            }),
          )
        : [
            {
              node: value3.node,
              x: value3.x,
              y: value3.y,
              rect: measure.rect({
                frameId: value3.id,
              }),
            },
          ];
      for (let value5 of value4) {
        if (hasNodeTransform(value5.node)) {
          return {
            refused: runtime.GROUP_REFUSAL_MESSAGES.styled,
          };
        }
        if (value5.rect === undefined) {
          return {
            refused: runtime.GROUP_REFUSAL_MESSAGES.stuck,
          };
        }
        items.push({
          ...value5,
          rect: value5.rect,
        });
      }
    }
    if (items.length > runtime.maxTextLineSpacing) {
      return {
        refused: runtime.GROUP_REFUSAL_MESSAGES.many,
      };
    }
    let value2: Frame = (0, runtime.groupFrameSelection)(items);
    if (!(0, runtime.nodeTreeWithinDepthLimit)(value2.node, 0)) {
      return {
        refused: runtime.GROUP_REFUSAL_MESSAGES.deep,
      };
    }
    let build: FrameBuild | undefined = value[0]!.build;
    if (
      build !== undefined &&
      value.every(
        (input) =>
          (0, runtime.structurallyEqualGroupValues)(input.build, build),
      )
    ) {
      value2.build = build;
    }
    let id: string = value[value.length - 1]!.id;
    return {
      slide: {
        ...slide,
        frames: slide.frames.flatMap(
          (input) =>
            input.id === id
              ? [value2]
              : selectedFrameIds.has(input.id)
                ? []
                : [input],
        ),
      },
      selection: [
        {
          frameId: value2.id,
        },
      ],
    };
  }
  function hasNodeTransform(node: SlideNode): boolean {
    let transform: GroupNodeTransform | undefined = (0, runtime.nodeTransform)(node);
    return (
      transform !== undefined &&
      ((transform.scale ?? 1) !== 1 ||
        !!transform.skewX ||
        !!transform.skewY ||
        !!transform.translateX ||
        !!transform.translateY)
    );
  }
  function normalizeNegativeFrameMargins(
    frame: Frame,
    rect: GroupSize,
  ): Frame {
    let options: (input: Axis, options2: number, context: number) => Axis = (
      input,
      options2,
      context,
    ) =>
      input.margin < 0
        ? (0, runtime.axisSpecFromRect)(
            runtime.GROUP_ZERO_ANCHOR,
            input.margin,
            input.size ?? (0, runtime.ceilMeasuredNodeSize)(options2),
            context,
          )
        : input;
    return {
      ...frame,
      x: options(frame.x, rect.w, runtime.SLIDE_WIDTH),
      y: options(frame.y, rect.h, runtime.SLIDE_HEIGHT),
    };
  }
  function measureFlowGroupChildRects(
    slide: Slide,
    frame: Frame,
    measure: GroupRectMeasure,
  ): FlowGroupRects | undefined {
    if (
      !(0, runtime.isFlowContainer)(frame.node) ||
      (frame.node as FlowContainerNode).children.some(
        (source) =>
          source.kind !== "spacer" && hasNodeTransform(source),
      )
    ) {
      return;
    }
    let value: (GroupRect | undefined)[] = (frame.node as FlowContainerNode).children.map(
      (source, options) =>
        source.kind === "spacer"
          ? {
              x: 0,
              y: 0,
              w: 0,
              h: 0,
            }
          : measure.rect((0, runtime.createNodeSelection)(frame.id, [options])),
    );
    if (value.some((input) => input === undefined)) {
      return;
    }
    let value2: FlowDragExtraction | null = (0, runtime.extractFlowDragSelection)(slide, {
      frameId: frame.id,
      children: value.map(
        (input) => ({
          rect: input!,
        }),
      ),
      selectedChildren: [],
      deep: [],
    });
    if (value2 === null) {
      return;
    }
    let value3 = value2.newFrames.map(
      (input, options) =>
        input === null
          ? null
          : {
              ...normalizeNegativeFrameMargins(input, value[options]!),
              ...(frame.build !== undefined
                ? {
                    build: frame.build,
                  }
                : {}),
            },
    );
    return {
      slide: {
        ...slide,
        frames: slide.frames.flatMap(
          (input) =>
            input.id === frame.id
              ? value3.filter((input2) => input2 !== null)
              : [input],
        ),
      },
      minted: value3,
    };
  }
  function groupSelectedUnits(
    slide: Slide,
    selection: NodeSelection[],
    measure: GroupMeasure,
  ): GroupResult {
    let value: NodeSelection[] = (0, runtime.normalizedGroupSelection)(
      slide,
      selection,
    );
    if (value.length < 2) {
      return {
        refused: runtime.GROUP_REFUSAL_MESSAGES.few,
      };
    }
    let value2: Frame | undefined = (0, runtime.slidePrimaryLayoutFrame)(slide);
    for (let value7 of value) {
      let value8: SlideNode | undefined =
        (0, runtime.selectionNodePath)(value7).length > 0
          ? (0, runtime.nodeAtPath)(
              (0, runtime.frameById)(slide, value7.frameId)!.node,
              (0, runtime.selectionNodePath)(value7).slice(0, -1),
            )
          : undefined;
      if (value8 !== undefined && (0, runtime.isOverlayNode)(value8)) {
        return {
          refused: (0, runtime.isEmptyGroupBase)(value8)
            ? runtime.GROUP_REFUSAL_MESSAGES.inside
            : runtime.GROUP_REFUSAL_MESSAGES.labels,
        };
      }
    }
    let value3: NodeSelection = value[0]!,
      value4: NodePath = (0, runtime.selectionNodePath)(value3).slice(0, -1);
    if (
      (0, runtime.selectionNodePath)(value3).length > 0 &&
      value.every(
        (input) =>
          input.frameId === value3.frameId &&
          (0, runtime.selectionNodePath)(input).length === value4.length + 1 &&
          (0, runtime.nodePathsEqual)(
            (0, runtime.selectionNodePath)(input).slice(0, -1),
            value4,
          ),
      )
    ) {
      let value7: Frame = (0, runtime.frameById)(slide, value3.frameId)!,
        value8: SlideNode = (0, runtime.nodeAtPath)(value7.node, value4)!,
        value9: boolean = value7.id === value2?.id && value4.length === 0,
        value10: number[] = value.map(
          (input) =>
            (0, runtime.selectionNodePath)(input)[value4.length]!,
        ),
        value11: number = (0, runtime.isFlowContainer)(value8)
          ? (value8 as FlowContainerNode).children.filter(
              (source) => source.kind !== "spacer",
            ).length
          : 0,
        value12: boolean =
          value4.length === 0 &&
          [value7.x, value7.y].every(
            (input) =>
              input.anchor === "fill" && input.margin === 0,
          ) &&
          !(0, runtime.styleHasVisiblePaint)(value7.node.style);
      if (
        !value9 &&
        value12 &&
        (0, runtime.isFlowContainer)(value8) &&
        value10.length === value11
      ) {
        return {
          refused: runtime.GROUP_REFUSAL_MESSAGES.stuck,
        };
      }
      if (
        !value9 &&
        (0, runtime.isFlowContainer)(value8) &&
        value10.length === value11
      ) {
        let value14: NodePath = value4.slice(0, -1),
          value15: SlideNode | undefined =
            value4.length > 0 && value4[value4.length - 1] === 0
              ? (0, runtime.nodeAtPath)(value7.node, value14)
              : undefined,
          value16: NodePath =
            value15 !== undefined && (0, runtime.isOverlayNode)(value15)
              ? value14
              : value4,
          value17: SlideNode | undefined = (0, runtime.nodeAtPath)(value7.node, value16);
        if (
          value17 !== undefined &&
          "group" in value17 &&
          value17.group === true
        ) {
          return {
            refused: runtime.GROUP_REFUSAL_MESSAGES.already,
          };
        }
        return {
          slide: {
            ...slide,
            frames: slide.frames.map(
              (input) =>
                input.id === value7.id
                  ? {
                      ...input,
                      node: (0, runtime.updateNodeAtPath)(
                        input.node,
                        value16,
                        (input2: SlideNode): SlideNode => ({
                          ...input2,
                          group: true,
                        }) as SlideNode,
                      ),
                    }
                  : input,
            ),
          },
          selection: [(0, runtime.createNodeSelection)(value7.id, value16)],
        };
      }
      let value13: boolean =
        value10.every(
          (input, options) =>
            options === 0 || input === value10[options - 1]! + 1,
        ) &&
        value8.kind === "stack" &&
        (0, runtime.stackMainAxisSizeIsKnown)(value7, value4, measure) &&
        !measure.shrunk((0, runtime.createNodeSelection)(value7.id, value4));
      if (
        value8.kind === "stack" &&
        (0, runtime.canGroupStackChildren)(
          value8,
          value10[0],
          value10.length,
          value13,
        )
      ) {
        let value14: SlideNode[] = value8.children.slice(
            value10[0],
            value10[0]! + value10.length,
          ),
          value15: NodePlacement | undefined = (0, runtime.groupedChildrenPlacement)(
            value8,
            value14,
          ),
          state: StackNode = {
            kind: "stack",
            dir: value8.dir,
            align: value8.align,
            gap: value8.gap,
            group: true,
            children: value14,
            ...(value15 !== undefined
              ? {
                  place: value15,
                }
              : {}),
          },
          value16: SlideNode = (0, runtime.updateNodeAtPath)(
            value7.node,
            value4,
            (source: SlideNode): SlideNode =>
              source.kind === "stack"
                ? {
                    ...source,
                    children: [
                      ...source.children.slice(0, value10[0]),
                      state,
                      ...source.children.slice(value10[0]! + value10.length),
                    ],
                  }
                : source,
          );
        if (!(0, runtime.nodeTreeWithinDepthLimit)(value16, 0)) {
          return {
            refused: runtime.GROUP_REFUSAL_MESSAGES.deep,
          };
        }
        return {
          slide: {
            ...slide,
            frames: slide.frames.map(
              (input) =>
                input.id === value7.id
                  ? {
                      ...input,
                      node: value16,
                    }
                  : input,
            ),
          },
          selection: [
            (0, runtime.createNodeSelection)(value7.id, [
              ...value4,
              value10[0]!,
            ]),
          ],
        };
      }
      if (!value9) {
        return {
          refused: runtime.GROUP_REFUSAL_MESSAGES.where,
        };
      }
    }
    let value5 = value.filter(
      (input) => input.frameId === value2?.id,
    );
    if (
      value5.some(
        (input) =>
          (0, runtime.selectionNodePath)(input).length !== 1,
      ) ||
      value.some(
        (input) =>
          input.frameId !== value2?.id &&
          (0, runtime.selectionNodePath)(input).length > 0,
      )
    ) {
      return {
        refused: runtime.GROUP_REFUSAL_MESSAGES.apart,
      };
    }
    if (value5.length === 0 || value2 === undefined) {
      return groupSelectedFramesAsOverlay(
        slide,
        new Set(value.map((input) => input.frameId)),
        measure,
      );
    }
    if (
      !runtime.GROUP_MIXED_FRAME_STACK_CHILDREN_ENABLED ||
      (0, runtime.styleHasVisiblePaint)(value2.node.style) ||
      (0, runtime.nodeTransform)(value2.node) !== undefined ||
      !(0, runtime.stackChildrenFitMeasuredBounds)(value2, [], measure) ||
      measure.shrunk({
        frameId: value2.id,
      })
    ) {
      return {
        refused: runtime.GROUP_REFUSAL_MESSAGES.stuck,
      };
    }
    let value6: FlowGroupRects | undefined = measureFlowGroupChildRects(slide, value2, measure);
    if (value6 === undefined) {
      return {
        refused: runtime.GROUP_REFUSAL_MESSAGES.stuck,
      };
    }
    if (value6.slide.frames.length > runtime.maxSlideFrames) {
      return {
        refused: runtime.GROUP_REFUSAL_MESSAGES.full,
      };
    }
    let entries: Map<string, GroupRect | undefined> = new Map();
    for (let value7 of value) {
      let value8: Frame | null | undefined =
        value7.frameId === value2.id
          ? value6.minted[(0, runtime.selectionNodePath)(value7)[0]!]
          : undefined;
      if (
        value7.frameId === value2.id &&
        (value8 === null || value8 === undefined)
      ) {
        return {
          refused: runtime.GROUP_REFUSAL_MESSAGES.stuck,
        };
      }
      entries.set(
        value8?.id ?? value7.frameId,
        value8 ? measure.rect(value7) : undefined,
      );
    }
    return groupSelectedFramesAsOverlay(value6.slide, new Set(entries.keys()), {
      ...measure,
      rect: (input) =>
        (0, runtime.selectionNodePath)(input).length === 0 &&
        entries.get(input.frameId) !== undefined
          ? entries.get(input.frameId)
          : measure.rect(input),
    });
  }
  function inspectUngroupTarget(
    slide: Slide,
    unit: NodeSelection,
    measure: GroupMeasure,
    singleSelection: boolean,
  ): UngroupTarget {
    let frame: Frame = (0, runtime.frameById)(slide, unit.frameId)!,
      path: NodePath = (0, runtime.selectionNodePath)(unit),
      node: SlideNode = (0, runtime.nodeAtPath)(frame.node, path)!;
    if ((0, runtime.isEmptyGroupBase)(node) && path.length === 0) {
      return {
        kind: "free",
      };
    }
    if ((0, runtime.isOverlayNode)(node) && (node as OverlayNode).group !== true) {
      return {
        refused: runtime.GROUP_REFUSAL_MESSAGES.labelsStay,
      };
    }
    if (
      !(0, runtime.isFlowContainer)(node) &&
      !(0, runtime.isOverlayNode)(node)
    ) {
      return {
        refused: runtime.GROUP_REFUSAL_MESSAGES.nothing,
      };
    }
    let value: boolean = (0, runtime.styleHasVisiblePaint)(node.style);
    if (path.length === 0) {
      if (
        (0, runtime.isFlowContainer)(node) &&
        !value &&
        (0, runtime.nodeTransform)(node) === undefined &&
        !measure.shrunk(unit) &&
        !(node as FlowContainerNode).children.some(
          (source) =>
            source.kind !== "spacer" && hasNodeTransform(source),
        ) &&
        frame.id !== (0, runtime.slidePrimaryLayoutFrame)(slide)?.id &&
        ((node as FlowContainerNode).group === true ||
          (runtime.UNGROUP_UNMARKED_STACK_ENABLED && singleSelection))
      ) {
        return {
          kind: "dissolve",
        };
      }
      if ((node as FlowContainerNode | OverlayNode).group === true) {
        return {
          kind: "unmark",
        };
      } else {
        return {
          refused: value
            ? runtime.GROUP_REFUSAL_MESSAGES.card
            : runtime.GROUP_REFUSAL_MESSAGES.nothing,
        };
      }
    }
    if ((node as FlowContainerNode | OverlayNode).group !== true) {
      return {
        refused: value
          ? runtime.GROUP_REFUSAL_MESSAGES.card
          : runtime.GROUP_REFUSAL_MESSAGES.nothing,
      };
    }
    let value2: NodePath = path.slice(0, -1),
      value3: SlideNode = (0, runtime.nodeAtPath)(frame.node, value2)!;
    if (
      !(0, runtime.canFlattenNestedStackGroup)(node, value3) ||
      value3.kind !== "stack"
    ) {
      return {
        kind: "unmark",
      };
    }
    let value4: number = path[path.length - 1]!,
      state: StackNode = {
        ...value3,
        children: [
          ...value3.children.slice(0, value4),
          ...(node as FlowContainerNode).children,
          ...value3.children.slice(value4 + 1),
        ],
      },
      value5: boolean =
        (0, runtime.structurallyEqualGroupValues)(
          node.place,
          (0, runtime.groupedChildrenPlacement)(value3, (node as FlowContainerNode).children),
        ) &&
        value3.children.length - 1 + (node as FlowContainerNode).children.length <=
          runtime.maxSlideFrames &&
        (0, runtime.stackMainAxisSizeIsKnown)(frame, value2, measure) &&
        !measure.shrunk((0, runtime.createNodeSelection)(frame.id, value2));
    return {
      kind: (0, runtime.canGroupStackChildren)(
        state,
        value4,
        (node as FlowContainerNode).children.length,
        value5,
      )
        ? "unwrap"
        : "unmark",
    };
  }
  function removeGroupMarker(node: SlideNode): SlideNode {
    let { group: group, ...ungroupedNode }: SlideNode & { group?: true } = node;
    return ungroupedNode;
  }
  function ungroupSelectedUnits(
    slide: Slide,
    selection: NodeSelection[],
    measure: GroupMeasure,
  ): GroupResult {
    let selectedUnits: NodeSelection[] = (0, runtime.normalizedGroupSelection)(
      slide,
      selection,
    );
    if (selectedUnits.length === 0) {
      return {
        refused: runtime.GROUP_REFUSAL_MESSAGES.nothing,
      };
    }
    let reversedUnits = [...selectedUnits].reverse(),
      results = reversedUnits.map(
        (input) =>
          inspectUngroupTarget(
            slide,
            input,
            measure,
            selectedUnits.length === 1,
          ),
      ),
      refusal: GroupRefusal | undefined = results.find(
        (input) => "refused" in input,
      );
    if (refusal !== undefined) {
      return refusal;
    }
    let value = results.filter(
        (input) => "kind" in input,
      ),
      value2: Slide = slide,
      items: NodeSelection[] = [];
    for (let [value3, value4] of reversedUnits.entries()) {
      let kind: UngroupKind = value[value3]!.kind,
        value5: Frame = (0, runtime.frameById)(value2, value4.frameId)!,
        value6: NodePath = (0, runtime.selectionNodePath)(value4);
      if (kind === "free") {
        let node: SlideNode = value5.node,
          value7: Frame[] = (node as OverlayNode).layers.flatMap(
            (input, options) =>
              (0, runtime.resizeGroupedFrame)(
                value5,
                input,
                measure.rect(
                  (0, runtime.createNodeSelection)(value5.id, [options + 1]),
                ),
              ) ?? [],
          );
        if (value7.length < (node as OverlayNode).layers.length) {
          return {
            refused: runtime.GROUP_REFUSAL_MESSAGES.later,
          };
        }
        value2 = {
          ...value2,
          frames: value2.frames.flatMap(
            (input) =>
              input.id === value5.id ? value7 : [input],
          ),
        };
        items = [
          ...value7.map(
            (input) => ({
              frameId: input.id,
            }),
          ),
          ...items,
        ];
      } else if (kind === "dissolve") {
        let value7: FlowGroupRects | undefined = measureFlowGroupChildRects(
          value2,
          value5,
          measure,
        );
        if (value7 === undefined) {
          return {
            refused: runtime.GROUP_REFUSAL_MESSAGES.later,
          };
        }
        value2 = value7.slide;
        items = [
          ...value7.minted.flatMap(
            (input) =>
              input !== null
                ? [
                    {
                      frameId: input.id,
                    },
                  ]
                : [],
          ),
          ...items,
        ];
      } else if (kind === "unmark") {
        value2 = {
          ...value2,
          frames: value2.frames.map(
            (input) =>
              input.id === value5.id
                ? {
                    ...input,
                    node: (0, runtime.updateNodeAtPath)(
                      input.node,
                      value6,
                      removeGroupMarker,
                    ),
                  }
                : input,
          ),
        };
        items = [value4, ...items];
      } else {
        let value7: NodePath = value6.slice(0, -1),
          value8: number = value6[value6.length - 1]!,
          length: number = ((0, runtime.nodeAtPath)(value5.node, value6) as FlowContainerNode)
            .children.length;
        value2 = {
          ...value2,
          frames: value2.frames.map(
            (input) =>
              input.id === value5.id
                ? {
                    ...input,
                    node: (0, runtime.updateNodeAtPath)(
                      input.node,
                      value7,
                      (source: SlideNode): SlideNode =>
                        source.kind === "stack"
                          ? {
                              ...source,
                              children: [
                                ...source.children.slice(0, value8),
                                ...(source.children[value8] as FlowContainerNode).children,
                                ...source.children.slice(value8 + 1),
                              ],
                            }
                          : source,
                    ),
                  }
                : input,
          ),
        };
        items = items.map((input): NodeSelection => {
          let value9: NodePath = (0, runtime.selectionNodePath)(input);
          if (
            input.frameId === value5.id &&
            value9.length > value7.length &&
            (0, runtime.nodePathsEqual)(
              value9.slice(0, value7.length),
              value7,
            ) &&
            (0, runtime.compareNodePaths)(value9, value6) > 0
          ) {
            return (0, runtime.createNodeSelection)(input.frameId, [
              ...value7,
              value9[value7.length]! + length - 1,
              ...value9.slice(value7.length + 1),
            ]);
          } else {
            return input;
          }
        });
        items = [
          ...Array.from<unknown, NodeSelection>(
            {
              length: length,
            },
            (input, options) =>
              (0, runtime.createNodeSelection)(value5.id, [
                ...value7,
                value8 + options,
              ]),
          ),
          ...items,
        ];
      }
    }
    if (value2.frames.length > runtime.maxSlideFrames) {
      return {
        refused: runtime.GROUP_REFUSAL_MESSAGES.full,
      };
    }
    return {
      slide: value2,
      selection: items,
      ...(value.every((source) => source.kind === "unmark")
        ? {
            note: runtime.GROUP_REFUSAL_MESSAGES.unmarked,
          }
        : {}),
    };
  }
  bindRuntimeValue(
    runtime,
    "measureOverlayGroupLayout",
    () => measureOverlayGroupLayout,
  );
  bindRuntimeValue(
    runtime,
    "rewriteNestedOverlayPlacements",
    () => rewriteNestedOverlayPlacements,
  );
  bindRuntimeValue(
    runtime,
    "groupSelectedFramesAsOverlay",
    () => groupSelectedFramesAsOverlay,
  );
  bindRuntimeValue(runtime, "hasNodeTransform", () => hasNodeTransform);
  bindRuntimeValue(
    runtime,
    "normalizeNegativeFrameMargins",
    () => normalizeNegativeFrameMargins,
  );
  bindRuntimeValue(
    runtime,
    "measureFlowGroupChildRects",
    () => measureFlowGroupChildRects,
  );
  bindRuntimeValue(runtime, "groupSelectedUnits", () => groupSelectedUnits);
  bindRuntimeValue(runtime, "inspectUngroupTarget", () => inspectUngroupTarget);
  bindRuntimeValue(runtime, "removeGroupMarker", () => removeGroupMarker);
  bindRuntimeValue(runtime, "ungroupSelectedUnits", () => ungroupSelectedUnits);
  return () => {};
}
