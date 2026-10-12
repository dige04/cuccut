/** Restored application module; prepare first, initialize in original order. */
import type {
  ChangeEvent,
  KeyboardEvent as ReactKeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactElement,
} from "react";
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type JsxNamespace,
} from "../bindings";
import type {
  ArrowHeadKind,
  Axis,
  BorderStyleValue,
  ConnectorCorner,
  ConnectorRouting,
  ContainerAlignment,
  FlowContainerNode,
  FontFace,
  Frame,
  GradientValue,
  GridTrack,
  ImageNode,
  NodePlacement,
  Slide,
  SlideNode,
  SlideTransition,
  StackNode,
  StyleBag,
  StylePropertyName,
  TableNode,
  TextFill,
  TextAlignment,
  TextFit,
  TextNode,
  TextRole,
  TextTransformValue,
  ThemeFonts,
} from "../deck-contracts";

import type {
  ChildSizeModeName,
  SizeDimension,
} from "../editor/child-size-modes";
import type { SelectionContrast } from "../editor/contrast-backgrounds";
import type { NodePath, NodeSelection } from "../layout/selection-groups";
import type {
  ConnectorArrowHeads,
  ConnectorHeadFields,
  NodeStyleKind,
} from "../model/deck";

import type {
  BorderSideName,
  BorderWidths,
  SlideNodeUpdate,
} from "../model/editing";
import type { TypographyStyle } from "../model/typography";

import type { DeckColorChoices, DeckColorRow } from "../rendering/theme";
import type { InspectorIcon } from "./inspector-icons";
import type { SegmentedPropertyOption } from "./segmented-property";

import type { SideChange, SideIndex } from "./sides-property";
import type { StylePatch } from "./style-inspector";

/** A value/label choice of a select or segmented property row. */
interface PropertyChoice<V extends string = string> {
  value: V;
  label: string;
}
/** An update that only applies to text nodes. */
type TextNodeUpdate = (node: TextNode) => SlideNode;
/** Props of `SelectionInspector`. */
export interface SelectionInspectorProps {
  slide: Slide;
  selection: NodeSelection[];
  /** Commits a slide; `face` is a font face the edit starts using. */
  onChange: (slide: Slide, face?: FontFace) => void;
  onLiveChange: (slide: Slide) => void;
  onGestureEnd: (slide: Slide) => void;
  /** Table cells in the whole deck. */
  deckCellCount?: number;
  typeStyles?: TypographyStyle[];
  deckTypeStyles?: TypographyStyle[];
  faces?: readonly FontFace[] | null;
  /** The deck cannot carry another font face. */
  facesFull?: boolean;
  fonts?: ThemeFonts;
  /** Measured size of the selected unit on the canvas. */
  measure?: (unit: NodeSelection) => UnitSize | undefined;
  designColors?: string[];
  slideColors?: string[];
  assets?: ReadonlyMap<string, string>;
  onReplaceImage?: (frameId: string, path: NodePath, file: File) => void;
  onRemoveImages?: (items: { frameId: string; path: NodePath }[]) => void;
  pickImage?: (file: File) => Promise<string | undefined>;
  editsAreUndoSteps?: boolean;
  onSelectUnit?: (unit: NodeSelection) => void;
}
/** Measured width and height of a selected unit. */
interface UnitSize {
  w?: number;
  h?: number;
}
/** The frame that lays out the selected node, with that container as its node. */
type FlowFrame = Frame & { node: FlowContainerNode };
/** Style property names of the four sides or corners, indexed by `SideIndex`. */
type SideKeys = readonly [string, string, string, string];
/** Applies a live (uncommitted) node update to every selected node. */
type LiveUpdate = (update: SlideNodeUpdate) => void;
/** Applies a node update to every selected node. */
type UpdateNodes = (update: SlideNodeUpdate, face?: FontFace) => void;
/** Updates a node, also given the node as it was before the edit started. */
type UpdateWithOriginal = (node: SlideNode, original: SlideNode) => SlideNode;
/** Updates a table node. */
type TableUpdate = (table: TableNode) => TableNode;
/** Style property of one corner radius. */
type RadiusKey =
  | "borderTopLeftRadius"
  | "borderTopRightRadius"
  | "borderBottomRightRadius"
  | "borderBottomLeftRadius";
/** A border style option; its glyph may be a custom inspector icon. */
type BorderStyleOption = Omit<SegmentedPropertyOption, "glyph"> & {
  glyph?: InspectorIcon;
};
/** Size limit placement fields of a child of a stack or grid. */
type SizeLimitKey = "minW" | "maxW" | "minH" | "maxH";
/** A size limit the Size section can add. */
interface SizeLimitItem {
  key: SizeLimitKey;
  label: string;
  /** The limit is set on the node. */
  authored: boolean;
}
/** An entry of a property section's "add" menu. */
interface AddItem {
  label: string;
  onSelect: () => void;
}
/** The "Size" section content of a child of a stack or grid. */
interface SizeSection {
  addItems: AddItem[];
  rows: ReactElement;
}
/** Numeric typography properties edited with a number row. */
type NumericTypographyKey = "fontSize" | "lineHeight" | "letterSpacing";
/** Border width properties in `SideIndex` order. */

type BorderSideKeys = readonly [
  BorderSideName,
  BorderSideName,
  BorderSideName,
  BorderSideName,
];
/** Corner radius properties in `SideIndex` order. */
type RadiusKeys = readonly [RadiusKey, RadiusKey, RadiusKey, RadiusKey];
/** A control a property row can focus; native inputs and buttons can be disabled. */
type FocusableControl = HTMLElement & { disabled?: boolean };
/** True when the value `read` extracts differs across the selected nodes. */
type MixedOf = (read: (node: SlideNode) => unknown) => boolean;
/** Props of `GridTracksPropertyRows`. */
interface GridTracksPropertyRowsProps {
  label: string;
  tracks: GridTrack[];
  onChange: (tracks: GridTrack[]) => void;
}
/** Props of `VideoProgressPropertyRow`. */
interface VideoProgressPropertyRowProps {
  /** Clip registry key of the video. */
  at: string;
}
/** Which kind of video a media row edits; `false` for a plain image. */
type MediaRowVideo = false | "clip" | "link";
/** Props of `MediaAssetPropertyRow`. */
interface MediaAssetPropertyRowProps {
  src?: string;
  name?: string;
  mixed?: boolean;
  empty?: boolean;
  video: MediaRowVideo;
  onPick?: (file: File) => void;
  onRemove?: () => void;
}
/** Chip shown instead of a swatch when text is filled with a gradient or an image. */
interface FillChip {
  css: string;
  text: string;
}
/** Props of `FillPropertyRow`. */
interface FillPropertyRowProps {
  label: string;
  value?: string;
  effective?: string;
  swatches?: DeckColorRow[];
  clearLabel?: string;
  onPick: (color: string | undefined) => void;
  onLivePick: (color: string) => void;
  onPickEnd: () => void;
  trailing?: ReactElement;
  mixed?: boolean;
  onReset?: () => void;
  chip?: FillChip;
  headerTabs?: FillEditorKind;
  panel?: ReactElement | null;
  allowNone?: boolean;
  isNone?: boolean;
  noneDisabledReason?: string;
  onNone?: () => void;
  readsContrast?: boolean;
  contrast?: SelectionContrast;
  editsAreUndoSteps?: boolean;
}
/** Fill kinds a text fill editor offers. */
type FillKindValue = "color" | "gradient" | "image";
/** The kind switch a fill editor puts into the colour popover header. */
interface FillEditorKind {
  value: FillKindValue;
  label: string;
  options: PropertyChoice<FillKindValue>[];
  onChange: (kind: string | undefined) => void;
}
/** What `useFillEditor` needs to edit the fill of the selected text. */
interface FillEditorOptions {
  node: TextNode;
  slideBg: string;
  swatches?: DeckColorRow[];
  fillMixed?: boolean;
  updateNodes: UpdateNodes;
  liveUpdateNodes: UpdateNodes;
  end: () => void;
  pickImage?: (file: File) => Promise<string | undefined>;
  contrast?: SelectionContrast;
}
/** The kind switch and fill panel of a text fill editor; empty while the fill is mixed. */
interface FillEditorResult {
  kind?: FillEditorKind;
  face?: ReactElement | null;
}
/** Props of `TextFillPropertyRow`. */
interface TextFillPropertyRowProps extends FillEditorOptions {
  colorMixed?: boolean;
  editsAreUndoSteps?: boolean;
}
/** Props of `ConnectorEndsPropertyRows`. */
interface ConnectorEndsPropertyRowsProps {
  node: ConnectorHeadFields;
  selKey: string;
  mixedOf: MixedOf;
  updateNodes: UpdateNodes;
}
/** Props of `TextResizePropertyRow`. */
interface TextResizePropertyRowProps {
  nodes: (SlideNode | undefined)[];
  updateNodes: UpdateNodes;
}

declare module "../bindings" {
  interface RuntimeBindings {
    jsxq_: JsxNamespace;
    TABLE_HEIGHT_REASON: string;
    TEXT_SHADOW_FILL_REASON: string;
    LINE_DASH_REASON: string;
    ZERO_SIDE_PLACEHOLDERS: string[];
    SIDE_INDEXES: SideIndex[];
    EMPTY_SIDE_VALUES: SideChange[];
    anchorSizePatch: (size: number | undefined) => (axis: Axis) => Axis;
    STACK_CHILD_ALIGN_OPTIONS: PropertyChoice<"auto" | ContainerAlignment>[];
    GRID_CHILD_ALIGN_OPTIONS: PropertyChoice<"auto" | "start" | "center" | "end" | "stretch">[];
    PROPERTY_ROW_FOCUS_SELECTOR: string;
    CONNECTOR_END_CHOICES: { which: keyof ConnectorArrowHeads; label: string }[];
    CONNECTOR_ARROW_OPTIONS: PropertyChoice<ArrowHeadKind>[];
    CONNECTOR_ROUTE_OPTIONS: PropertyChoice<ConnectorRouting>[];
    CONNECTOR_STROKE_OPTIONS: PropertyChoice<"solid" | "dashed">[];
    CONNECTOR_DIRECTION_OPTIONS: PropertyChoice<ConnectorCorner>[];
    SLIDE_TRANSITION_OPTIONS: { value: string; label: string | undefined }[];
    isNonConnectorShape: (node: SlideNode) => boolean;
    isDecorativePolygonShape: (node: SlideNode) => boolean;
    normalizedHexRgba: (hex: string) => string;
    isDefaultShapeFill: (color: string | undefined) => boolean;
    isTransparentStyleColor: (color: string) => boolean;
    GridTracksPropertyRows: (props: GridTracksPropertyRowsProps) => ReactElement;
    videoPlayerAt: (at: SlideNode) => NodeStyleKind | undefined;
    imagePropertyLabel: (node: ImageNode, source: string) => string;
    VideoProgressPropertyRow: (
      props: VideoProgressPropertyRowProps,
    ) => ReactElement;
    focusPropertyRowControl: (event: ReactMouseEvent<HTMLElement>) => void;
    adjacentPropertyRowControl: (
      element: HTMLElement,
    ) => FocusableControl | undefined;
    suppressRepeatedKeyAfterRemoval: () => void;
    focusAfterPropertyRemoval: (element: HTMLElement) => void;
    propertyRemovalMouseHandler: (event: ReactMouseEvent<HTMLElement>) => void;
    propertyRemovalKeyHandler: (event: ReactKeyboardEvent<HTMLElement>) => void;
    MediaAssetPropertyRow: (props: MediaAssetPropertyRowProps) => ReactElement;
    FillPropertyRow: (props: FillPropertyRowProps) => ReactElement;
    useFillEditor: (options?: FillEditorOptions) => FillEditorResult;
    TextFillPropertyRow: (props: TextFillPropertyRowProps) => ReactElement;
    defaultFillGradient: (color?: string, slideBg?: string) => GradientValue;
    mixHexColors: (from: string, to2: string, amount: number) => string;
    ConnectorEndsPropertyRows: (
      props: ConnectorEndsPropertyRowsProps,
    ) => ReactElement;
    TextResizePropertyRow: (
      props: TextResizePropertyRowProps,
    ) => ReactElement | null;
    SelectionInspector: (props: SelectionInspectorProps) => ReactElement;
  }
}


export function installUiSelectionInspector(
  runtime: RuntimeBindings,
): () => void {
  var jsxq_: JsxNamespace;
  var TABLE_HEIGHT_REASON: string;
  var TEXT_SHADOW_FILL_REASON: string;
  var LINE_DASH_REASON: string;
  var ZERO_SIDE_PLACEHOLDERS: string[];
  var SIDE_INDEXES: SideIndex[];
  var EMPTY_SIDE_VALUES: SideChange[];
  var anchorSizePatch: (size: number | undefined) => (axis: Axis) => Axis;
  var STACK_CHILD_ALIGN_OPTIONS: PropertyChoice<"auto" | ContainerAlignment>[];
  var GRID_CHILD_ALIGN_OPTIONS: PropertyChoice<"auto" | "start" | "center" | "end" | "stretch">[];
  var PROPERTY_ROW_FOCUS_SELECTOR: string;
  var CONNECTOR_END_CHOICES: { which: keyof ConnectorArrowHeads; label: string }[];
  var CONNECTOR_ARROW_OPTIONS: PropertyChoice<ArrowHeadKind>[];
  var CONNECTOR_ROUTE_OPTIONS: PropertyChoice<ConnectorRouting>[];
  var CONNECTOR_STROKE_OPTIONS: PropertyChoice<"solid" | "dashed">[];
  var CONNECTOR_DIRECTION_OPTIONS: PropertyChoice<ConnectorCorner>[];
  var SLIDE_TRANSITION_OPTIONS: { value: string; label: string | undefined }[];
  var isNonConnectorShape: (node: SlideNode) => boolean;
  var isDecorativePolygonShape: (node: SlideNode) => boolean;
  var normalizedHexRgba: (hex: string) => string;
  var isDefaultShapeFill: (color: string | undefined) => boolean;
  function isTransparentStyleColor(color: string): boolean {
    let value = color.trim().toLowerCase();
    return (
      value === "transparent" ||
      /^(?:rgb|hsl)a?\([^,)]+,[^,)]+,[^,)]+,\s*(?:0+(?:\.0+)?|\.0+)%?\s*\)$/.test(
        value,
      ) ||
      /^(?:rgb|hsl)a?\([^/)]+\/\s*(?:0+(?:\.0+)?|\.0+)%?\s*\)$/.test(value) ||
      /^#(?:[0-9a-f]{3}0|[0-9a-f]{6}00)$/.test(value)
    );
  }
  function GridTracksPropertyRows({
    label: label,
    tracks: tracks,
    onChange: onChange,
  }: GridTracksPropertyRowsProps): ReactElement {
    let callback = (input: GridTrack): GridTrack => {
        if (input === "auto") {
          return {
            fr: 1,
          };
        }
        if ("fr" in input) {
          return {
            px: 240,
          };
        }
        return "auto";
      },
      callback2 = (input: GridTrack): string => {
        if (input === "auto") {
          return "auto";
        }
        if ("fr" in input) {
          return String(input.fr) + "fr";
        }
        return String(input.px) + "px";
      };
    return jsxq_.jsx(runtime.PropertyRow, {
      label: label,
      children: jsxq_.jsxs("span", {
        className: "flex min-w-0 flex-wrap items-center gap-1 py-0.5",
        children: [
          tracks.map(
            (input, options) =>
              jsxq_.jsx(
                runtime.Button,
                {
                  variant: "secondary",
                  title:
                    "Click to cycle this track: flexible share, fixed 240px, content-sized",
                  onClick: () =>
                    onChange(
                      tracks.map((input2, options2) =>
                        options2 === options ? callback(input2) : input2,
                      ),
                    ),
                  children: callback2(input),
                },
                options,
              ),
          ),
          jsxq_.jsx(runtime.Button, {
            variant: "ghost",
            iconOnly: true,
            icon: "Add",
            "aria-label": "Add a flexible column",
            disabled: tracks.length >= runtime.maxGridTracks,
            onClick: () =>
              onChange([
                ...tracks,
                {
                  fr: 1,
                },
              ]),
          }),
          jsxq_.jsx(runtime.Button, {
            variant: "ghost",
            iconOnly: true,
            icon: "Minus",
            "aria-label": "Remove the last column",
            disabled: tracks.length <= 1,
            onClick: () => onChange(tracks.slice(0, -1)),
          }),
        ],
      }),
    });
  }
  function videoPlayerAt(at: SlideNode): NodeStyleKind | undefined {
    return (0, runtime.nodeStyleKind)(at);
  }
  function imagePropertyLabel(node: ImageNode, source: string): string {
    let value = node.alt.trim();
    if ((0, runtime.looksLikeMediaFilename)(value)) {
      return value;
    }
    let value2 = /^data:image\/([a-z0-9.+-]+)[;,]/i.exec(source)?.[1];
    if (node.video !== undefined) {
      return "Video";
    }
    if (node.videoLink !== undefined) {
      return runtime.videoProviderLabels[node.videoLink.provider] + " video";
    }
    if (value2 !== undefined) {
      return (
        (value2 === "svg+xml"
          ? "SVG"
          : value2 === "jpeg"
            ? "JPEG"
            : value2.toUpperCase()) + " image"
      );
    } else {
      return "Image";
    }
  }
  function VideoProgressPropertyRow({
    at: at,
  }: VideoProgressPropertyRowProps): ReactElement {
    let value = (0, runtime.useClipController)(at),
      value2 = (0, runtime.useClipPlaybackState)(value) ?? {
        paused: true,
        currentTime: 0,
        duration: 0,
        ready: false,
        seekable: false,
        failed: false,
      },
      value3 = (0, runtime.videoPlaybackDisabledReason)(
        value !== undefined,
        (0, runtime.useClipIsLive)(at) || value2.failed,
        value2.ready,
      ),
      value4 =
        value3 ??
        (value2.seekable
          ? undefined
          : "This video doesn’t say how long it is (a screen recording often doesn’t), so it can be played and paused but not scrubbed."),
      [value5, value6] = runtime.reactw8.useState<number | undefined>(undefined);
    runtime.reactw8.useEffect(
      (): void => value6(undefined),
      [value2.currentTime, value2.paused],
    );
    let callback = (input: number): void => {
      value6(input);
      value?.seek(input);
    };
    return jsxq_.jsx(runtime.SliderPropertyRow, {
      label: "Time",
      value: Math.round((value5 ?? value2.currentTime) * 10) / 10,
      min: 0,
      max: Math.max(0.1, Math.round(value2.duration * 10) / 10),
      step: 0.1,
      unit: "s",
      disabled: value4 !== undefined,
      title:
        value4 ??
        (0, runtime.formatPlaybackTime)(value2.currentTime) +
          " / " +
          (0, runtime.formatPlaybackTime)(value2.duration),
      onLive: callback,
      onValue: callback,
      adornment: jsxq_.jsx(runtime.Button, {
        variant: "ghost",
        size: "xxs",
        "data-testid": "sl-video-playpause",
        "aria-label": value2.paused
          ? runtime.playbackActionLabels.play
          : runtime.playbackActionLabels.pause,
        disabled: value3 !== undefined,
        title: value3,
        onClick: (): void => value?.toggle(),
        children: jsxq_.jsx(runtime.Icon, {
          name: value2.paused
            ? runtime.playbackActionIcons.play
            : runtime.playbackActionIcons.pause,
          size: "xs",
        }),
      }),
    });
  }
  function focusPropertyRowControl(event: ReactMouseEvent<HTMLElement>): void {
    event.currentTarget
      .closest("[data-property-row]")
      ?.querySelector<HTMLElement>(
        'input, button:not([data-kit="row-reset"]), [tabindex="0"]',
      )
      ?.focus();
    (0, runtime.suppressEnterClicksUntilRelease)();
  }
  function adjacentPropertyRowControl(
    element: HTMLElement,
  ): FocusableControl | undefined {
    let callback = (input: Element): FocusableControl | undefined => {
        let value3 = [
          ...input.querySelectorAll<FocusableControl>(
            PROPERTY_ROW_FOCUS_SELECTOR,
          ),
        ].filter((input2) => !input2.disabled);
        return (
          value3.find((input2) => input2.tagName === "BUTTON") ?? value3[0]
        );
      },
      items: Element[] = [];
    for (
      let parentElement = element.parentElement;
      parentElement !== null && items.length === 0;
      parentElement = parentElement.parentElement
    )
      items = [...parentElement.querySelectorAll("[data-property-row]")].filter(
        (input) =>
          !element.contains(input) &&
          !input.contains(element) &&
          callback(input) !== undefined,
      );
    let value = items.filter(
        (input) =>
          (element.compareDocumentPosition(input) &
            element.DOCUMENT_POSITION_PRECEDING) !==
          0,
      ),
      value2 = value[value.length - 1] ?? items[0];
    if (value2 === undefined) {
      return undefined;
    } else {
      return callback(value2);
    }
  }
  function suppressRepeatedKeyAfterRemoval(): void {
    let callback = (event: KeyboardEvent): void => {
      if (event.repeat) {
        event.preventDefault();
        event.stopPropagation();
      } else {
        window.removeEventListener("keydown", callback, true);
      }
    };
    window.addEventListener("keydown", callback, true);
  }
  function focusAfterPropertyRemoval(element: HTMLElement): void {
    let value = adjacentPropertyRowControl(element);
    requestAnimationFrame((): void => {
      if (
        (element.isConnected && element.childElementCount > 0) ||
        value === undefined
      ) {
        return;
      }
      value.focus();
      suppressRepeatedKeyAfterRemoval();
    });
  }
  function propertyRemovalMouseHandler(event: ReactMouseEvent<HTMLElement>): void {
    if (
      !(event.target as Element).matches('input[type="radio"]') &&
      (0, runtime.isKeyboardOrPrimaryActivation)(event)
    ) {
      focusAfterPropertyRemoval(event.currentTarget);
    }
  }
  function propertyRemovalKeyHandler(event: ReactKeyboardEvent<HTMLElement>): void {
    let target = event.target as Element;

    if (
      (event.key.startsWith("Arrow") && target.matches('[role="radio"]')) ||
      (event.key === "Enter" && target.matches("input"))
    ) {
      focusAfterPropertyRemoval(event.currentTarget);
    }
  }
  function MediaAssetPropertyRow({
    src: src,
    name: name,
    mixed: mixed,
    empty: empty,
    video: video,
    onPick: onPick,
    onRemove: onRemove,
  }: MediaAssetPropertyRowProps): ReactElement {
    let ref = runtime.reactw8.useRef<HTMLInputElement>(null),
      callback = (): void => ref.current?.click(),
      value = video !== false ? "video" : "image",
      value2 =
        video === "link"
          ? src !== undefined
            ? "Replace the video’s picture…"
            : "Add a picture for the video…"
          : "Replace the " + value + "…",
      value3 = mixed
        ? "Select one image to replace it"
        : onPick === undefined
          ? "Replacing images isn’t available here"
          : undefined,
      value4 = mixed ? "Mixed" : empty ? "Add image…" : name;
    return jsxq_.jsxs(runtime.PropertyRow, {
      label: video !== false ? "Video" : "Image",
      trailing: empty
        ? jsxq_.jsx(runtime.Button, {
            variant: "ghost",
            iconOnly: true,
            icon: "Upload",
            "aria-label": "Upload image…",
            tooltip: "Upload image…",
            disabledReason: value3,
            disabled: value3 !== undefined,
            onClick: callback,
            className: "shrink-0",
          })
        : jsxq_.jsx("span", {
            className: "contents",
            onClickCapture: focusPropertyRowControl,
            children: jsxq_.jsx(runtime.RemovePropertyButton, {
              label: value,
              onClick: onRemove,
            }),
          }),
      onPress: (element: HTMLElement): void =>
        element.querySelector("button")?.focus(),
      children: [
        jsxq_.jsx(runtime.DisabledReasonTooltip, {
          reason: value3,
          wrapperClassName: "flex min-w-0 flex-1",
          children: jsxq_.jsx(runtime.FieldButton, {
            "data-testid": "sl-image-source",
            "aria-label":
              (video !== false ? "Video: " : "Image: ") +
              (empty ? "none" : value4),
            title: value3 === undefined && !empty ? value2 : undefined,
            className: "min-w-0",
            disabled: value3 !== undefined,
            onClick: callback,
            chip: empty
              ? undefined
              : jsxq_.jsx(runtime.PropertyColorPreview, {
                  children:
                    !mixed && src !== undefined
                      ? jsxq_.jsx("img", {
                          alt: "",
                          src: src,
                          draggable: false,
                          className:
                            "absolute inset-0 h-full w-full object-cover",
                        })
                      : null,
                }),
            muted: mixed || empty,
            children: value4,
          }),
        }),
        onPick !== undefined && !mixed
          ? jsxq_.jsx("input", {
              ref: ref,
              "data-testid": "sl-image-file",
              type: "file",
              accept:
                video === "clip"
                  ? "image/*," + runtime.videoFileAccept
                  : "image/*",
              className: "hidden",
              onChange: (input: ChangeEvent<HTMLInputElement>): void => {
                let value5 = input.currentTarget.files?.[0];
                input.currentTarget.value = "";
                if (value5) {
                  onPick(value5);
                }
              },
            })
          : null,
      ],
    });
  }
  function FillPropertyRow({
    label: label,
    value: value,
    effective: effective,
    swatches: swatches,
    clearLabel: clearLabel,
    onPick: onPick,
    onLivePick: onLivePick,
    onPickEnd: onPickEnd,
    trailing: trailing,
    mixed: mixed,
    onReset: onReset,
    chip: chip,
    headerTabs: headerTabs,
    panel: panel,
    allowNone: allowNone,
    isNone: isNone,
    noneDisabledReason: noneDisabledReason,
    onNone: onNone,
    readsContrast: readsContrast,
    contrast: contrast,
    editsAreUndoSteps: editsAreUndoSteps,
  }: FillPropertyRowProps): ReactElement {
    let value2 =
        (value !== undefined
          ? (0, runtime.resolveSlideColor)(value)
          : undefined) ?? effective,
      value3 =
        contrast !== undefined &&
        value2 !== undefined &&
        chip === undefined &&
        mixed !== true
          ? (0, runtime.colorContrastResults)(value2, contrast)
          : undefined,
      value4 = jsxq_.jsx(runtime.ColorTextPropertyRow, {
        label: label,
        mixed: mixed,
        editsAreUndoSteps: editsAreUndoSteps,
        onReset: onReset,
        chip: chip,
        headerTabs: headerTabs,
        panel: panel,
        allowNone: allowNone,
        isNone: isNone,
        noneDisabledReason: noneDisabledReason,
        onNone: onNone,
        contrast: contrast,
        value:
          value === undefined
            ? undefined
            : (0, runtime.resolveSlideColor)(value),
        placeholder: effective,
        swatches: swatches,
        clearLabel: clearLabel,
        trailing: trailing,
        popoverTitle: runtime.COLOR_LABEL,
        onChange: (input?: string): void => {
          if (input === undefined) {
            onPick(undefined);
            return;
          }
          let value5 = (0, runtime.slideColorOrUndefined)(input);
          if (value5 !== undefined) {
            onPick(value5);
          }
        },
        onLive: (input: string): void => {
          let value5 = (0, runtime.slideColorOrUndefined)(input);
          if (value5 !== undefined) {
            onLivePick(value5);
          }
        },
        onLiveEnd: (): void => onPickEnd(),

      });
    if (readsContrast !== true) {
      return value4;
    }
    return jsxq_.jsxs("div", {
      "data-slides": "contrast-row",
      children: [
        value4,
        value3 !== undefined && value2 !== undefined
          ? jsxq_.jsx(runtime.PropertyRow, {
              label: "",
              className: "-mt-0.5 pb-1 [--prop-row-h:0px]",
              children: jsxq_.jsx(runtime.ContrastLockup, {
                fg: value2,
                results: value3,
              }),
            })
          : null,
      ],
    });
  }
  function useFillEditor(options?: FillEditorOptions): FillEditorResult {
    let [value, value2] = runtime.reactw8.useState<"image" | null>(null),
      [value3, value4] = runtime.reactw8.useState(false),
      ref = runtime.reactw8.useRef<HTMLInputElement>(null),
      ref2 = runtime.reactw8.useRef({
        updateNodes: options?.updateNodes,
        mounted: false,
      });
    ref2.current.updateNodes = options?.updateNodes;
    runtime.reactw8.useEffect((): (() => void) => {
      ref2.current.mounted = true;
      return (): void => void (ref2.current.mounted = false);
    }, []);
    if (options === undefined) {
      return {};
    }
    let {
        node: node,
        slideBg: slideBg,
        swatches: swatches,
        fillMixed: fillMixed,
        updateNodes: updateNodes,
        liveUpdateNodes: liveUpdateNodes,
        end: end,
        pickImage: pickImage,
      }: FillEditorOptions = options,
      value5 = fillMixed ? undefined : node.fill,
      callback =
        (input: TextNodeUpdate): SlideNodeUpdate =>
        (source: SlideNode): SlideNode =>
          source.kind === "text" ? input(source) : source,
      callback2 = (input?: TextFill): void =>
        updateNodes(
          callback(
            (input2: TextNode): SlideNode =>
              (0, runtime.setTextFill)(input2, input),
          ),
        ),
      callback3 = (input?: TextFill): void =>
        liveUpdateNodes(
          callback(
            (input2: TextNode): SlideNode =>
              (0, runtime.setTextFill)(input2, input),
          ),
        ),
      value6 = value5?.kind === "gradient" ? value5.gradient : undefined,
      state = {
        kind: "slides-text",
        bag: undefined,
        disabled: false,
        swatches: swatches,
        clearKeys: undefined,
        mixedKeys: undefined,
        unifiedColorPopover: true,
        clear: (): void => callback2(undefined),
        commit: (input?: string, options2?: GradientValue): void =>
          options2 === undefined
            ? callback2(undefined)
            : callback2({
                kind: "gradient",
                gradient: options2,
              }),
        live: (input: string, options2: GradientValue): void =>
          callback3({
            kind: "gradient",
            gradient: options2,
          }),
        liveEnd: end,
      },
      callback4 = (input: File): void => {
        if (pickImage === undefined) {
          return;
        }
        value4(true);
        pickImage(input).then(
          (input2?: string): void => {
            if (
              !ref2.current.mounted ||
              ref2.current.updateNodes === undefined
            ) {
              if (input2 !== undefined) {
                (0, runtime.showToast)(
                  "That text changed while the picture was loading. Select it and pick the picture again.",
                );
              }
              return;
            }
            value4(false);
            if (input2 === undefined) {
              return;
            }
            if (!(0, runtime.isRenderableImageSource)(input2)) {
              (0, runtime.showToast)(
                "That picture cannot fill text here (it must upload, or compress to a small PNG/JPEG).",
              );
              return;
            }
            value2(null);
            ref2.current.updateNodes(
              callback(
                (input3: TextNode): SlideNode =>
                  (0, runtime.setTextFill)(input3, {
                    kind: "image",
                    src: input2,
                    ...(input3.fill?.kind === "image" &&
                    input3.fill.size !== undefined
                      ? {
                          size: input3.fill.size,
                        }
                      : {}),
                  }),
              ),
            );
          },
          (input2?: unknown): void => {
            if (ref2.current.mounted) {
              value4(false);
            }
            (0, runtime.showToast)(
              "Adding the picture failed: " +
                (input2 instanceof Error ? input2.message : String(input2)),
            );
          },
        );
      },
      value7: FillKindValue = value ?? value5?.kind ?? "color";
    if (fillMixed) {
      return {};
    }
    return {
      kind: {
        value: value7,
        label: "Fill type",
        options: [
          {
            value: "color",
            label: "Color",
          },
          {
            value: "gradient",
            label: "Gradient",
          },
          {
            value: "image",
            label: "Image",
          },
        ],
        onChange: (input?: string): void => {
          value2(
            input === "image" && value5?.kind !== "image" ? "image" : null,
          );
          if (input === "color" && value5 !== undefined) {
            callback2(undefined);
          }
          if (input === "gradient" && value6 === undefined) {
            callback2({
              kind: "gradient",
              gradient: defaultFillGradient(
                (0, runtime.resolveSlideColor)(node.color),
                slideBg,
              ),
            });
          }
        },
      },
      face:
        value7 === "gradient" && value6 !== undefined
          ? jsxq_.jsx("div", {
              "data-testid": "sl-text-gradient-panel",
              children: jsxq_.jsx(runtime.GradientPickerStyleEditor, {
                rec: value6,
                propKey: "backgroundGradient",
                ed: state,
              }),
            })
          : value7 === "image"
            ? jsxq_.jsxs("div", {
                className: "flex flex-col",
                "data-testid": "sl-text-image-panel",
                children: [
                  jsxq_.jsx(runtime.PropertyRow, {
                    label: "Image",
                    children: jsxq_.jsxs("div", {
                      className: "flex min-w-0 flex-1 items-center gap-2",
                      children: [
                        jsxq_.jsx(runtime.PropertyColorPreview, {
                          className: "h-8 w-8 shrink-0",
                          children:
                            value5?.kind === "image"
                              ? jsxq_.jsx("img", {
                                  src: value5.src,
                                  alt: "",
                                  className:
                                    "absolute inset-0 h-full w-full object-cover",
                                })
                              : null,
                        }),
                        jsxq_.jsx(runtime.Button, {
                          variant: "secondary",
                          disabled: pickImage === undefined || value3,
                          title:
                            pickImage === undefined
                              ? "Adding pictures isn’t available in this view"
                              : undefined,
                          onClick: (): void => ref.current?.click(),
                          children: value3
                            ? "Loading…"
                            : value5?.kind === "image"
                              ? "Replace…"
                              : "Choose image…",
                        }),
                        jsxq_.jsx("input", {
                          ref: ref,
                          type: "file",
                          accept: "image/*",
                          className: "hidden",
                          onChange: (input: ChangeEvent<HTMLInputElement>): void => {
                            let value8 = input.currentTarget.files?.[0];
                            input.currentTarget.value = "";
                            if (value8) {
                              callback4(value8);
                            }
                          },
                        }),
                      ],
                    }),
                  }),
                  jsxq_.jsx(runtime.ChoicePropertyRow, {
                    label: "Size",
                    value:
                      value5?.kind === "image"
                        ? (value5.size ?? "cover")
                        : "cover",
                    disabled: value5?.kind !== "image",
                    title:
                      value5?.kind !== "image"
                        ? "Pick an image first"
                        : undefined,
                    options: [
                      {
                        value: "cover",
                        label: "Cover",
                      },
                      {
                        value: "contain",
                        label: "Contain",
                      },
                    ],
                    onChange: (input?: string): void => {
                      if (value5?.kind === "image") {
                        callback2({
                          kind: "image",
                          src: value5.src,
                          ...(input === "contain"
                            ? {
                                size: "contain",
                              }
                            : {}),
                        });
                      }
                    },
                  }),
                ],
              })
            : null,
    };
  }
  function TextFillPropertyRow({
    colorMixed: colorMixed,
    editsAreUndoSteps: editsAreUndoSteps,
    ...remainingProps
  }: TextFillPropertyRowProps): ReactElement {
    let {
        node: node,
        slideBg: slideBg,
        swatches: swatches,
        fillMixed: fillMixed,
        updateNodes: updateNodes,
        liveUpdateNodes: liveUpdateNodes,
        end: end,
        contrast: contrast,
      } = remainingProps,
      value = fillMixed ? undefined : node.fill,
      value2 = useFillEditor(remainingProps),
      callback =
        (input: TextNodeUpdate): SlideNodeUpdate =>
        (source: SlideNode): SlideNode =>
          source.kind === "text" ? input(source) : source,
      callback2 = (input: TextNode, options?: string): TextNode => {
        let { color: value4, ...value5 } = (0, runtime.setTextFill)(
          input,
          undefined,
        ) as TextNode;
        if (options === undefined) {
          return value5;
        } else {
          return {
            ...value5,
            color: options,
          };
        }
      },
      value3 = (0, runtime.textFillCssImage)(value);
    return jsxq_.jsx(FillPropertyRow, {
      editsAreUndoSteps: editsAreUndoSteps,
      label: "Color",
      value: node.color,
      mixed: colorMixed || fillMixed,
      effective: (0, runtime.slideTextColor)(slideBg),
      swatches: swatches,
      readsContrast: true,
      contrast: contrast,
      clearLabel: "Theme default",
      onPick: (input?: string): void =>
        updateNodes(
          callback((input2: TextNode): TextNode => callback2(input2, input)),
        ),
      onLivePick: (input: string): void =>
        liveUpdateNodes(
          callback((input2: TextNode): TextNode => callback2(input2, input)),
        ),
      onPickEnd: end,
      onReset:
        value !== undefined || node.color !== undefined
          ? (): void =>
              updateNodes(
                callback(
                  (input: TextNode): TextNode => callback2(input, undefined),
                ),
              )
          : undefined,
      chip:
        value3 !== undefined && value !== undefined
          ? {
              css: value3,
              text:
                value.kind === "image"
                  ? "Image"
                  : value.gradient.radial === true
                    ? "Radial"
                    : "Linear",
            }
          : undefined,
      headerTabs: value2.kind,
      panel: value2.face,
    });
  }
  function defaultFillGradient(color?: string, slideBg?: string): GradientValue {
    let value = (0, runtime.stripHexAlpha)(
        color ?? (0, runtime.slideTextColor)(slideBg),
      ),
      value2 = runtime.renderingNamedColors.clay ?? "#d97757",
      value3 =
        value.toLowerCase() === value2.toLowerCase() ? "#ffffff" : value2;
    return {
      angle: 90,
      stops: [
        {
          color: value,
          pos: 0,
        },
        {
          color: mixHexColors(value, value3, 0.6),
          pos: 100,
        },
      ],
    };
  }
  function mixHexColors(from: string, to2: string, amount: number): string {
    let callback = (input: string, options: number): number =>
      parseInt(input.slice(1 + options * 2, 3 + options * 2), 16);
    return (
      "#" +
      [0, 1, 2]
        .map((input) =>
            Math.round(
              callback(from, input) +
                (callback(to2, input) - callback(from, input)) * amount,
            )
              .toString(16)
              .padStart(2, "0"),
        )
        .join("")
    );
  }
  function ConnectorEndsPropertyRows({
    node: node,
    selKey: selKey,
    mixedOf: mixedOf,
    updateNodes: updateNodes,
  }: ConnectorEndsPropertyRowsProps): ReactElement {
    return jsxq_.jsx(jsxq_.Fragment, {
      children: CONNECTOR_END_CHOICES.map(
        ({ which: which, label: label }) => {
          let value = mixedOf(
            (source: SlideNode) =>
              source.kind === "shape" && source.shape === "connector"
                ? (0, runtime.connectorArrowHeads)(source)[which]
                : null,
          );
          return jsxq_.jsx(
            runtime.SegmentedPropertyRow,
            {
              label: label,
              "data-testid": "sl-connector-head-" + which,
              options: CONNECTOR_ARROW_OPTIONS.map((input) => ({
                ...input,
                tooltip: label + ": " + input.label,
              })),
              value: value
                ? undefined
                : (0, runtime.connectorArrowHeads)(node)[which],
              mixed: value,
              onChange: (input: ArrowHeadKind): void =>
                updateNodes(
                  (source: SlideNode): SlideNode =>
                    source.kind === "shape" && source.shape === "connector"
                      ? (0, runtime.setConnectorArrowHeads)(source, {
                          ...(0, runtime.connectorArrowHeads)(source),
                          [which]: input,
                        })
                      : source,
                ),
            },
            selKey + ":connector-head-" + which,
          );
        },
      ),
    });
  }
  function TextResizePropertyRow({
    nodes: nodes,
    updateNodes: updateNodes,
  }: TextResizePropertyRowProps): ReactElement | null {
    let value = nodes
      .filter(
        (input) => input?.kind === "text" || input?.kind === "table",
      )
      .map((input) => input.fit ?? runtime.defaultTextFit);
    if (value.length === 0) {
      return null;
    }
    let value2 = value.some((input) => input !== value[0]);
    return jsxq_.jsx(runtime.SelectPropertyRow, {
      label: "Resize",
      title:
        "What happens when the slide holds more than fits and squeezes this box: shrink its text to fit the box, keep the text size, or keep it and never let a column squeeze the box",
      options: [
        {
          value: "shrink",
          label: "Shrink text to fit",
        },
        {
          value: "none",
          label: "Don't resize text",
        },
        {
          value: "grow",
          label: "Grow box to fit text",
        },
      ],
      value: value2 ? "" : value[0],
      placeholder: "Mixed",
      onChange: (input: TextFit | ""): void =>
        updateNodes((source: SlideNode): SlideNode => {
          if (source.kind !== "text" && source.kind !== "table") {

            return source;
          }
          if (input === "") {
            return source;
          }
          return {
            ...source,
            fit: input,
          };
        }),
    });
  }
  function SelectionInspector({
    slide: slide,
    selection: selection,
    onChange: onChange,
    onLiveChange: onLiveChange,
    onGestureEnd: onGestureEnd,
    deckCellCount: deckCellCount,
    typeStyles: typeStyles,
    deckTypeStyles: deckTypeStyles,
    faces: faces,
    facesFull: facesFull,
    fonts: fonts,
    measure: measure,
    designColors: designColors,
    slideColors: slideColors,
    assets: assets,
    onReplaceImage: onReplaceImage,
    onRemoveImages: onRemoveImages,
    pickImage: pickImage,
    editsAreUndoSteps: editsAreUndoSteps,
  }: SelectionInspectorProps): ReactElement {
    let value = (0, runtime.useDeckColorChoices)(
        designColors,
        slideColors,
      ),
      [, value2] = runtime.reactw8.useState(0),
      value3 = (0, runtime.filterValidSelections)(slide, selection),
      value4 =
        value3.length > 0 ? value3[value3.length - 1] : undefined,
      value5 = value4
        ? (0, runtime.selectedNode)(slide, value4)
        : undefined,
      value6 = value3.length === 1,
      callback: MixedOf = (input) => {
        if (value3.length < 2) {
          return false;
        }
        let value42 =
          value4 !== undefined
            ? (0, runtime.selectedNode)(slide, value4)
            : undefined;
        if (value42 === undefined) {
          return false;
        }
        let value43 = input(value42);
        return value3.some((input2) => {
          let value44 = (0, runtime.selectedNode)(slide, input2);
          return (
            value44 !== undefined &&
            !(0, runtime.styleValuesEqual)(input(value44), value43)
          );
        });
      },
      value7 = (0, runtime.commonSelectedNodeKind)(slide, value3),
      value8 =
        value6 && value4 !== undefined && value4.child !== undefined
          ? ((): FlowFrame | undefined => {
              let value42 = (0, runtime.frameById)(
                  slide,
                  value4.frameId,
                ),
                value43 = (0, runtime.parentNodeSelection)(value4),
                value44 =
                  value43 !== undefined
                    ? (0, runtime.selectedNode)(slide, value43)
                    : undefined;
              if (
                value42 !== undefined &&
                value44 !== undefined &&
                (0, runtime.isFlowContainer)(value44)
              ) {
                return {
                  ...value42,
                  node: value44,
                };
              } else {
                return undefined;
              }
            })()
          : undefined,
      value9 =
        value6 &&
        value4 !== undefined &&
        value4.child !== undefined &&
        value4.path === undefined
          ? ((): Frame | undefined => {
              let value42 = (0, runtime.frameById)(
                slide,
                value4.frameId,
              );
              if (value42 !== undefined && value42.node.kind === "overlay") {
                return value42;
              } else {
                return undefined;
              }
            })()
          : undefined,
      value10 =
        value9 !== undefined && value4?.child !== undefined && value4.child >= 1
          ? value4.child - 1
          : undefined,
      callback2 = (input: "x" | "y", options: (axis: Axis) => Axis): void => {
        if (value9 === undefined || value10 === undefined) {
          return;
        }
        onChange(
          (0, runtime.updateSlideFrame)(
            slide,
            value9.id,
            (input2) => {
              if (input2.node.kind !== "overlay") {
                return input2;
              }
              let value42 = input2.node.layers[value10];
              if (!value42) {
                return input2;
              }
              let items4 = [...input2.node.layers],
                state = {
                  ...value42,
                  [input]: options(value42[input]),
                },
                callback27 = (input3: Axis): boolean =>
                  input3.anchor !== "fill" && input3.size === undefined;
              if (callback27(state[input]) && !callback27(value42[input])) {
                state.node = (0, runtime.resetImageDimensions)(
                  state.node,
                  input === "x",
                  input === "y",
                  assets ?? new Map(),
                );
              }
              items4[value10] = state;
              return {
                ...input2,
                node: {
                  ...input2.node,
                  layers: items4,
                },
              };
            },
          ),
        );
      },
      callback3 = (input: SlideNode, options: NodePlacement): SlideNode => {
        let state: NodePlacement = {
          ...input.place,
          ...options,
        };
        for (let value42 of Object.keys(state) as (keyof NodePlacement)[])
          if (state[value42] === undefined) {
            delete state[value42];
          }
        let state2: SlideNode = {
          ...input,
        };
        if (Object.keys(state).length === 0) {
          delete state2.place;
        } else {
          state2.place = state;
        }
        return state2;
      },
      callback4 = (input: NodePlacement): void =>
        callback13((input2) => callback3(input2, input)),
      callback5 = (input: NodePlacement): void =>
        callback14((input2) => callback3(input2, input)),
      ref = runtime.reactw8.useRef<Slide | null>(null),
      ref2 = runtime.reactw8.useRef<TableNode | null>(null),
      ref3 = runtime.reactw8.useRef<Slide | null>(null),
      ref4 = runtime.reactw8.useRef(false),
      ref5 = runtime.reactw8.useRef(onLiveChange);
    ref5.current = onLiveChange;
    runtime.reactw8.useEffect(() => {
      ref4.current = false;
      return () => {
        ref4.current = true;
        let current = ref.current;
        ref.current = null;
        ref2.current = null;
        ref3.current = null;
        if (current !== null) {
          ref5.current(current);
        }
      };
    }, []);
    let callback6 = (input: Slide): void => {
        if (ref4.current) {
          return;
        }
        if (ref.current === null) {
          ref.current = slide;
        }
        ref3.current = input;
        onLiveChange(input);
      },
      callback7 = (): void => {
        if (ref4.current) {
          return;
        }
        let current = ref.current;
        ref.current = null;
        ref2.current = null;
        ref3.current = null;
        if (current === null) {
          return;
        }
        onGestureEnd(current);
      },
      [value11, value12] = runtime.reactw8.useState(false);
    runtime.reactw8.useEffect(() => {
      if (
        document.activeElement !== document.body &&
        document.activeElement !== null
      ) {
        return;
      }
      document
        .querySelector<HTMLElement>('[data-kit="panel-header"] button')
        ?.focus({
          preventScroll: true,
        });
    }, []);
    let value13 = (0, runtime.selectionsKey)(value3),
      [value14, value15] = runtime.reactw8.useState<{
        sel: string;
        keys: Set<string>;
      }>({
        sel: "",
        keys: new Set(),
      }),
      callback8 = (input: string): boolean =>
        value14.sel === value13 && value14.keys.has(input),
      callback9 = (input: string): void =>
        value15(
          (input2) => ({
            sel: value13,
            keys: new Set([
              ...(input2.sel === value13 ? input2.keys : []),
              input,
            ]),
          }),
        ),
      callback10 = (input: string): void =>
        value15(
          (input2) => ({
            sel: value13,
            keys: new Set(
              [...(input2.sel === value13 ? input2.keys : [])].filter(
                (input3) => input3 !== input,
              ),
            ),
          }),
        ),
      value16 =
        value4 !== undefined
          ? value4.frameId +
            ":" +
            (0, runtime.selectionNodePath)(value4).join(".")
          : "",
      [value17, value18] = runtime.reactw8.useState<UnitSize | undefined>(
        undefined,
      );
    runtime.reactw8.useLayoutEffect(() => {
      let value42 =
        value4 !== undefined ? measure?.(value4) : undefined;
      value18(
        (input) =>
          input?.w === value42?.w && input?.h === value42?.h ? input : value42,
      );
    }, [measure, value16, slide]);
    let callback11 = (input: SlideNode): (number | undefined)[] => {
        let value42 = input.style ?? {},
          callback27 = (input2: unknown): number | undefined =>
            typeof input2 === "number" ? input2 : undefined;
        return [
          callback27(value42.paddingTop),
          callback27(value42.paddingRight),
          callback27(value42.paddingBottom),
          callback27(value42.paddingLeft),
        ];
      },
      items: SideKeys = [
        "paddingTop",
        "paddingRight",
        "paddingBottom",
        "paddingLeft",
      ],
      callback12 = (
        source: SlideNode,
        options: UpdateNodes,
        context: LiveUpdate,
      ): ReactElement | null => {
        if (
          source.kind !== "stack" &&
          source.kind !== "grid" &&
          source.kind !== "overlay"
        ) {
          return null;
        }
        let value42 = callback11(source),
          value43 = source.kind === "overlay" ? undefined : source.gap,
          value44 = callback(
            (source2) =>
              source2.kind === "stack" ? source2.dir : null,
          ),
          value45 = callback(
            (source2) =>
              source2.kind === "stack" || source2.kind === "grid"
                ? source2.gap
                : null,
          ),
          value46 = callback(
            (source2) =>
              source2.kind === "stack" ? (source2.justify ?? "start") : null,
          ),
          value47 = callback(
            (source2) =>
              source2.kind === "stack" ? source2.align : null,
          ),
          value48 = callback(
            (source2) =>
              source2.kind === "stack" ? source2.wrap === true : null,
          ),
          value49 = callback(
            (input) => callback11(input),
          ),
          value50 = callback(
            (source2) =>
              source2.kind === "grid" ? source2.columns : null,
          ),
          value51 =
            source.kind === "stack" &&
            (source.justify === "between" ||
              source.justify === "around" ||
              source.justify === "evenly"),
          callback27 = (
            input: SideChange[],
            options2: boolean = false,
          ): void =>
            (options2 ? context : options)(
              (source2) =>
                source2.kind === "stack" ||
                source2.kind === "grid" ||
                source2.kind === "overlay"
                  ? (0, runtime.patchNodeStyle)(
                      source2,
                      Object.fromEntries(
                        input.map(
                          (input2) => [
                            items[input2.side],
                            input2.value,
                          ],
                        ),
                      ),
                    )
                  : source2,
            );
        return jsxq_.jsxs(jsxq_.Fragment, {
          children: [
            jsxq_.jsx(runtime.SelectPropertyRow, {
              label: "Layout",
              title:
                "Converting between Stack, Grid and Layered is not available yet",
              options: [
                {
                  value: "overlay",
                  label: "Layered",
                  disabled: source.kind !== "overlay",
                },
                {
                  value: "stack",
                  label: "Stack",
                  disabled: source.kind !== "stack",
                },
                {
                  value: "grid",
                  label: "Grid",
                  disabled: source.kind !== "grid",
                },
              ],
              value: source.kind,
              onChange: (): void => {
                return;
              },
            }),
            source.kind === "stack"
              ? jsxq_.jsx(runtime.SegmentedPropertyRow, {
                  label: "Direction",
                  "data-testid": "sl-direction",
                  options: [
                    {
                      value: "h",
                      label: "Horizontal",
                      icon: "ArrowRight",
                    },
                    {
                      value: "v",
                      label: "Vertical",
                      icon: "ArrowDown",
                    },
                  ],
                  value: source.dir,
                  mixed: value44,
                  onChange: (input: "h" | "v"): void =>
                    options((source2) => {
                      if (source2.kind !== "stack") {
                        return source2;
                      }
                      let state: StackNode = {
                        ...source2,
                        dir: input,
                      };
                      if (input === "v") {
                        delete state.wrap;
                      }
                      return state;
                    }),
                  trailing: jsxq_.jsx(runtime.Button, {
                    variant: "ghost",
                    iconOnly: true,
                    icon: "ArrowReturn",
                    "aria-label": "Wrap",
                    tooltip: value48
                      ? "Wrap differs across the selection — click to turn it on for all"
                      : source.dir === "h"
                        ? source.wrap === true
                          ? "Children wrap onto more rows — click for one row"
                          : "Wrap children onto more rows"
                        : "Wrap applies to a horizontal stack",
                    pressed: source.wrap === true && !value48,
                    disabled: source.dir !== "h" || value44,
                    "data-testid": "sl-wrap-toggle",
                    onClick: (): void =>
                      options((source2) => {
                        if (source2.kind !== "stack" || source2.dir !== "h") {
                          return source2;
                        }
                        let state: StackNode = {
                          ...source2,
                        };
                        if (source.wrap === true && !value48) {
                          delete state.wrap;
                        } else {
                          state.wrap = true;
                        }
                        return state;
                      }),
                  }),
                })
              : null,
            source.kind === "grid"
              ? value50
                ? jsxq_.jsx(runtime.PropertyRow, {
                    label: "Columns",
                    title:
                      "The selected grids' columns differ — select one grid to edit its tracks",
                    children: jsxq_.jsx("span", {
                      className: "text-footnote text-muted",
                      children: "Mixed",
                    }),
                  })
                : jsxq_.jsx(GridTracksPropertyRows, {
                    label: "Columns",
                    tracks: source.columns,
                    onChange: (input: GridTrack[]): void =>
                      options(
                        (source2) =>
                          source2.kind === "grid"
                            ? {
                                ...source2,
                                columns: input,
                              }
                            : source2,
                      ),
                  })
              : null,
            source.kind === "stack"
              ? jsxq_.jsx(runtime.PropertyRow, {
                  label: "Align",
                  "data-testid": "sl-alignment",
                  trailing: jsxq_.jsx(runtime.Button, {
                    variant: "ghost",
                    iconOnly: true,
                    icon: jsxq_.jsx(runtime.PropertyIcon, {
                      icon: runtime.DEFAULT_JUSTIFY_ICON,
                    }),
                    "aria-label": "Distribute",
                    tooltip: value46
                      ? "Justify differs across the selection — click to distribute all"
                      : value51
                        ? "Distribute: space between — click to pack"
                        : "Distribute (space between); needs main-axis room to show",
                    pressed: value51 && !value46,
                    "data-testid": "sl-distribute",
                    className:
                      source.dir === "v" ? "shrink-0 rotate-90" : "shrink-0",
                    onClick: (): void =>
                      options((source2) => {
                        if (source2.kind !== "stack") {
                          return source2;
                        }
                        let state: StackNode = {
                          ...source2,
                        };
                        if (value51 && !value46) {
                          delete state.justify;
                        } else {
                          state.justify = "between";
                        }
                        return state;
                      }),
                  }),
                  onReset:
                    source.justify !== undefined || source.align !== "stretch"
                      ? (): void =>
                          options((source2) => {
                            if (source2.kind !== "stack") {
                              return source2;
                            }
                            let state: StackNode = {
                              ...source2,
                              align: "stretch",
                            };
                            delete state.justify;
                            return state;
                          })
                      : undefined,
                  children: jsxq_.jsx("div", {
                    className:
                      "flex min-w-0 flex-1 flex-wrap items-center gap-2",
                    children:
                      source.kind === "stack"
                        ? jsxq_.jsxs(jsxq_.Fragment, {
                            children: [
                              jsxq_.jsx("span", {
                                className:
                                  "min-w-[calc(var(--cds-h-control)*3)] flex-1",
                                title:
                                  source.justify !== undefined &&
                                  source.justify !== "start" &&
                                  source.justify !== "center" &&
                                  source.justify !== "end"
                                    ? "Computed — Distribute decides this axis"
                                    : undefined,
                                children: jsxq_.jsx(
                                  runtime.SegmentedPropertyControl,
                                  {
                                    label: "Justify",
                                    "data-testid": "sl-justify",
                                    compact: true,
                                    vertical: source.dir === "v",
                                    options: [
                                      {
                                        value: "start",
                                        label: "Justify start",
                                        glyph: runtime.JUSTIFY_ICONS.start,
                                      },
                                      {
                                        value: "center",
                                        label: "Justify center",
                                        glyph: runtime.JUSTIFY_ICONS.center,
                                      },
                                      {
                                        value: "end",
                                        label: "Justify end",
                                        glyph: runtime.JUSTIFY_ICONS.end,
                                      },
                                    ],
                                    value:
                                      source.justify === "center" ||
                                      source.justify === "end"
                                        ? source.justify
                                        : undefined,
                                    inherited:
                                      !value46 &&
                                      (source.justify === undefined ||
                                        source.justify === "start")
                                        ? "start"
                                        : undefined,
                                    mixed: value46,
                                    disabled: value51 && !value46,
                                    onChange: (input: "start" | "center" | "end"): void =>
                                      options((source2) => {
                                        if (source2.kind !== "stack") {
                                          return source2;
                                        }
                                        let state: StackNode = {
                                          ...source2,
                                        };
                                        if (input === "start") {
                                          delete state.justify;
                                        } else {
                                          state.justify = input;
                                        }
                                        return state;
                                      }),
                                  },
                                ),
                              }),
                              jsxq_.jsx("span", {
                                className:
                                  "min-w-[calc(var(--cds-h-control)*3)] flex-1",
                                children: jsxq_.jsx(
                                  runtime.SegmentedPropertyControl,
                                  {
                                    label: "Align",
                                    "data-testid": "sl-align",
                                    compact: true,
                                    vertical: source.dir === "v",
                                    options: [
                                      {
                                        value: "start",
                                        label: "Align start",
                                        glyph: runtime.ALIGN_ICONS.start,
                                      },
                                      {
                                        value: "center",
                                        label: "Align center",
                                        glyph: runtime.ALIGN_ICONS.center,
                                      },
                                      {
                                        value: "end",
                                        label: "Align end",
                                        glyph: runtime.ALIGN_ICONS.end,
                                      },
                                    ],
                                    value:
                                      source.align === "start" ||
                                      source.align === "center" ||
                                      source.align === "end"
                                        ? source.align
                                        : undefined,
                                    mixed: value47,
                                    onChange: (input: "start" | "center" | "end"): void =>
                                      options(
                                        (source2) =>
                                          source2.kind === "stack"
                                            ? {
                                                ...source2,
                                                align: input,
                                              }
                                            : source2,
                                      ),
                                  },
                                ),
                              }),
                            ],
                          })
                        : null,
                  }),
                })
              : null,
            value43 !== undefined
              ? jsxq_.jsx(runtime.NumberPropertyRow, {
                  label: "Gap",
                  value: value45 ? undefined : value43,
                  mixed: value45,
                  min: 0,
                  max: 512,
                  onValue: (input?: number): void =>
                    options(
                      (source2) =>
                        source2.kind === "stack" || source2.kind === "grid"
                          ? {
                              ...source2,
                              gap: input ?? 0,
                            }
                          : source2,
                    ),
                  onScrub: (input: number): void =>
                    context(
                      (source2) =>
                        source2.kind === "stack" || source2.kind === "grid"
                          ? {
                              ...source2,
                              gap: input,
                            }
                          : source2,
                    ),
                  onScrubEnd: callback7,
                })
              : null,
            jsxq_.jsx(runtime.SidesPropertyRow, {
              label: "Padding",
              "data-testid": "sl-container-padding",
              values: value42,
              placeholders: ZERO_SIDE_PLACEHOLDERS,
              min: 0,
              max: 256,
              mixed: value49,
              onSides: (input: SideChange[]): void => callback27(input),
              onScrubSides: (input: SideChange[]): void =>
                callback27(input, true),
              onScrubEnd: callback7,
              onReset: value42.some(
                (input) => input !== undefined,
              )
                ? (): void => callback27(EMPTY_SIDE_VALUES)
                : undefined,
            }),
          ],
        });
      };
    if (value5 === undefined) {
      return jsxq_.jsxs("div", {
        className:
          "flex h-full flex-col overflow-y-auto pb-1 [--pp-label-w:72px] " +
          runtime.HIDDEN_NATIVE_SCROLLBAR_CLASS,
        children: [
          jsxq_.jsx(runtime.PropertySection, {
            title: "Slide",
            children: jsxq_.jsx(runtime.SelectPropertyRow, {
              label: "Transition",
              title: "How this slide leaves for the next one in Present",
              options: SLIDE_TRANSITION_OPTIONS,
              value: slide.transition ?? "none",
              onChange: (input: "none" | SlideTransition): void => {
                let state: Slide = {
                  ...slide,
                };
                if (input === "none") {
                  delete state.transition;
                } else {
                  state.transition = input;
                }
                onChange(state);
              },
            }),
          }),
          jsxq_.jsx(runtime.PropertySection, {
            title: "Appearance",
            children: jsxq_.jsx(FillPropertyRow, {
              editsAreUndoSteps: editsAreUndoSteps,
              label: "Background",
              value: slide.bg,
              swatches: value.rows,
              onPick: (input?: string): void => {
                if (input !== undefined) {
                  onChange({
                    ...slide,
                    bg: input,
                  });
                }
              },
              onLivePick: (input: string): void =>
                callback6({
                  ...slide,
                  bg: input,
                }),
              onPickEnd: callback7,
            }),
          }),
          slide.transition === "magic"
            ? jsxq_.jsx("p", {
                className: "mt-2 shrink-0 pr-md pl-lg text-footnote text-muted",
                children:
                  "Magic move animates elements this slide shares with the next one into their new place. Duplicate the slide, then move or resize — duplicates keep the element identity that pairs them up.",
              })
            : null,
          jsxq_.jsx(runtime.ScrollbarOverlay, {}),
        ],
      });
    }
    let callback13: UpdateNodes = (input, options) =>
        onChange(
          value3.reduce(
            (input2, options2) =>
              (0, runtime.updateSelectedNode)(input2, options2, input),
            slide,
          ),
          options,
        ),
      callback14: LiveUpdate = (input) =>
        callback6(
          value3.reduce(
            (input2, options) =>
              (0, runtime.updateSelectedNode)(input2, options, input),
            slide,
          ),
        ),
      value19 = value5,
      value20 =
        value7 !== undefined ? videoPlayerAt(value19) : undefined,
      value21 =
        value7 === "shape" &&
        value4 !== undefined &&
        value3.every((input) => {
          let value42 = (0, runtime.selectedNode)(slide, input);
          return value42?.kind === "shape" && value42.shape === "line";
        }) &&
        (0, runtime.nodeThicknessIsWritable)(
          slide,
          value4.frameId,
          (0, runtime.selectionNodePath)(value4),
        ),
      value22 = value21
        ? value3.map(
            (input) =>
              (0, runtime.nodeThickness)(
                slide,
                input.frameId,
                (0, runtime.selectionNodePath)(input),
              ),
          )
        : [],
      value23 = value22[value22.length - 1],
      value24 = value22.some(
        (input) => input !== value23,
      ),
      value25 =
        value21 && value17?.w !== undefined && value17.h !== undefined
          ? Math.round(Math.min(value17.w, value17.h))
          : undefined,
      value26 =
        value19.kind === "img"
          ? value19.asset !== undefined
            ? assets?.get(value19.asset)
            : value19.src
          : undefined,
      callback15 = (input: NodeSelection, options: SlideNode): SlideNode =>
        (ref.current && (0, runtime.selectedNode)(ref.current, input)) ??
        options,
      callback16 = (input: UpdateWithOriginal): void =>
        callback6(
          value3.reduce(
            (input2, options) =>
              (0, runtime.updateSelectedNode)(
                input2,
                options,
                (input3) =>
                  input(input3, callback15(options, input3)),
              ),
            slide,
          ),
        ),
      callback17 = (input: TableUpdate): void => {
        if (value19.kind !== "table" || !value6) {
          return;
        }
        if (ref2.current === null) {
          ref2.current = value19;
        }
        let current = ref2.current;
        callback14(() => input(current));
      },
      value27 = runtime.maxTableColumns,
      value28 = runtime.maxTableRows;
    if (value19.kind === "table") {
      let value42 = (0, runtime.countNodeTableCells)(value19),
        value43 = (0, runtime.countSlideTableCells)(slide),
        value44 =
          deckCellCount !== undefined && Number.isFinite(deckCellCount)
            ? deckCellCount
            : value43,
        value45 = value43 - value42,
        value46 = value44 - value42,
        value47 = Math.max(
          0,
          Math.min(
            runtime.maxSlideTableCells - value45,
            runtime.maxDeckTableCells - value46,
          ),
        );
      value27 = Math.max(
        value19.cols,
        Math.min(
          runtime.maxTableColumns,
          Math.floor(value47 / Math.max(1, value19.rows.length)),
        ),
      );
      value28 = Math.max(
        value19.rows.length,
        Math.min(runtime.maxTableRows, Math.floor(value47 / value19.cols)),
      );
    }
    let callback18 = (source: SlideNode): boolean =>
        source.kind === "text" ||
        source.kind === "stack" ||
        source.kind === "grid" ||
        source.kind === "overlay" ||
        source.kind === "table",
      callback19 = (
        input: SideChange[],
        options: boolean = false,
      ): void =>
        (options ? callback14 : callback13)(
          (input2: SlideNode): SlideNode =>
            callback18(input2)
              ? (0, runtime.patchNodeStyle)(
                  input2,
                  Object.fromEntries(
                    input.map(
                      (input3) => [
                        items[input3.side],
                        input3.value,
                      ],
                    ),
                  ),
                )
              : input2,
        ),
      value29 = value3.some((input) => {
        let value42 = (0, runtime.selectedNode)(slide, input);
        return (
          value42 !== undefined &&
          callback11(value42).some(
            (input2, options) =>
              input2 !== callback11(value19)[options],
          )
        );
      }),
      value30 =
        value20 === "slides-text" ||
        value20 === "slides-stack" ||
        value20 === "slides-table"
          ? jsxq_.jsx(runtime.SidesPropertyRow, {
              label: "Padding",
              "data-testid": "sl-padding",
              values: callback11(value19),
              placeholders:
                (0, runtime.textListGutter)(value19, slide.lists) !== undefined
                  ? ["0", "0", "0", String(runtime.defaultListGutter)]
                  : ZERO_SIDE_PLACEHOLDERS,
              min: 0,
              max: 256,
              mixed: value29,
              onSides: (input: SideChange[]): void => callback19(input),
              onScrubSides: (input: SideChange[]): void =>
                callback19(input, true),
              onScrubEnd: callback7,
              onReset: callback11(value19).some(
                (input) => input !== undefined,
              )
                ? (): void => callback19(EMPTY_SIDE_VALUES)
                : undefined,
            })
          : null,
      value31 = ((): Set<string> => {
        let values2: Set<string> = new Set();
        if (value3.length < 2) {
          return values2;
        }
        let value42 = value3.map(
            (input) =>
              (0, runtime.selectedNode)(slide, input)?.style ?? {},
          ),
          values3 = new Set(
            value42.flatMap((input) => Object.keys(input)),
          );
        for (let value43 of values3)
          if (
            value42.some(
              (input) =>
                !(0, runtime.styleValuesEqual)(
                  input[value43 as keyof StyleBag] ?? null,
                  value42[0]![value43 as keyof StyleBag] ?? null,
                ),
            )
          ) {
            values2.add(value43);
          }
        return values2;
      })(),
      callback20 = (input: string, options?: readonly StylePropertyName[]): ReactElement | null =>
        value20 !== undefined
          ? jsxq_.jsx(
              runtime.StyleInspector,
              {
                kind: value20,
                bag: value19.style,
                swatches: value.rows,
                clearKeys: {
                  backgroundColor: ["backgroundGradient"],
                },
                mixedKeys: value31,
                onlyKeys: options,
                onCommit: (input2: StyleBag | undefined, options2: StylePatch): void =>
                  callback13(
                    (input3) =>
                      videoPlayerAt(input3) !== undefined
                        ? (0, runtime.patchNodeStyle)(input3, options2)
                        : input3,
                  ),
                onLive: (input2: StyleBag | undefined, options2: StylePatch): void =>
                  callback14(
                    (input3) =>
                      videoPlayerAt(input3) !== undefined
                        ? (0, runtime.patchNodeStyle)(input3, options2)
                        : input3,
                  ),
                onLiveEnd: callback7,
              },
              value13 + ":appearance" + input,
            )
          : null,
      items2: RadiusKeys = [
        "borderTopLeftRadius",
        "borderTopRightRadius",
        "borderBottomRightRadius",
        "borderBottomLeftRadius",
      ],
      callback21 = (source: SlideNode): boolean => {
        let value42 = videoPlayerAt(source);
        return (
          value42 === "slides-text" ||
          value42 === "slides-stack" ||
          value42 === "slides-table" ||
          value42 === "slides-img" ||
          (value42 === "slides-shape" &&
            source.kind === "shape" &&
            source.shape === "rect")
        );
      },
      callback22 = (input: SlideNode): (number | undefined)[] => {
        let style = input.style,
          value42 =
            typeof style?.borderRadius === "number"
              ? style.borderRadius
              : undefined,
          callback27 = (input2: RadiusKey): number | undefined =>
            typeof style?.[input2] === "number" ? style[input2] : value42;
        return [
          callback27(items2[0]),
          callback27(items2[1]),
          callback27(items2[2]),
          callback27(items2[3]),
        ];
      },
      callback23 = (
        items4: SideChange[],
        options: boolean = false,
      ): void =>
        (options ? callback14 : callback13)((input: SlideNode): SlideNode => {
          if (!callback21(input)) {
            return input;
          }
          if (
            items4.length === 4 &&
            items4.every(
              (input2) => input2.value === items4[0]!.value,
            )
          ) {
            let value43 = items4[0]!.value ?? 0;

            return (0, runtime.patchNodeStyle)(
              input,
              (0, runtime.borderRadiusPatch)({
                tl: value43,
                tr: value43,
                br: value43,
                bl: value43,
              }),
            );
          }
          let value42 = (0, runtime.borderRadiiByCorner)(input.style),
            items5: [number, number, number, number] = [value42.tl, value42.tr, value42.br, value42.bl];
          for (let value43 of items4)
            items5[value43.side] = value43.value ?? 0;
          return (0, runtime.patchNodeStyle)(
            input,
            (0, runtime.borderRadiusPatch)({
              tl: items5[0],
              tr: items5[1],
              br: items5[2],
              bl: items5[3],
            }),
          );
        }),
      value32 = value3.some((input) => {
        let value42 = (0, runtime.selectedNode)(slide, input);
        return (
          value42 !== undefined &&
          callback22(value42).some(
            (input2, options) =>
              input2 !== callback22(value19)[options],
          )
        );
      }),
      value33 =
        value20 !== undefined && callback21(value19)
          ? jsxq_.jsx(
              runtime.CornersPropertyRow,
              {
                label: "Radius",
                "data-testid": "sl-radius",
                values: callback22(value19),
                placeholders: ZERO_SIDE_PLACEHOLDERS,
                min: 0,
                max: 256,
                mixed: value32,
                onSides: (input: SideChange[]): void => callback23(input),
                onScrubSides: (input: SideChange[]): void =>
                  callback23(input, true),
                onScrubEnd: callback7,
                onReset: callback22(value19).some(
                  (input) => input !== undefined,
                )
                  ? (): void => callback23(EMPTY_SIDE_VALUES)
                  : undefined,
              },
              value13 + ":radius",
            )
          : null,
      items3: BorderStyleOption[] = [
        {
          value: "none",
          label: "None",
          icon: "Prohibit",
        },
        {
          value: "solid",
          label: "Solid",
          glyph: runtime.BORDER_SOLID_ICON,
        },
        {
          value: "dashed",
          label: "Dashed",
          glyph: runtime.BORDER_DASHED_ICON,
        },
        {
          value: "dotted",
          label: "Dotted",
          glyph: runtime.BORDER_DOTTED_ICON,
        },
      ],
      text = "#141413",
      value34 = ((): ReactElement | null => {
        if (value20 === undefined) {
          return null;
        }
        let style = value19.style,
          value42 = (0, runtime.borderWidthsBySide)(style),
          items4 = [
            value42.top,
            value42.right,
            value42.bottom,
            value42.left,
          ],
          value43 = items4.some(
            (input) => input > 0,
          ),
          value44 = style?.borderStyle,
          value45 =
            !value43 || value44 === undefined || value44 === "none"
              ? "none"
              : value44 === "double"
                ? "solid"
                : value44,
          value46 = value44 !== undefined,
          callback27 = (input: SlideNode): boolean =>
            videoPlayerAt(input) !== undefined,
          callback28 = (input: BorderStyleValue): void =>
            callback13((source) => {
              if (!callback27(source)) {
                return source;
              }
              if (
                source.kind === "shape" &&
                source.shape === "line" &&
                input !== "none" &&
                input !== "solid"
              ) {
                return source;
              }
              if (input === "none") {
                return (0, runtime.ensureShapeFill)(
                  (0, runtime.patchNodeStyle)(source, {
                    ...runtime.BORDER_STYLE_CLEAR_PATCH,
                  }),
                );
              }
              let style2 = source.style,
                value49 = (0, runtime.borderWidthsBySide)(style2),
                value50 =
                  style2?.borderStyle !== undefined &&
                  style2.borderStyle !== "none" &&
                  (value49.top > 0 ||
                    value49.right > 0 ||
                    value49.bottom > 0 ||
                    value49.left > 0);
              return (0, runtime.patchNodeStyle)(source, {
                borderStyle: input,
                ...(!value50 &&
                (style2?.borderWidth ?? 0) === 0 &&
                !(0, runtime.hasPerSideBorderWidths)(style2)
                  ? {
                      borderWidth: 1,
                    }
                  : {}),
                ...(style2?.borderColor === undefined
                  ? {
                      borderColor: text,
                    }
                  : {}),
              });
            }),
          items5: BorderSideKeys = ["top", "right", "bottom", "left"],
          callback29 = (
            input: StyleBag | undefined,
            options: SideChange[],
          ): BorderWidths => {
            let state = {
              ...(0, runtime.borderWidthsBySide)(input),
            };
            for (let value49 of options)
              state[items5[value49.side]] = value49.value ?? 0;
            return state;
          },
          callback30 = (items6: SideChange[]): boolean =>
            items6.length === 4 &&
            items6.every(
              (input) => input.value === items6[0]!.value,
            ),
          callback31 = (input: SideChange[]): boolean =>
            callback30(input)
              ? (input[0]!.value ?? 0) === 0
              : !isNonConnectorShape(value19) &&
                Object.values<number>(callback29(style, input)).every(
                  (input2) => input2 === 0,
                ),
          callback32 = (input: number): number =>
            input > 0 && input < 1 ? input : 1,
          callback33 = (
            input: SideChange[],
            options: boolean = false,
          ): void =>
            (options ? callback14 : callback13)((input2: SlideNode): SlideNode => {
              if (!callback27(input2)) {
                return input2;
              }
              let style2 = input2.style;
              if (callback30(input)) {
                let value50 = input[0]!.value ?? 0;

                if (value50 === 0 && !options) {
                  return (0, runtime.ensureShapeFill)(
                    (0, runtime.patchNodeStyle)(input2, {
                      ...runtime.BORDER_STYLE_CLEAR_PATCH,
                    }),
                  );
                }
                return (0, runtime.ensureShapeFill)(
                  (0, runtime.patchNodeStyle)(
                    input2,
                    (0, runtime.normalizedBorderPatch)(
                      (0, runtime.ensureVisibleBorderStyle)(
                        style2,
                        (0, runtime.setBorderWidthsPreservingSides)(
                          style2,
                          options && value50 === 0
                            ? callback32(
                                Math.max(
                                  ...Object.values<number>(
                                    (0, runtime.borderWidthsBySide)(style2),
                                  ),
                                ),
                              )
                            : value50,
                        ),
                        text,
                      ),
                    ),
                  ),
                );
              }
              if (isNonConnectorShape(input2)) {
                return input2;
              }
              let value49 = callback29(style2, input);
              if (
                options &&
                Object.values<number>(value49).every(
                  (input3) => input3 === 0,
                )
              ) {
                for (let value50 of input)
                  value49[items5[value50.side]] = callback32(
                    (0, runtime.borderWidthsBySide)(style2)[
                      items5[value50.side]
                    ],
                  );
              }
              return (0, runtime.ensureShapeFill)(
                (0, runtime.patchNodeStyle)(
                  input2,
                  (0, runtime.normalizedBorderPatch)(
                    (0, runtime.ensureVisibleBorderStyle)(
                      style2,
                      (0, runtime.borderPatchFromWidths)(value49),
                      text,
                    ),
                  ),
                ),
              );
            }),
          callback34 = (input: SlideNode): BorderStyleValue => {
            let value49 = (0, runtime.borderWidthsBySide)(input.style),
              value50 = input.style?.borderStyle;
            if (
              !(
                value49.top > 0 ||
                value49.right > 0 ||
                value49.bottom > 0 ||
                value49.left > 0
              ) ||
              value50 === undefined ||
              value50 === "none"
            ) {
              return "none";
            } else {
              if (value50 === "double") {
                return "solid";
              } else {
                return value50;
              }
            }
          },
          value47 = callback(
            (input) => callback34(input),
          ),
          value48 = callback((input) => {
            let value49 = (0, runtime.borderWidthsBySide)(input.style);
            return [value49.top, value49.right, value49.bottom, value49.left];
          });
        return jsxq_.jsxs(jsxq_.Fragment, {
          children: [
            jsxq_.jsx(
              runtime.SegmentedPropertyRow,
              {
                label: "Border",
                "data-testid": "sl-border-style",
                options:
                  value19.kind === "shape" && value19.shape === "line"
                    ? items3.map(
                        (input) =>
                          input.value === "dashed" || input.value === "dotted"
                            ? {
                                ...input,
                                whyDisabled: LINE_DASH_REASON,
                              }
                            : input,
                      )
                    : items3,
                value: value47 ? undefined : value45,
                mixed: value47,
                title: value46 ? undefined : "No border",
                onChange: callback28,
                onReset: value46
                  ? (): void => callback28("none")
                  : undefined,
              },
              value13 + ":border-style",
            ),
            value45 !== "none"
              ? jsxq_.jsxs(jsxq_.Fragment, {
                  children: [
                    jsxq_.jsx(
                      runtime.ColorTextPropertyRow,
                      {
                        label: "Color",
                        editsAreUndoSteps: editsAreUndoSteps,
                        value: style?.borderColor,
                        mixed: callback(
                          (input) =>
                            input.style?.borderColor ?? null,
                        ),
                        swatches: value.rows,
                        popoverTitle: runtime.COLOR_LABEL,
                        onChange: (input: string | undefined): void => {
                          if (input === undefined) {
                            return;
                          }
                          callback13(
                            (input2) =>
                              callback27(input2)
                                ? (0, runtime.patchNodeStyle)(
                                    input2,
                                    (0, runtime.borderColorPatch)(
                                      input2.style,
                                      input,
                                    ),
                                  )
                                : input2,
                          );
                        },
                        onLive: (input: string): void =>
                          callback14(
                            (input2) =>
                              callback27(input2)
                                ? (0, runtime.patchNodeStyle)(
                                    input2,
                                    (0, runtime.borderColorPatch)(
                                      input2.style,
                                      input,
                                    ),
                                  )
                                : input2,
                          ),
                        onLiveEnd: callback7,
                        onReset:
                          style?.borderColor !== undefined &&
                          style.borderColor.toLowerCase() !== text
                            ? (): void =>
                                callback13(
                                  (input) =>
                                    callback27(input)
                                      ? (0, runtime.patchNodeStyle)(
                                          input,
                                          (0, runtime.borderColorPatch)(
                                            input.style,
                                            text,
                                          ),
                                        )
                                      : input,
                                )
                            : undefined,
                      },
                      value13 + ":border-color",
                    ),
                    jsxq_.jsx(
                      runtime.SidesPropertyRow,
                      {
                        label: "Width",
                        "data-testid": "sl-border-width",
                        values: items4,
                        min: 0,
                        max: isNonConnectorShape(value19)
                          ? runtime.maxShapeStrokeWidth
                          : 16,
                        mixed: value48,
                        toggleDisabledReason: isNonConnectorShape(value19)
                          ? runtime.SHAPE_BORDER_SIDES_REASON
                          : undefined,
                        onSides: (input: SideChange[]): void =>
                          callback33(input),
                        onScrubSides: (input: SideChange[]): void =>
                          callback33(input, true),
                        onScrubEnd: (items6: SideChange[]): void => {
                          if (ref4.current) {
                            return;
                          }
                          callback7();
                          if (items6.length > 0 && callback31(items6)) {
                            callback33(items6);
                          }
                        },
                        onReset:
                          (0, runtime.hasPerSideBorderWidths)(style) ||
                          (style?.borderWidth !== undefined &&
                            style.borderWidth !== 1) ||
                          style?.borderSides !== undefined
                            ? (): void =>
                                callback13(
                                  (input) =>
                                    callback27(input)
                                      ? (0, runtime.patchNodeStyle)(
                                          input,
                                          (0, runtime.normalizedBorderPatch)(
                                            (0,
                                            runtime.ensureVisibleBorderStyle)(
                                              input.style,
                                              (0,
                                              runtime.borderPatchFromWidths)({
                                                top: 1,
                                                right: 1,
                                                bottom: 1,
                                                left: 1,
                                              }),
                                              text,
                                            ),
                                          ),
                                        )
                                      : input,
                                )
                            : undefined,
                      },
                      value13 + ":border-width",
                    ),
                  ],
                })
              : null,
          ],
        });
      })(),
      value35 = ((): ReactElement | null => {
        if (value20 === undefined) {
          return null;
        }
        let style = value19.style,
          value42 = style?.backgroundGradient,
          value43 =
            value42 !== undefined
              ? (0, runtime.styleBagToCss)(
                  {
                    backgroundGradient: value42,
                  },
                  "slides-stack",
                ).backgroundImage
              : undefined,
          value44 = (0, runtime.stylePropertyAppliesToNode)(
            "backgroundGradient",
            value20,
          ),
          callback27 = (
            input: SlideNode,
            options: StylePatch,
          ): boolean => {
            let value51 = videoPlayerAt(input);
            return (
              value51 !== undefined &&
              Object.keys(options).every(
                (input2) =>
                  options[input2] === undefined ||
                  (0, runtime.stylePropertyAppliesToNode)(
                    input2 as StylePropertyName,
                    value51,
                  ),
              )
            );
          },
          callback28 = (input: StylePatch): void =>
            callback13(
              (input2) =>
                callback27(input2, input)
                  ? (0, runtime.patchNodeStyle)(input2, input)
                  : input2,
            ),
          callback29 = (input: StylePatch): void =>
            callback14(
              (input2) =>
                callback27(input2, input)
                  ? (0, runtime.patchNodeStyle)(input2, input)
                  : input2,
            ),
          value45 = (0, runtime.createStyleEditor)({
            kind: value20,
            bag: style,
            swatches: value.rows,
            unifiedColorPopover: true,
            onCommit: (input, options) =>
              callback28(options),
            onLive: (input, options) =>
              callback29(options),
            onLiveEnd: callback7,
          }),
          value46 =
            style?.backgroundColor !== undefined || value42 !== undefined,
          value47 = callback(
            (input) => [
              input.style?.backgroundColor ?? null,
              input.style?.backgroundGradient ?? null,
            ],
          ),
          value48 = isNonConnectorShape(value19),
          callback30 = (): void =>
            callback13(
              (input) =>
                callback27(input, {
                  backgroundColor: undefined,
                })
                  ? (0, runtime.updateNodeShapeStyle)(input, {
                      backgroundColor: undefined,
                      backgroundGradient: undefined,
                    })
                  : input,
            ),
          callback31 = (): void =>
            callback13(
              (input) =>
                callback27(input, {
                  backgroundColor: undefined,
                })
                  ? (0, runtime.ensureShapeFill)(
                      (0, runtime.patchNodeStyle)(input, {
                        backgroundColor: undefined,
                        backgroundGradient: undefined,
                      }),
                    )
                  : input,
            ),
          value49 =
            !value48 ||
            value3.some((input) => {
              let value51 = (0, runtime.selectedNode)(slide, input);
              return (
                value51 !== undefined &&
                isNonConnectorShape(value51) &&
                value51.style?.backgroundColor !== undefined &&
                (0, runtime.shapeHasOutline)(value51.style)
              );
            }),
          value50 =
            value48 &&
            value3.every((input) => {
              let value51 = (0, runtime.selectedNode)(slide, input);
              return (
                value51 === undefined ||
                !isNonConnectorShape(value51) ||
                ((0, runtime.shapeHasOutline)(value51.style)
                  ? value51.style?.backgroundColor === undefined
                  : isDefaultShapeFill(value51.style?.backgroundColor))
              );
            });
        return jsxq_.jsx(
          runtime.ColorTextPropertyRow,
          {
            label: "Background",
            editsAreUndoSteps: editsAreUndoSteps,
            value: style?.backgroundColor,
            mixed: value47,
            swatches: value.rows,
            clearLabel:
              value50 && style?.backgroundColor !== undefined
                ? undefined
                : "None",
            noneDisabledReason:
              value49 || (!value46 && !value47)
                ? undefined
                : runtime.BORDER_REQUIRED_REASON,
            onNone: value48 ? callback30 : undefined,
            popoverTitle: runtime.COLOR_LABEL,
            allowNone: true,
            isNone: !value46 && !value47,
            chip:
              !value47 && typeof value43 === "string"
                ? {
                    css: value43,
                    text: value42!.radial === true ? "Radial" : "Linear",
                  }
                : undefined,
            ...(value44 && !value47
              ? {
                  headerTabs: {
                    value:
                      !value47 && value42 !== undefined ? "gradient" : "color",
                    options: [
                      {
                        value: "color",
                        label: "Color",
                      },
                      {
                        value: "gradient",
                        label: "Gradient",
                      },
                    ],
                    onChange: (input: string): void => {
                      if (input === "gradient" && value42 === undefined) {
                        callback28({
                          backgroundGradient: (0,
                          runtime.defaultStylePropertyValue)(
                            "backgroundGradient",
                            value20,
                          ),
                        });
                      }
                      if (input === "color" && value42 !== undefined) {
                        callback28({
                          backgroundGradient: undefined,
                        });
                      }
                    },
                  },
                  panel:
                    value42 !== undefined
                      ? jsxq_.jsx("div", {
                          "data-testid": "sl-fill-gradient-panel",
                          children: jsxq_.jsx(
                            runtime.GradientPickerStyleEditor,
                            {
                              rec: value42,
                              propKey: "backgroundGradient",
                              ed: value45,
                            },
                          ),
                        })
                      : null,
                }
              : {}),
            onChange: (input: string | undefined): void => {
              if (input === undefined) {
                callback30();
              } else {
                callback28({
                  backgroundColor: input,
                  backgroundGradient: undefined,
                });
              }
            },
            onLive: (input: string): void =>
              callback29({
                backgroundColor: input,
                backgroundGradient: undefined,
              }),
            onLiveEnd: callback7,
            onReset: value48
              ? value50
                ? undefined
                : callback31
              : value46
                ? callback30
                : undefined,
            trailing: value46
              ? jsxq_.jsx("span", {
                  className: "contents",
                  onClickCapture: value49 ? focusPropertyRowControl : undefined,
                  children: jsxq_.jsx(runtime.RemovePropertyButton, {
                    label: "background",
                    disabled: !value49,
                    disabledReason: runtime.BORDER_REQUIRED_REASON,
                    onClick: callback30,
                  }),
                })
              : undefined,
          },
          value13 + ":fill",
        );
      })(),
      value36 =
        value20 !== undefined
          ? jsxq_.jsxs(jsxq_.Fragment, {
              children: [
                value35,
                callback20("", ["opacity"]),
                value33,
                value34,
              ],
            })
          : null,
      callback24 = (input: SlideNode): boolean => {
        let value42 = input.style?.backgroundColor,
          value43 = (0, runtime.borderWidthsBySide)(input.style);
        return (
          (value42 !== undefined && !isTransparentStyleColor(value42)) ||
          input.style?.backgroundGradient !== undefined ||
          value43.top > 0 ||
          value43.right > 0 ||
          value43.bottom > 0 ||
          value43.left > 0
        );
      },
      callback25 = (source: SlideNode): boolean =>
        source.kind === "text" && !callback24(source),
      callback26 = (source: SlideNode): boolean =>
        source.kind === "text" && source.fill !== undefined,
      value37 =
        callback25(value19) && !callback(callback25) ? "text" : "box",
      value38 =
        value37 === "text" && (callback26(value19) || callback(callback26))
          ? TEXT_SHADOW_FILL_REASON
          : undefined,
      values = new Set([
        ...(value19.kind === "text"
          ? [
              "fontFamily",
              "fontSize",
              "fontWeight",
              "fontStyle",
              "lineHeight",
              "letterSpacing",
              "textTransform",
              "textDecorationLine",
            ]
          : []),
        ...(value19.kind === "table" ? ["textAlign"] : []),
        "backgroundColor",
        "backgroundGradient",
        "opacity",
        "borderRadius",
        "borderWidth",
        "borderColor",
        "borderStyle",
        "borderTopLeftRadius",
        "borderTopRightRadius",
        "borderBottomRightRadius",
        "borderBottomLeftRadius",
        "paddingTop",
        "paddingRight",
        "paddingBottom",
        "paddingLeft",
        "cursor",
        ...(value37 === "text" ? ["textShadow"] : []),
      ]),
      value39 =
        value19.kind === "text" && value19.fill !== undefined
          ? new Map([["textShadow", TEXT_SHADOW_FILL_REASON]])
          : undefined,
      value40 =
        value8 !== undefined &&
        value4 !== undefined &&
        (0, runtime.selectionNodePath)(value4).length === 1 &&
        (0, runtime.isPrimaryLayoutFrame)(slide, value8),
      value41 =
        value8 !== undefined && (!value40 || value8.node.kind === "grid")
          ? ((): SizeSection | undefined => {
              let value42 = !value40,
                node = value8.node;
              if (!(0, runtime.isFlowContainer)(node)) {
                return;
              }
              let place = value5.place,
                value43 = node.kind === "grid",
                value44 = (
                  node.kind === "grid"
                    ? {
                        kind: "grid",
                        alignItems: node.alignItems,
                        justifyItems: node.justifyItems,
                      }
                    : {
                        kind: "stack",
                        dir: node.dir,
                        align: node.align,
                      }
                ) as FlowContainerNode,
                value45 = (0, runtime.childSizeMode)(
                  value5,
                  value44,
                  "w",
                ),
                value46 = (0, runtime.childSizeMode)(
                  value5,
                  value44,
                  "h",
                ),
                value47 =
                  (0, runtime.childSizeModeOptions)(value5, value44, "w")
                    .length > 0,
                callback27 = (input: SizeDimension): boolean =>
                  value47 &&
                  !(0, runtime.isMediaSizeNode)(value5) &&
                  (input === "w" ? value45 : value46).mode === "fixed",
                items4: SizeLimitKey[] = ["minW", "maxW", "minH", "maxH"],
                items5: SizeLimitItem[] = [
                  ...(callback27("w")
                    ? []
                    : [
                        {
                          key: "minW" as const,
                          label: "Min width",
                          authored: place?.minW !== undefined,
                        },
                        {
                          key: "maxW" as const,
                          label: "Max width",
                          authored: place?.maxW !== undefined,
                        },
                      ]),
                  ...(callback27("h")
                    ? []
                    : [
                        {
                          key: "minH" as const,
                          label: "Min height",
                          authored: place?.minH !== undefined,
                        },
                        {
                          key: "maxH" as const,

                          label: "Max height",
                          authored: place?.maxH !== undefined,
                        },
                      ]),
                ],
                callback28 = (input: SizeLimitKey): boolean =>
                  items5.some(
                    (input2) =>
                      input2.key === input &&
                      (input2.authored || callback8("layout:" + input)),
                  ),
                callback29 = (
                  input: SizeDimension,
                  options: string,
                ): ReactElement | null => {
                  let value49 = (0, runtime.childSizeModeOptions)(
                    value5,
                    value44,
                    input,
                  );
                  if (value49.length === 0) {
                    return null;
                  }
                  let value50 = input === "w" ? value45 : value46,
                    value51 =
                      value17 !== undefined
                        ? input === "w"
                          ? value17.w
                          : value17.h
                        : undefined,
                    [value52, value53] = (0,
                    runtime.dimensionLimitKeys)(input);
                  return jsxq_.jsx(runtime.NumberPropertyRow, {
                    label: options,
                    value: value50.mode === "fixed" ? value50.value : undefined,
                    min: 1,
                    max: 4096,
                    step: 8,
                    unit: value50.mode === "fixed" ? "px" : undefined,
                    clearable: value49.some(
                      (input2) => input2.value === "hug",
                    ),
                    placeholder:
                      value51 !== undefined ? String(value51) : "auto",
                    emptyStepFrom: value51,
                    title:
                      options +
                      ": Hug sizes to the content, Fixed is an exact size, Fill takes the space the group gives it.",
                    onReset: (0, runtime.canResetChildSizeMode)(
                      value5,
                      value44,
                      input,
                    )
                      ? (): void =>
                          callback13(
                            (input2) =>
                              (0, runtime.resetChildSizeMode)(
                                input2,
                                value44,
                                input,
                              ),
                          )
                      : undefined,
                    onValue: (input2: number | undefined): void =>
                      callback13(
                        (input3) =>
                          input2 === undefined
                            ? (0, runtime.updateChildSizeMode)(
                                input3,
                                value44,
                                input,
                                "hug",
                              )
                            : (0, runtime.updateChildSizeMode)(
                                input3,
                                value44,
                                input,
                                "fixed",
                                input2,
                              ),
                      ),
                    onScrub: (input2: number): void =>
                      callback14(
                        (input3) =>
                          (0, runtime.updateChildSizeMode)(
                            input3,
                            value44,
                            input,
                            "fixed",
                            input2,
                          ),
                      ),
                    onScrubEnd: callback7,
                    adornment: jsxq_.jsx(runtime.Select, {
                      compact: true,
                      align: "end",
                      "aria-label": options + " mode",
                      items: value49,
                      value: value50.mode,
                      disabled: value49.length < 2,
                      onChange: (input2: ChildSizeModeName): void => {
                        if (input2 === value50.mode) {
                          return;
                        }
                        if (input2 !== "fixed") {
                          callback13(
                            (input3) =>
                              (0, runtime.updateChildSizeMode)(
                                input3,
                                value44,
                                input,
                                input2,
                              ),
                          );
                          return;
                        }
                        let value54 =
                            value4 !== undefined
                              ? measure?.(value4)
                              : undefined,
                          value55 =
                            (value54 !== undefined
                              ? input === "w"
                                ? value54.w
                                : value54.h
                              : undefined) ??
                            place?.[value53] ??
                            place?.[value52];
                        if (value55 !== undefined) {
                          callback13(
                            (input3) =>
                              (0, runtime.updateChildSizeMode)(
                                input3,
                                value44,
                                input,
                                "fixed",
                                value55,
                              ),
                          );
                        }
                      },
                    }),
                  });
                },
                value48 = !value42
                  ? []
                  : items5
                      .filter(
                        (input) =>
                          !callback28(input.key) &&
                          (value47 || !items4.includes(input.key)),
                      )
                      .map(
                        (input) => ({
                          label: input.label,
                          onSelect: (): void =>
                            callback9("layout:" + input.key),
                        }),
                      );
              if (
                !(
                  (value42 &&
                    (value47 ||
                      (0, runtime.childSizeModeOptions)(value5, value44, "h")
                        .length > 0)) ||
                  items4.some(
                    (input) => value42 && callback28(input),
                  ) ||
                  value43
                ) &&
                value48.length === 0
              ) {
                return;
              }
              return {
                addItems: value48,
                rows: jsxq_.jsxs(jsxq_.Fragment, {
                  children: [
                    value42 ? callback29("w", "Width") : null,
                    value42 ? callback29("h", "Height") : null,
                    value42 && callback28("minW")
                      ? jsxq_.jsx("div", {
                          className: "contents",
                          onClickCapture: propertyRemovalMouseHandler,
                          onKeyDownCapture: propertyRemovalKeyHandler,
                          children: jsxq_.jsx(runtime.NumberPropertyRow, {
                            label: "Min width",
                            value: value5.place?.minW,
                            min: 0,
                            max: 4096,
                            step: 8,
                            clearable: true,
                            placeholder: "0",
                            onReset:
                              place?.minW !== undefined
                                ? (): void =>
                                    callback4({
                                      minW: undefined,
                                    })
                                : undefined,
                            onValue: (input: number | undefined): void =>
                              callback4({
                                minW: input,
                              }),
                            onScrub: (input: number): void =>
                              callback5({
                                minW: input,
                              }),
                            onScrubEnd: callback7,
                          }),
                        })
                      : null,
                    value42 && callback28("maxW")
                      ? jsxq_.jsx("div", {
                          className: "contents",
                          onClickCapture: propertyRemovalMouseHandler,
                          onKeyDownCapture: propertyRemovalKeyHandler,
                          children: jsxq_.jsx(runtime.NumberPropertyRow, {
                            label: "Max width",
                            value: value5.place?.maxW,
                            min: 1,
                            max: 4096,
                            step: 8,
                            clearable: true,
                            hint: "—",
                            onReset:
                              place?.maxW !== undefined
                                ? (): void =>
                                    callback4({
                                      maxW: undefined,
                                    })
                                : undefined,
                            onValue: (input: number | undefined): void =>
                              callback4({
                                maxW: input,
                              }),
                            onScrub: (input: number): void =>
                              callback5({
                                maxW: input,
                              }),
                            onScrubEnd: callback7,
                          }),
                        })
                      : null,
                    value42 && callback28("minH")
                      ? jsxq_.jsx("div", {
                          className: "contents",
                          onClickCapture: propertyRemovalMouseHandler,
                          onKeyDownCapture: propertyRemovalKeyHandler,
                          children: jsxq_.jsx(runtime.NumberPropertyRow, {
                            label: "Min height",
                            value: value5.place?.minH,
                            min: 0,
                            max: 4096,
                            step: 8,
                            clearable: true,
                            placeholder: "0",
                            onReset:
                              place?.minH !== undefined
                                ? (): void =>
                                    callback4({
                                      minH: undefined,
                                    })
                                : undefined,
                            onValue: (input: number | undefined): void =>
                              callback4({
                                minH: input,
                              }),
                            onScrub: (input: number): void =>
                              callback5({
                                minH: input,
                              }),
                            onScrubEnd: callback7,
                          }),
                        })
                      : null,
                    value42 && callback28("maxH")
                      ? jsxq_.jsx("div", {
                          className: "contents",
                          onClickCapture: propertyRemovalMouseHandler,
                          onKeyDownCapture: propertyRemovalKeyHandler,
                          children: jsxq_.jsx(runtime.NumberPropertyRow, {
                            label: "Max height",
                            value: value5.place?.maxH,
                            min: 1,
                            max: 4096,
                            step: 8,
                            clearable: true,
                            hint: "—",
                            onReset:
                              place?.maxH !== undefined
                                ? (): void =>
                                    callback4({
                                      maxH: undefined,
                                    })
                                : undefined,
                            onValue: (input: number | undefined): void =>
                              callback4({
                                maxH: input,
                              }),
                            onScrub: (input: number): void =>
                              callback5({
                                maxH: input,
                              }),
                            onScrubEnd: callback7,
                          }),
                        })
                      : null,
                    value43
                      ? jsxq_.jsxs(jsxq_.Fragment, {
                          children: [
                            jsxq_.jsx(runtime.NumberPropertyRow, {
                              label: "Column span",
                              title:
                                "Grid cells this child spans across (row-major auto-flow).",
                              value: value5.place?.colSpan,
                              min: 1,
                              max:
                                value8.node.kind === "grid"
                                  ? value8.node.columns.length
                                  : runtime.maxGridTracks,
                              step: 1,
                              clearable: true,
                              placeholder: "1",
                              onValue: (input: number | undefined): void =>
                                callback4({
                                  colSpan:
                                    input === undefined
                                      ? undefined
                                      : Math.round(input),
                                }),
                              onScrub: (input: number): void =>
                                callback5({
                                  colSpan: Math.round(input),
                                }),
                              onScrubEnd: callback7,
                            }),
                            jsxq_.jsx(runtime.NumberPropertyRow, {
                              label: "Row span",
                              value: value5.place?.rowSpan,
                              min: 1,
                              max: runtime.maxGridTracks,
                              step: 1,
                              clearable: true,
                              placeholder: "1",
                              onValue: (input: number | undefined): void =>
                                callback4({
                                  rowSpan:
                                    input === undefined
                                      ? undefined
                                      : Math.round(input),
                                }),
                              onScrub: (input: number): void =>
                                callback5({
                                  rowSpan: Math.round(input),
                                }),
                              onScrubEnd: callback7,
                            }),
                          ],
                        })
                      : null,
                  ],
                }),
              };
            })()
          : undefined;
    return jsxq_.jsxs("div", {
      className:
        "flex h-full flex-col overflow-y-auto pb-1 [--pp-label-w:72px] " +
        runtime.HIDDEN_NATIVE_SCROLLBAR_CLASS,
      children: [
        value7 === undefined
          ? jsxq_.jsxs("p", {
              className: "mt-2 shrink-0 pr-md pl-lg text-footnote text-muted",
              children: [
                String(value3.length),
                " objects of different kinds are selected. Select objects of one kind to edit them together.",
              ],
            })
          : !value6 &&
              value20 === undefined &&
              !(0, runtime.isFlowContainer)(value19) &&
              value19.kind !== "overlay" &&
              value19.kind !== "shape" &&
              value19.kind !== "spacer"
            ? jsxq_.jsxs("p", {
                className: "mt-2 shrink-0 pr-md pl-lg text-footnote text-muted",
                children: [
                  String(value3.length),
                  " objects are selected; they have no shared properties. Select one to edit it.",
                ],
              })
            : null,
        value41 !== undefined || (value9 !== undefined && value10 !== undefined)
          ? jsxq_.jsxs(runtime.PropertySection, {
              title: "Size",
              actions:
                value41 !== undefined && value41.addItems.length > 0
                  ? jsxq_.jsx("span", {
                      className: "contents",
                      onClickCapture: propertyRemovalMouseHandler,
                      children: jsxq_.jsx(runtime.PropertySectionActions, {
                        section: "Size",
                        items: value41.addItems,
                      }),
                    })
                  : undefined,
              children: [
                value9 !== undefined &&
                value10 !== undefined &&
                value9.node.kind === "overlay"
                  ? ((): (ReactElement | null)[] | null => {
                      let value42 = value9.node.layers[value10];
                      if (!value42) {
                        return null;
                      }
                      return (["x", "y"] as const).map(

                        (input) =>
                          value42[input].anchor === "fill" ||
                          (input === "y" && value42.node.kind === "table")
                            ? null
                            : jsxq_.jsx(
                                runtime.NumberPropertyRow,
                                {
                                  label: input === "x" ? "Width" : "Height",
                                  value: value42[input].size,
                                  min: 1,
                                  max: 4096,
                                  step: 8,
                                  clearable: true,
                                  placeholder: "auto",
                                  onReset:
                                    value42[input].size !== undefined
                                      ? (): void =>
                                          callback2(
                                            input,
                                            anchorSizePatch(undefined),
                                          )
                                      : undefined,
                                  onValue: (input2: number | undefined): void =>
                                    callback2(input, anchorSizePatch(input2)),
                                },
                                input,
                              ),
                      );
                    })()
                  : null,
                value41?.rows,
              ],
            })
          : null,
        value7 !== undefined &&
        ((0, runtime.isFlowContainer)(value19) ||
          value19.kind === "overlay" ||
          value30 !== null)
          ? jsxq_.jsxs(runtime.PropertySection, {
              title: "Layout",
              iconColumn: true,
              children: [
                !(0, runtime.isFlowContainer)(value19) &&
                value19.kind !== "overlay"
                  ? value30
                  : null,
                callback12(value19, callback13, callback14),
              ],
            })
          : null,
        value19.kind === "img" && value7 === "img"
          ? jsxq_.jsx(jsxq_.Fragment, {
              children: jsxq_.jsxs(runtime.PropertySection, {
                title:
                  value6 &&
                  (value19.video !== undefined ||
                    value19.videoLink !== undefined)
                    ? "Video"
                    : "Image",
                iconColumn: true,
                children: [
                  jsxq_.jsx(
                    MediaAssetPropertyRow,
                    {
                      video: !value6
                        ? false
                        : value19.video !== undefined
                          ? "clip"
                          : value19.videoLink !== undefined
                            ? "link"
                            : false,
                      src: value26,
                      name: imagePropertyLabel(value19, value26 ?? ""),
                      mixed: !value6,
                      empty: !value3.some((input) => {
                        let value42 = (0, runtime.selectedNode)(
                          slide,
                          input,
                        );
                        return (
                          value42?.kind === "img" &&
                          (0, runtime.imageHasMedia)(value42)
                        );
                      }),
                      onPick:
                        onReplaceImage !== undefined && value4 !== undefined
                          ? (input: File): void =>
                              onReplaceImage(
                                value4.frameId,
                                (0, runtime.selectionNodePath)(value4),
                                input,
                              )
                          : undefined,
                      onRemove: (): void =>
                        onRemoveImages !== undefined
                          ? onRemoveImages(
                              value3.map(
                                (input) => ({
                                  frameId: input.frameId,
                                  path: (0, runtime.selectionNodePath)(input),
                                }),
                              ),
                            )
                          : callback13(
                              (source) =>
                                source.kind === "img"
                                  ? (0, runtime.clearImageMedia)(source)
                                  : source,
                            ),
                    },
                    value13 + ":image",
                  ),
                  jsxq_.jsx(runtime.ChoicePropertyRow, {
                    label: "Fit",
                    options: [
                      {
                        value: "cover",
                        label: "Cover",
                      },
                      {
                        value: "contain",
                        label: "Contain",
                      },
                    ],
                    value: value19.fit,
                    onChange: (input: "cover" | "contain"): void =>
                      callback13(
                        (source) =>
                          source.kind === "img"
                            ? (0, runtime.setImageFit)(source, input)
                            : source,
                      ),
                  }),
                  value6 && value19.video !== undefined && value4 !== undefined
                    ? jsxq_.jsx(VideoProgressPropertyRow, {
                        at: (0, runtime.clipRegistryKey)(
                          value4.frameId,
                          (0, runtime.selectionNodePath)(value4).join("."),
                        ),
                      })
                    : null,
                  value6 && value19.video !== undefined
                    ? jsxq_.jsxs(jsxq_.Fragment, {
                        children: [
                          jsxq_.jsx(runtime.ChoicePropertyRow, {
                            label: "Start",
                            options: [
                              {
                                value: "auto",
                                label: "With slide",
                              },
                              {
                                value: "click",
                                label: "On click",
                              },
                            ],
                            value:
                              value19.videoStart === "click" ? "click" : "auto",
                            onChange: (input: string): void =>
                              callback13(
                                (source) =>
                                  source.kind === "img"
                                    ? (0, runtime.setVideoStartMode)(
                                        source,
                                        input === "click" ? "click" : "auto",
                                        source.videoDelay,
                                      )
                                    : source,
                              ),
                          }),
                          jsxq_.jsx(runtime.NumberPropertyRow, {
                            label: "Delay",
                            value:
                              value19.videoStart === "click"
                                ? undefined
                                : (value19.videoDelay ?? 0),
                            min: 0,
                            max: runtime.maxVideoDelaySeconds,
                            step: 0.5,
                            unit: "s",
                            disabled: value19.videoStart === "click",
                            title:
                              value19.videoStart === "click"
                                ? "A video that starts on a click has no delay."
                                : "Seconds to wait after the slide appears before the video starts.",
                            onValue: (input: number | undefined): void =>
                              callback13(
                                (source) =>
                                  source.kind === "img"
                                    ? (0, runtime.setVideoStartMode)(
                                        source,
                                        "auto",
                                        input ?? 0,
                                      )
                                    : source,
                              ),
                            onScrub: (input: number): void =>
                              callback14(
                                (source) =>
                                  source.kind === "img"
                                    ? (0, runtime.setVideoStartMode)(
                                        source,
                                        "auto",
                                        input,
                                      )
                                    : source,
                              ),
                            onScrubEnd: callback7,
                          }),
                          jsxq_.jsx(runtime.TogglePropertyRow, {
                            label: "Sound",
                            checked: value19.videoSound === "on",
                            onChange: (input: boolean): void =>
                              callback13(
                                (source) =>
                                  source.kind === "img"
                                    ? (0, runtime.setVideoSound)(source, input)
                                    : source,
                              ),
                          }),
                        ],
                      })
                    : null,
                  value6 && value19.videoLink !== undefined
                    ? jsxq_.jsx(runtime.NumberPropertyRow, {
                        label: "Start at",
                        value: value19.videoLink.start ?? 0,
                        min: 0,
                        max: runtime.maxVideoLinkStartSeconds,
                        step: 1,
                        unit: "s",
                        title:
                          "Seconds into the video where it starts playing.",
                        onValue: (input: number | undefined): void =>
                          callback13(
                            (source) =>
                              source.kind === "img" &&
                              source.videoLink !== undefined
                                ? (0, runtime.setVideoLink)(source, {
                                    provider: source.videoLink.provider,
                                    id: source.videoLink.id,
                                    start: input ?? 0,
                                  })
                                : source,
                          ),
                      })
                    : null,
                  jsxq_.jsx(runtime.PropertyRow, {
                    label: "Alt text",
                    children: jsxq_.jsx(runtime.TextInput, {
                      value: value19.alt,
                      "aria-label": "Alt text",
                      onChange: (event: ChangeEvent<HTMLInputElement>): void =>
                        callback13(
                          (source) =>
                            source.kind === "img"
                              ? {
                                  ...source,
                                  alt: event.target.value,
                                }
                              : source,
                        ),
                    }),
                  }),
                ],
              }),
            })
          : null,
        value19.kind === "icon" && value7 === "icon"
          ? jsxq_.jsx(jsxq_.Fragment, {
              children: jsxq_.jsxs(runtime.PropertySection, {
                title: "Icon",
                children: [
                  jsxq_.jsx(runtime.SelectPropertyRow, {
                    label: "Glyph",
                    options: runtime.slideIconNames.map(
                      (input) => ({
                        value: input,
                        label:
                          input.charAt(0) +
                          input
                            .slice(1)
                            .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
                            .toLowerCase(),
                      }),
                    ),
                    value: value19.icon,
                    onChange: (input: string): void =>
                      callback13(
                        (source) =>
                          source.kind === "icon"
                            ? {
                                ...source,
                                icon: input,
                              }
                            : source,
                      ),
                  }),
                  jsxq_.jsx(FillPropertyRow, {
                    editsAreUndoSteps: editsAreUndoSteps,
                    label: "Color",
                    value: value19.color,
                    mixed: callback(
                      (source) =>
                        source.kind === "icon" || source.kind === "text"
                          ? (source.color ?? null)
                          : null,
                    ),
                    effective: (0, runtime.slideTextColor)(slide.bg),
                    swatches: value.rows,
                    readsContrast: true,
                    contrast: (0, runtime.selectionContrastBackground)(
                      slide,
                      value3,
                      (0, runtime.getRenderingTheme)(),
                    ),
                    clearLabel: "Theme default",
                    onPick: (input: string | undefined): void =>
                      callback13((source) => {
                        if (source.kind !== "text" && source.kind !== "icon") {
                          return source;
                        }
                        let state = {
                          ...source,
                        };
                        if (input === undefined) {
                          delete state.color;
                        } else {
                          state.color = input;
                        }
                        return state;
                      }),
                    onLivePick: (input: string): void =>
                      callback14(
                        (source) =>
                          source.kind === "text" || source.kind === "icon"
                            ? {
                                ...source,
                                color: input,
                              }
                            : source,
                      ),
                    onPickEnd: callback7,
                  }),
                ],
              }),
            })
          : null,
        value19.kind === "shape" &&
        value7 === "shape" &&
        value19.shape === "connector"
          ? jsxq_.jsxs(runtime.PropertySection, {
              title: "Connector",
              iconColumn: true,
              children: [
                jsxq_.jsx(runtime.SegmentedPropertyRow, {
                  label: "Direction",
                  "data-testid": "sl-connector-direction",
                  options: CONNECTOR_DIRECTION_OPTIONS.map(
                    (input) => ({
                      ...input,
                      glyph: runtime.CONNECTOR_DIRECTION_ICONS[input.value],
                    }),
                  ),
                  value: value19.from ?? "tl",
                  onChange: (input: ConnectorCorner): void =>
                    callback13((source) => {
                      if (
                        source.kind !== "shape" ||
                        source.shape !== "connector"
                      ) {
                        return source;
                      }
                      let state = {
                        ...source,
                      };
                      if (input === "tl") {
                        delete state.from;
                      } else {
                        state.from = input;
                      }
                      return state;
                    }),
                }),
                jsxq_.jsx(ConnectorEndsPropertyRows, {
                  node: value19,
                  selKey: value13,
                  mixedOf: callback,
                  updateNodes: callback13,
                }),
                jsxq_.jsx(runtime.SelectPropertyRow, {
                  label: "Route",
                  options: CONNECTOR_ROUTE_OPTIONS,
                  value: value19.route ?? "straight",
                  onChange: (input: ConnectorRouting): void =>
                    callback13((source) => {
                      if (
                        source.kind !== "shape" ||
                        source.shape !== "connector"
                      ) {
                        return source;
                      }
                      let state = {
                        ...source,
                      };
                      if (input === "straight") {
                        delete state.route;
                      } else {
                        state.route = input;
                      }
                      return state;
                    }),
                }),
                jsxq_.jsx(runtime.ChoicePropertyRow, {
                  label: "Style",
                  options: CONNECTOR_STROKE_OPTIONS,
                  value: value19.dashed === true ? "dashed" : "solid",
                  onChange: (input: "solid" | "dashed"): void =>
                    callback13((source) => {
                      if (
                        source.kind !== "shape" ||
                        source.shape !== "connector"
                      ) {
                        return source;
                      }
                      let state = {
                        ...source,
                      };
                      if (input === "dashed") {
                        state.dashed = true;
                      } else {
                        delete state.dashed;
                      }
                      return state;
                    }),
                }),
              ],
            })
          : null,
        value19.kind === "table" && value7 === "table" && value6
          ? jsxq_.jsx(jsxq_.Fragment, {
              children: jsxq_.jsxs(runtime.PropertySection, {
                title: "Table",
                children: [
                  jsxq_.jsx(runtime.NumberPropertyRow, {
                    label: "Columns",
                    value: value19.cols,
                    min: 1,
                    max: value27,
                    onValue: (input: number | undefined): void =>
                      callback13(
                        (source) =>
                          source.kind === "table"
                            ? (0, runtime.resizeTable)(
                                source,
                                source.rows.length,
                                input ?? source.cols,
                              )
                            : source,
                      ),
                    onScrub: (input: number): void =>
                      callback17(
                        (input2) =>
                          (0, runtime.resizeTable)(
                            input2,
                            input2.rows.length,
                            input ?? input2.cols,
                          ),
                      ),
                    onScrubEnd: callback7,
                  }),
                  jsxq_.jsx(runtime.NumberPropertyRow, {
                    label: "Rows",
                    value: value19.rows.length,
                    min: 1,
                    max: value28,
                    onValue: (input: number | undefined): void =>
                      callback13(
                        (source) =>
                          source.kind === "table"
                            ? (0, runtime.resizeTable)(
                                source,
                                input ?? source.rows.length,
                                source.cols,
                              )
                            : source,
                      ),
                    onScrub: (input: number): void =>
                      callback17(
                        (input2) =>
                          (0, runtime.resizeTable)(
                            input2,
                            input ?? input2.rows.length,
                            input2.cols,
                          ),
                      ),
                    onScrubEnd: callback7,
                  }),
                  jsxq_.jsx(TextResizePropertyRow, {
                    nodes: value3.map(
                      (input) =>
                        (0, runtime.selectedNode)(slide, input),
                    ),
                    updateNodes: callback13,
                  }),
                  jsxq_.jsx(runtime.SelectPropertyRow, {
                    label: "Cell role",
                    options: [
                      {
                        value: "default",
                        label: "Default (body)",
                      },
                      ...runtime.textRoles.map(
                        (input) => ({
                          value: input,
                          label: runtime.textRoleLabels[input],
                        }),
                      ),
                    ],
                    value: value19.role ?? "default",
                    onChange: (input: "default" | TextRole): void => {
                      callback13((source) => {
                        if (source.kind !== "table") {
                          return source;
                        }
                        let state = {
                          ...source,
                        };
                        if (input === "default") {
                          delete state.role;
                        } else {
                          state.role = input;
                        }
                        return state;
                      });
                    },
                  }),
                  jsxq_.jsxs("div", {
                    className: "flex flex-col gap-1 py-1 pr-md pl-lg",
                    children: [
                      jsxq_.jsx("div", {
                        className: "text-footnote text-muted",
                        children: "Column widths",
                      }),
                      jsxq_.jsx("div", {
                        className: "grid grid-cols-2 gap-2",
                        children: Array.from<unknown, ReactElement>(
                          {
                            length: value19.cols,
                          },
                          (input, options) =>
                            jsxq_.jsx(
                              runtime.PropertyNumberInput,
                              {
                                prefix: "Col " + String(options + 1),
                                steppers: false,
                                value: value19.colWidths?.[options],
                                min: 1,
                                max: 100,
                                placeholder: "auto",
                                onValue: (input2: number | undefined): void => {
                                  if (input2 === undefined) {
                                    return;
                                  }
                                  callback13(
                                    (source) =>
                                      source.kind === "table"
                                        ? (0, runtime.setTableColumnWidth)(
                                            source,
                                            options,
                                            input2,
                                          )
                                        : source,
                                  );
                                },
                                onScrub: (input2: number): void => {
                                  if (input2 === undefined) {
                                    return;
                                  }
                                  callback14(
                                    (source) =>
                                      source.kind === "table"
                                        ? (0, runtime.setTableColumnWidth)(
                                            source,
                                            options,
                                            input2,
                                          )
                                        : source,
                                  );
                                },
                                onScrubEnd: callback7,
                              },
                              options,
                            ),
                        ),
                      }),
                    ],
                  }),
                  jsxq_.jsx(runtime.PropertyRow, {
                    label: "Header row",
                    onPress: (element: HTMLElement): void =>
                      element
                        .querySelector<HTMLElement>('[role="checkbox"]')
                        ?.click(),
                    children: jsxq_.jsx(runtime.Checkbox, {
                      checked: value19.header,
                      "aria-label": "Header row",
                      onCheckedChange: (input: boolean): void =>
                        callback13(
                          (source) =>
                            source.kind === "table"
                              ? {
                                  ...source,
                                  header: input === true,
                                }
                              : source,
                        ),
                    }),
                  }),
                ],
              }),
            })
          : null,
        value19.kind === "html" && value7 === "html" && value6
          ? jsxq_.jsxs(runtime.PropertySection, {
              title: "Embed",
              children: [
                jsxq_.jsx("p", {
                  className: "shrink-0 pr-md pl-lg text-footnote text-muted",
                  children:
                    "This embed’s content is written by the agent — ask the agent to change it.",
                }),
                jsxq_.jsx("p", {
                  className:
                    "mt-1.5 shrink-0 pr-md pl-lg text-footnote text-muted",
                  children: runtime.allowEmbedScripts
                    ? "Embeds are display-only and isolated from this editor. Scripts run inside the sandbox; they cannot read the presentation, but see the security notes before trusting unknown embed code. Not exported to PowerPoint."
                    : "Embeds are display-only: scripts do not run, nothing loads from the network (styles and data: images must be inline), and the content takes no clicks or keys. Use CSS for animation. Not exported to PowerPoint.",
                }),
              ],
            })
          : null,
        value19.kind === "spacer" && value7 === "spacer"
          ? jsxq_.jsx("p", {
              className: "mt-2 shrink-0 pr-md pl-lg text-footnote text-muted",
              children:
                "A spacer is empty, flexible space in its group. Resize it on the canvas; it has no properties of its own.",
            })
          : null,
        value19.kind === "shape" &&
        value7 === "shape" &&
        value19.shape === "connector"
          ? jsxq_.jsxs(runtime.PropertySection, {
              title: "Appearance",
              iconColumn: true,
              children: [
                jsxq_.jsx(
                  runtime.SegmentedPropertyRow,
                  {
                    label: "Line",
                    "data-testid": "sl-border-style",
                    options: items3.map(
                      (input) =>
                        input.value === "none"
                          ? {
                              ...input,
                              whyDisabled: "A line always draws",
                            }
                          : input.value === "dotted"
                            ? {
                                ...input,
                                whyDisabled: "A line is solid or dashed",
                              }
                            : input,
                    ),
                    value: callback(
                      (source) =>
                        source.kind === "shape" && source.shape === "connector"
                          ? source.dashed === true
                          : null,
                    )
                      ? undefined
                      : value19.dashed === true
                        ? "dashed"
                        : "solid",
                    mixed: callback(
                      (source) =>
                        source.kind === "shape" && source.shape === "connector"
                          ? source.dashed === true
                          : null,
                    ),
                    onChange: (input: string): void =>
                      callback13((source) => {
                        if (
                          source.kind !== "shape" ||
                          source.shape !== "connector" ||
                          input === "none" ||
                          input === "dotted"
                        ) {
                          return source;
                        }
                        let state = {
                          ...source,
                        };
                        if (input === "dashed") {
                          state.dashed = true;
                        } else {
                          delete state.dashed;
                        }
                        return state;
                      }),
                  },
                  value13 + ":connector-line",
                ),
                jsxq_.jsx(FillPropertyRow, {
                  editsAreUndoSteps: editsAreUndoSteps,
                  label: "Color",
                  value: value19.stroke,
                  mixed: callback(
                    (source) =>
                      source.kind === "shape" && source.shape === "connector"
                        ? (source.stroke ?? null)
                        : null,
                  ),
                  swatches: value.rows,
                  onPick: (input: string | undefined): void =>
                    callback13(
                      (source) =>
                        source.kind === "shape" &&
                        source.shape === "connector" &&
                        input !== undefined
                          ? {
                              ...source,
                              stroke: input,
                            }
                          : source,
                    ),
                  onLivePick: (input: string): void =>
                    callback14(
                      (source) =>
                        source.kind === "shape" &&
                        source.shape === "connector" &&
                        input !== undefined
                          ? {
                              ...source,
                              stroke: input,
                            }
                          : source,
                    ),
                  onPickEnd: callback7,
                }),
                jsxq_.jsx(runtime.NumberPropertyRow, {
                  label: "Width",
                  value: callback(
                    (source) =>
                      source.kind === "shape" && source.shape === "connector"
                        ? (source.strokeWidth ?? null)
                        : null,
                  )
                    ? undefined
                    : value19.strokeWidth,
                  mixed: callback(
                    (source) =>
                      source.kind === "shape" && source.shape === "connector"
                        ? (source.strokeWidth ?? null)
                        : null,
                  ),
                  min: 1,
                  max: runtime.maxShapeStrokeWidth,
                  placeholder: String(runtime.defaultShapeStrokeWidth),
                  onValue: (input: number | undefined): void =>
                    callback13(
                      (source) =>
                        source.kind === "shape" && source.shape === "connector"
                          ? {
                              ...source,
                              strokeWidth:
                                input === undefined || input === 0
                                  ? runtime.defaultShapeStrokeWidth
                                  : input,
                            }
                          : source,
                    ),
                  onScrub: (input: number): void =>
                    callback14(
                      (source) =>
                        source.kind === "shape" && source.shape === "connector"
                          ? {
                              ...source,
                              strokeWidth: Math.max(1, input),
                            }
                          : source,
                    ),
                  onScrubEnd: callback7,
                }),
              ],
            })
          : null,
        value20 !== undefined && value19.kind !== "text" && value7 !== undefined
          ? jsxq_.jsxs(runtime.PropertySection, {
              title: "Appearance",
              iconColumn: true,
              children: [
                value21
                  ? jsxq_.jsx(runtime.NumberPropertyRow, {
                      label: "Thickness",
                      value: value24 ? undefined : value23,
                      mixed: value24,
                      min: 1,
                      max: 4096,
                      smallStep: 1,
                      unit: "px",
                      placeholder:
                        value23 === undefined && value25 !== undefined
                          ? String(value25)
                          : undefined,
                      emptyStepFrom: value25,
                      onValue: (input: number | undefined): void => {
                        if (input !== undefined) {
                          onChange(
                            value3.reduce(
                              (input2, options) =>
                                (0, runtime.setNodeThickness)(
                                  input2,
                                  options.frameId,
                                  (0, runtime.selectionNodePath)(options),
                                  input,
                                ),
                              slide,
                            ),
                          );
                        }
                      },
                      onScrub: (input: number): void =>
                        callback6(
                          value3.reduce(
                            (input2, options) =>
                              (0, runtime.setNodeThickness)(
                                input2,
                                options.frameId,
                                (0, runtime.selectionNodePath)(options),
                                input,
                              ),
                            slide,
                          ),
                        ),
                      onScrubEnd: callback7,
                    })
                  : null,
                value36,
              ],
            })
          : null,
        value19.kind === "text" && value7 === "text"
          ? jsxq_.jsx(jsxq_.Fragment, {
              children: ((): ReactElement => {
                let value42 = (0, runtime.getRenderingTheme)(),
                  value43 =
                    typeStyles ?? runtime.emptyTypographyStyles,
                  value44 =
                    deckTypeStyles ?? runtime.emptyTypographyStyles,
                  value45 = value3
                    .map(
                      (input) =>
                        (0, runtime.selectedNode)(slide, input),
                    )
                    .filter(
                      (input: SlideNode | undefined): input is TextNode => input?.kind === "text",
                    ),
                  { style: value46, mixed: value47 } = (0,
                  runtime.matchingTypographyNodes)(
                    value19,
                    value45,
                    value43,
                    value42,
                  ),
                  value48 = value42 === "neutral",
                  callback27 = (input: TextNode): TypographyStyle | undefined =>
                    (0, runtime.resolveNodeTypographyStyle)(
                      input,
                      value43,
                      value44,
                      value42,
                      true,
                    ),
                  value49 =
                    !value47 && value46 !== null && !callback8("text:detached"),
                  value50 = value47 ? undefined : callback27(value19),
                  value51 = value47
                    ? undefined
                    : (value46?.name ??
                      (value50 === undefined
                        ? (0, runtime.nodeTypographyLabel)(value19, value42)
                        : value43.includes(value50)
                          ? value50.name
                          : "the presentation’s " +
                            value50.name.toLowerCase() +
                            " text")),
                  value52 =
                    value51 !== undefined ? "From " + value51 : undefined,
                  value53 =
                    value51 !== undefined
                      ? "Inherited from " + value51
                      : undefined,
                  value54 = (0, runtime.nodeTypographyCombo)(
                    value19,
                    value42,
                  ),
                  style = value19.style,
                  callback28 = (
                    source: SlideNode,
                    options: "fontWeight" | "fontFamily",
                  ): SlideNode => {
                    if (source.kind !== "text") {
                      return source;
                    }
                    let value63 = callback27(source);
                    if (options === "fontWeight") {
                      let value64 = value63?.fontWeight;
                      return (0, runtime.patchNodeStyle)(source, {
                        fontWeight:
                          value64 === undefined ||
                          value64 ===
                            (0, runtime.typeScaleForRole)(source.role, value42)
                              .fontWeight
                            ? undefined
                            : value64,
                        fontStyle: value63?.italic ? "italic" : undefined,
                      });
                    }
                    return (0, runtime.patchNodeStyle)(source, {
                      fontFamily: value63?.fontFamily,
                    });
                  },
                  callback29 = (
                    input: NumericTypographyKey,
                    options: string,
                    context?: number,
                    value63?: number,
                    extra?: number,
                    detail?: string,
                  ): ReactElement => {
                    let callback31 = (source: SlideNode): SlideNode => {
                      if (source.kind !== "text") {
                        return source;
                      }
                      let value64 = callback27(source)?.[input],
                        value65 =
                          input === "letterSpacing"
                            ? 0
                            : (0, runtime.typeScaleForRole)(
                                source.role,
                                value42,
                              )[input];
                      return (0, runtime.patchNodeStyle)(source, {
                        [input]:
                          value64 === undefined || value64 === value65
                            ? undefined
                            : value64,
                      });
                    };
                    return jsxq_.jsx(
                      runtime.NumberPropertyRow,
                      {
                        label: options,
                        value: callback(
                          (source) =>
                            source.kind === "text"
                              ? ((0, runtime.nodeTypographyCombo)(
                                  source,
                                  value42,
                                )[input] ?? null)
                              : null,
                        )
                          ? undefined
                          : style?.[input],
                        mixed: callback(
                          (source) =>
                            source.kind === "text"
                              ? ((0, runtime.nodeTypographyCombo)(
                                  source,
                                  value42,
                                )[input] ?? null)
                              : null,
                        ),
                        placeholder: String(value54[input]),
                        title:
                          style?.[input] === undefined ? value52 : undefined,
                        description:
                          style?.[input] === undefined &&
                          !callback(
                            (source) =>
                              source.kind === "text"
                                ? ((0, runtime.nodeTypographyCombo)(
                                    source,
                                    value42,
                                  )[input] ?? null)
                                : null,
                          )
                            ? value53
                            : undefined,
                        min: context,
                        max: value63,
                        step: extra,
                        unit: detail,
                        clearable: true,
                        onReset:
                          style?.[input] !== undefined
                            ? (): void => callback13(callback31)
                            : undefined,
                        onValue: (input2: number | undefined): void =>
                          input2 === undefined
                            ? callback13(callback31)
                            : callback13(
                                (source) =>
                                  source.kind === "text"
                                    ? (0, runtime.patchNodeStyle)(source, {
                                        [input]: input2,
                                      })
                                    : source,
                              ),
                        onScrub: (input2: number): void =>
                          callback14(
                            (source) =>
                              source.kind === "text"
                                ? (0, runtime.patchNodeStyle)(source, {
                                    [input]: input2,
                                  })
                                : source,
                          ),
                        onScrubEnd: callback7,
                      },
                      input,
                    );
                  },
                  value55 = (0, runtime.fontFamilyChoiceValue)(
                    style?.fontFamily,
                    faces,
                  ),
                  fontFamily = value54.fontFamily,
                  value56 =
                    fontFamily === undefined
                      ? value48
                        ? "System font"
                        : "Style default"
                      : typeof fontFamily === "string"
                        ? ((
                            {
                              sans: "Sans-serif",
                              serif: "Serif",
                              mono: "Monospace",
                              helvetica: "Helvetica",
                            } as Record<string, string | undefined>
                          )[fontFamily] ?? fontFamily)
                        : fontFamily.family,
                  value57 =
                    style?.fontWeight !== undefined ||
                    style?.fontStyle !== undefined,
                  value58 = style?.textDecorationLine,
                  value59 = callback(
                    (source) =>
                      source.kind === "text"
                        ? (source.style?.textDecorationLine ?? null)
                        : null,
                  ),
                  value60 = callback(
                    (source) =>
                      source.kind === "text" ? (source.list ?? "none") : null,
                  ),
                  value61 = callback(
                    (source) =>
                      source.kind === "text"
                        ? (0, runtime.typographyFontKey)(
                            source.style?.fontFamily,
                            source.role,
                            value42,
                          )
                        : null,
                  ),
                  value62 = callback(
                    (source) =>
                      source.kind === "text"
                        ? (0, runtime.fontVariantKey)(
                            (0, runtime.nodeTypographyCombo)(source, value42)
                              .fontWeight,
                            (0, runtime.nodeTypographyCombo)(source, value42)
                              .italic,
                          )
                        : null,
                  ),
                  callback30 = (input: "underline" | "line-through"): void =>
                    callback13(
                      (source) =>
                        source.kind === "text"
                          ? (0, runtime.patchNodeStyle)(
                              source,
                              !value59 && value58 === input
                                ? {
                                    textDecorationLine: undefined,
                                    textDecorationStyle: undefined,
                                    textDecorationColor: undefined,
                                  }
                                : {
                                    textDecorationLine: input,
                                  },
                            )
                          : source,
                    );
                return jsxq_.jsxs(runtime.PropertySection, {
                  title:
                    value3.length > 1
                      ? String(value45.length) + " Text"
                      : "Text",
                  iconColumn: true,
                  actions: jsxq_.jsx("span", {
                    className: "contents",
                    onClickCapture: propertyRemovalMouseHandler,
                    children: jsxq_.jsx(runtime.PropertySectionActions, {
                      section: "Text",
                      items: [
                        {
                          key: "emphasis",
                          label: "Emphasis",
                          authored: value58 !== undefined || value59,
                        },
                        {
                          key: "list",
                          label: "List",
                          authored: value19.list !== undefined || value60,
                        },
                        {
                          key: "textTransform",
                          label: "Case",
                          authored: style?.textTransform !== undefined,
                        },
                      ]
                        .filter(
                          (input) =>
                            !input.authored && !callback8("text:" + input.key),
                        )
                        .map(
                          (input) => ({
                            label: input.label,
                            onSelect: (): void =>
                              callback9("text:" + input.key),
                          }),
                        ),
                    }),
                  }),
                  children: [
                    jsxq_.jsx(runtime.SelectPropertyRow, {
                      label: "Text style",
                      options: value43.map(
                        (input) => ({
                          value: input.id,
                          label: input.name,
                          labelStyle: (0, runtime.typographyStyleCss)(input),
                          hint: input.hint,
                          ...(input.title !== undefined
                            ? {
                                title: input.title,
                              }
                            : {}),
                          ...(input.group !== undefined
                            ? {
                                group: input.group,
                              }
                            : {}),
                          ...(input.subgroup !== undefined
                            ? {
                                subgroup: input.subgroup,
                              }
                            : {}),
                        }),
                      ),
                      value: value49 && value46 !== null ? value46.id : "",
                      icon: value49 ? "TextAa" : undefined,
                      placeholder: value47 ? "Mixed" : value49 ? "" : "Custom",
                      disabled: value43.length === 0,
                      title:
                        value43.length === 0
                          ? value.systems > 0
                            ? "No type styles in this presentation’s design system"
                            : "No type styles in this presentation"
                          : !value49 && !value47
                            ? "Custom — " +
                              (0, runtime.nodeTypographyLabel)(
                                value19,
                                value42,
                              ) +
                              (value46 !== null
                                ? " (matches " + value46.name + ")"
                                : "")
                            : undefined,
                      trailing: value49
                        ? jsxq_.jsx(runtime.Button, {
                            variant: "ghost",
                            iconOnly: true,
                            icon: "Minus",
                            "aria-label": "Detach from the text style",
                            tooltip:
                              "Detach — edit font, weight, size, line height and letter spacing on this text",
                            "data-testid": "sl-text-detach",
                            onClick: (input: ReactMouseEvent<HTMLElement>): void => {
                              focusPropertyRowControl(input);
                              callback9("text:detached");
                            },
                          })
                        : undefined,
                      onChange: (input: string): void => {
                        let value63 = value43.find(
                          (input2) => input2.id === input,
                        );
                        if (value63 === undefined) {
                          return;
                        }
                        let items4: StylePropertyName[] = [
                            "fontFamily",
                            "fontSize",
                            "fontWeight",
                            "lineHeight",
                            "letterSpacing",
                            "textTransform",
                          ],
                          value64 = value3.some(
                            (input2) => {
                              let value65 = (0, runtime.selectedNode)(
                                slide,
                                input2,
                              );
                              return (
                                value65?.kind === "text" &&
                                items4.some(
                                  (input3) =>
                                    value65.style?.[input3] !== undefined &&
                                    !(
                                      input3 === "fontFamily" &&
                                      (0, runtime.typographyUsesSystemFont)(
                                        value63,
                                        value42,
                                      )
                                    ),
                                )
                              );
                            },
                          );
                        callback10("text:detached");
                        if (
                          value49 &&
                          value63 === value46 &&
                          (!value64 || value63.source === "system")
                        ) {
                          return;
                        }
                        callback13(
                          (source) =>
                            source.kind === "text"
                              ? (0, runtime.clearTypographyOverrides)(
                                  source,
                                  value63,
                                  value42,
                                )
                              : source,
                        );
                      },
                    }),
                    !value49
                      ? jsxq_.jsxs(jsxq_.Fragment, {
                          children: [
                            jsxq_.jsx(runtime.SelectPropertyRow, {
                              label: "Font",
                              options: [
                                ...(!value48
                                  ? [
                                      {
                                        value: "",
                                        label: "Style default",
                                      },
                                    ]
                                  : value55 === ""
                                    ? [
                                        {
                                          value: "",
                                          label: "System font",
                                        },
                                      ]
                                    : []),
                                ...(0, runtime.fontFamilyOptions)(
                                  faces,
                                  style?.fontFamily,
                                  facesFull,
                                ),
                              ],
                              searchable: true,
                              searchLabel: "Search fonts",
                              onOpenChange: (input: boolean) =>
                                input &&
                                (0, runtime.ensureGoogleFonts)(
                                  runtime.fontFamilyChoices,
                                ),
                              value: value61 ? "\x00mixed" : value55,
                              placeholder: value61 ? "Mixed" : value56,
                              title: value55 === "" ? value52 : undefined,
                              description:
                                value55 === "" && !value61
                                  ? value53
                                  : undefined,
                              onReset:
                                style?.fontFamily !== undefined
                                  ? (): void =>
                                      callback13(
                                        (input) =>
                                          callback28(input, "fontFamily"),
                                      )
                                  : undefined,
                              onChange: (input: string): void => {
                                let value63 = (0,
                                runtime.fontFamilyPatchFromChoice)(
                                  input,
                                  faces,
                                  style?.fontFamily,
                                );
                                callback13(
                                  (source) =>
                                    source.kind === "text"
                                      ? (0, runtime.patchNodeStyle)(source, {
                                          fontFamily: value63.fontFamily,
                                        })
                                      : source,
                                  value63.face,
                                );
                              },
                            }),
                            jsxq_.jsx(runtime.SelectPropertyRow, {
                              label: "Weight",
                              options: (0, runtime.fontVariantChoices)(
                                (0, runtime.resolvedFontVariants)(
                                  style?.fontFamily,
                                  value19.role,
                                  fonts,
                                ),
                                {
                                  weight: value54.fontWeight,
                                  italic: value54.italic,
                                },
                              ),
                              value: value62
                                ? "\x00mixed"
                                : value57
                                  ? (0, runtime.fontVariantKey)(
                                      value54.fontWeight,
                                      value54.italic,
                                    )
                                  : "",
                              placeholder: value62
                                ? "Mixed"
                                : (0, runtime.fontVariantLabel)(
                                    value54.fontWeight,
                                    value54.italic,
                                  ),
                              title: !value57 ? value52 : undefined,
                              description:
                                !value57 && !value62 ? value53 : undefined,
                              onOpenChange: (input: boolean) =>
                                input &&
                                value2(
                                  (input2) => input2 + 1,
                                ),
                              onReset: value57
                                ? (): void =>
                                    callback13(
                                      (input) =>
                                        callback28(input, "fontWeight"),
                                    )
                                : undefined,
                              onChange: (input: string): void => {
                                let value63 = (0,
                                runtime.parseFontVariantKey)(input);
                                if (value63 === undefined) {
                                  return;
                                }
                                callback13(
                                  (source) =>
                                    source.kind === "text"
                                      ? (0, runtime.patchNodeStyle)(source, {
                                          fontWeight:
                                            value63.weight ===
                                            Math.round(
                                              (0, runtime.typeScaleForRole)(
                                                source.role,
                                                value42,
                                              ).fontWeight / 100,
                                            ) *
                                              100
                                              ? undefined
                                              : value63.weight,
                                          fontStyle: value63.italic
                                            ? "italic"
                                            : undefined,
                                        })
                                      : source,
                                );
                              },
                            }),
                            callback29(
                              "fontSize",
                              "Size",
                              8,
                              400,
                              undefined,
                              "px",
                            ),
                            jsxq_.jsx(runtime.PropertyRow, {
                              label: "Spacing",
                              "data-testid": "sl-text-spacing",
                              title:
                                "Line height · Letter spacing" +
                                (style?.lineHeight === undefined &&
                                style?.letterSpacing === undefined &&
                                value52
                                  ? " — " + value52
                                  : ""),
                              description:
                                style?.lineHeight === undefined &&
                                style?.letterSpacing === undefined &&
                                !callback(
                                  (source) =>
                                    source.kind === "text"
                                      ? ((0, runtime.nodeTypographyCombo)(
                                          source,
                                          value42,
                                        ).lineHeight ?? null)
                                      : null,
                                ) &&
                                !callback(
                                  (source) =>
                                    source.kind === "text"
                                      ? ((0, runtime.nodeTypographyCombo)(
                                          source,
                                          value42,
                                        ).letterSpacing ?? null)
                                      : null,
                                )
                                  ? value53
                                  : undefined,
                              onReset:
                                style?.lineHeight !== undefined ||
                                style?.letterSpacing !== undefined
                                  ? (): void =>
                                      callback13(
                                        (source) => {
                                          if (source.kind !== "text") {
                                            return source;
                                          }
                                          let value63 =
                                              callback27(source),
                                            value64 =
                                              value63?.lineHeight,
                                            value65 =
                                              value63?.letterSpacing;
                                          return (0, runtime.patchNodeStyle)(
                                            source,
                                            {
                                              lineHeight:
                                                value64 ===
                                                (0, runtime.typeScaleForRole)(
                                                  source.role,
                                                  value42,
                                                ).lineHeight
                                                  ? undefined
                                                  : value64,
                                              letterSpacing:
                                                value65 === undefined ||
                                                value65 === 0
                                                  ? undefined
                                                  : value65,
                                            },
                                          );
                                        },
                                      )
                                  : undefined,
                              onPress: (element: HTMLElement): void =>
                                element.querySelector("input")?.focus(),
                              children: jsxq_.jsxs("div", {
                                className:
                                  "grid min-w-0 flex-1 grid-cols-2 gap-2",
                                children: [
                                  jsxq_.jsx(runtime.PropertyNumberInput, {
                                    "aria-label": "Line height",
                                    title: "Line height",
                                    prefix: jsxq_.jsx(runtime.PropertyIcon, {
                                      icon: runtime.LINE_HEIGHT_ICON,
                                    }),
                                    mixed: callback(
                                      (source) =>
                                        source.kind === "text"
                                          ? (0, runtime.nodeTypographyCombo)(
                                              source,
                                              value42,
                                            ).lineHeight
                                          : null,
                                    ),
                                    value: callback(
                                      (source) =>
                                        source.kind === "text"
                                          ? (0, runtime.nodeTypographyCombo)(
                                              source,
                                              value42,
                                            ).lineHeight
                                          : null,
                                    )
                                      ? undefined
                                      : style?.lineHeight,
                                    placeholder: String(value54.lineHeight),
                                    min: 0.5,
                                    max: 4,
                                    step: 0.05,
                                    clearable: true,
                                    steppers: false,
                                    onValue: (input: number | undefined): void =>
                                      callback13(
                                        (source) => {
                                          if (source.kind !== "text") {
                                            return source;
                                          }
                                          if (input !== undefined) {
                                            return (0, runtime.patchNodeStyle)(
                                              source,
                                              {
                                                lineHeight: input,
                                              },
                                            );
                                          }
                                          let value63 =
                                            callback27(source)?.lineHeight;
                                          return (0, runtime.patchNodeStyle)(
                                            source,
                                            {
                                              lineHeight:
                                                value63 ===
                                                (0, runtime.typeScaleForRole)(
                                                  source.role,
                                                  value42,
                                                ).lineHeight
                                                  ? undefined
                                                  : value63,
                                            },
                                          );
                                        },
                                      ),
                                    onScrub: (input: number): void =>
                                      callback14(
                                        (source) =>
                                          source.kind === "text"
                                            ? (0, runtime.patchNodeStyle)(
                                                source,
                                                {
                                                  lineHeight: input,
                                                },
                                              )
                                            : source,
                                      ),
                                    onScrubEnd: callback7,
                                  }),
                                  jsxq_.jsx(runtime.PropertyNumberInput, {
                                    "aria-label": "Letter spacing",
                                    title: "Letter spacing (px)",
                                    prefix: jsxq_.jsx(runtime.PropertyIcon, {
                                      icon: "LetterSpacing",
                                    }),
                                    mixed: callback(
                                      (source) =>
                                        source.kind === "text"
                                          ? (0, runtime.nodeTypographyCombo)(
                                              source,
                                              value42,
                                            ).letterSpacing
                                          : null,
                                    ),
                                    value: callback(
                                      (source) =>
                                        source.kind === "text"
                                          ? (0, runtime.nodeTypographyCombo)(
                                              source,
                                              value42,
                                            ).letterSpacing
                                          : null,
                                    )
                                      ? undefined
                                      : style?.letterSpacing,
                                    placeholder: String(value54.letterSpacing),
                                    min: -24,
                                    max: 32,
                                    step: 0.5,
                                    clearable: true,
                                    steppers: false,
                                    onValue: (input: number | undefined): void =>
                                      callback13(
                                        (source) =>
                                          source.kind === "text"
                                            ? (0, runtime.patchNodeStyle)(
                                                source,
                                                {
                                                  letterSpacing: input,
                                                },
                                              )
                                            : source,
                                      ),
                                    onScrub: (input: number): void =>
                                      callback14(
                                        (source) =>
                                          source.kind === "text"
                                            ? (0, runtime.patchNodeStyle)(
                                                source,
                                                {
                                                  letterSpacing: input,
                                                },
                                              )
                                            : source,
                                      ),
                                    onScrubEnd: callback7,
                                  }),
                                ],
                              }),
                            }),
                          ],
                        })
                      : null,
                    jsxq_.jsx(
                      TextFillPropertyRow,
                      {
                        editsAreUndoSteps: editsAreUndoSteps,
                        node: value19,
                        slideBg: slide.bg,
                        swatches: value.rows,
                        contrast: (0, runtime.selectionContrastBackground)(
                          slide,
                          value3,
                          value42,
                          runtime.TEXT_CONTRAST_NODE_KINDS,
                        ),
                        colorMixed: callback(
                          (source) =>
                            source.kind === "text"
                              ? (source.color ?? null)
                              : null,
                        ),
                        fillMixed: callback(
                          (source) =>
                            source.kind === "text"
                              ? JSON.stringify(source.fill ?? null)
                              : null,
                        ),
                        updateNodes: callback13,
                        liveUpdateNodes: callback14,
                        end: callback7,
                        pickImage: pickImage,
                      },
                      value13 + ":textfill",
                    ),
                    value58 !== undefined ||
                    value59 ||
                    callback8("text:emphasis")
                      ? jsxq_.jsx("div", {
                          className: "contents",
                          onClickCapture: propertyRemovalMouseHandler,
                          children: jsxq_.jsxs(runtime.PropertyRow, {
                            label: "Emphasis",
                            children: [
                              jsxq_.jsxs(runtime.ButtonGroup, {
                                "aria-label": "Emphasis",
                                variant: "joined",
                                buttonVariant: "secondary",
                                children: [
                                  jsxq_.jsx(runtime.Button, {
                                    iconOnly: true,
                                    icon: "TextUnderline",
                                    "aria-label": "Underline",
                                    pressed:
                                      !value59 && value58 === "underline",
                                    onClick: (): void =>
                                      callback30("underline"),
                                  }),
                                  jsxq_.jsx(runtime.Button, {
                                    iconOnly: true,
                                    icon: jsxq_.jsx("span", {
                                      "aria-hidden": true,
                                      style: {
                                        fontSize: 13,
                                        lineHeight: 1,
                                        textDecoration: "line-through",
                                      },
                                      children: "S",
                                    }),
                                    "aria-label": "Strikethrough",
                                    pressed:
                                      !value59 && value58 === "line-through",
                                    onClick: (): void =>
                                      callback30("line-through"),
                                  }),
                                ],
                              }),
                              value59
                                ? jsxq_.jsx("span", {
                                    className:
                                      "ml-2 self-center text-caption text-muted",
                                    children: "Mixed",
                                  })
                                : null,
                            ],
                          }),
                        })
                      : null,
                    value19.list !== undefined ||
                    value60 ||
                    callback8("text:list")
                      ? jsxq_.jsx("div", {
                          className: "contents",
                          onClickCapture: propertyRemovalMouseHandler,
                          onKeyDownCapture: propertyRemovalKeyHandler,
                          children: jsxq_.jsx(runtime.SegmentedPropertyRow, {
                            label: "List",
                            "data-testid": "sl-text-list",
                            mixed: value60,
                            options: runtime.TEXT_LIST_OPTIONS,
                            value: value19.list ?? "none",
                            onReset:
                              value19.list !== undefined || value60
                                ? (): void =>
                                    callback13(
                                      (source) =>
                                        source.kind === "text"
                                          ? (0, runtime.setNodeList)(
                                              source,
                                              undefined,
                                            )
                                          : source,
                                    )
                                : undefined,
                            onChange: (input: "none" | "bullet" | "number"): void =>
                              callback13(
                                (source) =>
                                  source.kind === "text"
                                    ? (0, runtime.setNodeList)(
                                        source,
                                        input === "none" ? undefined : input,
                                      )
                                    : source,
                              ),
                          }),
                        })
                      : null,
                    jsxq_.jsx(runtime.SegmentedPropertyRow, {
                      label: "Align",
                      mixed: callback(
                        (source) =>
                          source.kind === "text"
                            ? (source.align ?? "start")
                            : null,
                      ),
                      options: [
                        {
                          value: "start",
                          label: "Left",
                          glyph: runtime.TEXT_ALIGN_LEFT_ICON,
                        },
                        {
                          value: "center",
                          label: "Center",
                          glyph: runtime.TEXT_ALIGN_CENTER_ICON,
                        },
                        {
                          value: "end",
                          label: "Right",
                          glyph: runtime.TEXT_ALIGN_RIGHT_ICON,
                        },
                        {
                          value: "justify",
                          label: "Justify",
                          glyph: runtime.TEXT_ALIGN_JUSTIFY_ICON,
                        },
                      ],
                      value: value19.align,
                      inherited: "start",
                      onReset:
                        value19.align !== undefined
                          ? (): void =>
                              callback13((source) => {
                                if (source.kind !== "text") {
                                  return source;
                                }
                                let state = {
                                  ...source,
                                };
                                delete state.align;
                                return state;
                              })
                          : undefined,
                      onChange: (input: TextAlignment): void =>
                        callback13((source) => {
                          if (source.kind !== "text") {
                            return source;
                          }
                          let state = {
                            ...source,
                          };
                          if (input === "start") {
                            delete state.align;
                          } else {
                            state.align = input;
                          }
                          return state;
                        }),
                    }),
                    style?.textTransform !== undefined ||
                    callback8("text:textTransform")
                      ? jsxq_.jsx("div", {
                          className: "contents",
                          onClickCapture: propertyRemovalMouseHandler,
                          children: jsxq_.jsx(runtime.SelectPropertyRow, {
                            label: "Case",
                            options: [
                              {
                                value: "none",
                                label: "None",
                              },
                              {
                                value: "uppercase",
                                label: "Uppercase",
                              },
                              {
                                value: "lowercase",
                                label: "Lowercase",
                              },
                              {
                                value: "capitalize",
                                label: "Capitalize",
                              },
                            ],
                            value: style?.textTransform ?? "",
                            placeholder: "None",
                            onReset:
                              style?.textTransform !== undefined
                                ? (): void =>
                                    callback13(
                                      (source) =>
                                        source.kind === "text"
                                          ? (0, runtime.patchNodeStyle)(
                                              source,
                                              {
                                                textTransform: undefined,
                                              },
                                            )
                                          : source,
                                    )
                                : undefined,
                            onChange: (input: TextTransformValue): void =>
                              callback13(
                                (source) =>
                                  source.kind === "text"
                                    ? (0, runtime.patchNodeStyle)(source, {
                                        textTransform:
                                          input === "none" ? undefined : input,
                                      })
                                    : source,
                              ),
                          }),
                        })
                      : null,
                    jsxq_.jsx(TextResizePropertyRow, {
                      nodes: value3.map(
                        (input) =>
                          (0, runtime.selectedNode)(slide, input),
                      ),
                      updateNodes: callback13,
                    }),
                  ],
                });
              })(),
            })
          : null,
        value19.kind === "text" && value7 === "text" && value20 !== undefined
          ? jsxq_.jsx(runtime.PropertySection, {
              title: "Appearance",
              iconColumn: true,
              children: value36,
            })
          : null,
        value20 !== undefined
          ? jsxq_.jsx(
              runtime.StyleEffectsInspector,
              {
                kind: value20,
                bag: value19.style,
                shadowTarget: value37,
                dropShadowDisabledReason: value38,
                swatches: value.rows,
                mixedKeys: value31,
                unifiedColorPopover: true,
                silhouette: value3.some((input) => {
                  let value42 = (0, runtime.selectedNode)(
                    slide,
                    input,
                  );
                  return (
                    value42 !== undefined && isDecorativePolygonShape(value42)
                  );
                }),
                onCommit: (input: StyleBag | undefined, options: StylePatch): void =>
                  callback13(
                    (input2) =>
                      videoPlayerAt(input2) !== undefined
                        ? (0, runtime.patchNodeStyle)(input2, options)
                        : input2,
                  ),
                onLive: (input: StyleBag | undefined, options: StylePatch): void =>
                  callback14(
                    (input2) =>
                      videoPlayerAt(input2) !== undefined
                        ? (0, runtime.patchNodeStyle)(input2, options)
                        : input2,
                  ),
                onLiveEnd: callback7,
              },
              value13,
            )
          : null,
        value20 !== undefined || value8 !== undefined
          ? jsxq_.jsxs(runtime.PropertySection, {
              title: "Advanced",
              collapsed: !value11,
              onToggle: (): void =>
                value12((input) => !input),
              children: [
                value8 !== undefined
                  ? jsxq_.jsxs(runtime.PropertySection, {
                      title: "Sizing",
                      subsection: true,
                      children: [
                        value5.place?.alignSelf !== undefined
                          ? jsxq_.jsx("div", {
                              className: "contents",
                              onClickCapture: propertyRemovalMouseHandler,
                              children: jsxq_.jsx(runtime.SelectPropertyRow, {
                                label: "Align self",
                                options: STACK_CHILD_ALIGN_OPTIONS,
                                value: value5.place.alignSelf,
                                onReset: (): void =>
                                  callback4({
                                    alignSelf: undefined,
                                  }),
                                onChange: (input: "auto" | ContainerAlignment): void =>
                                  callback4({
                                    alignSelf:
                                      input === "auto" ? undefined : input,
                                  }),
                              }),
                            })
                          : null,
                        value5.place?.justifySelf !== undefined
                          ? jsxq_.jsx("div", {
                              className: "contents",
                              onClickCapture: propertyRemovalMouseHandler,
                              children: jsxq_.jsx(runtime.SelectPropertyRow, {
                                label: "Justify self",
                                options: GRID_CHILD_ALIGN_OPTIONS,
                                value: value5.place.justifySelf,
                                onReset: (): void =>
                                  callback4({
                                    justifySelf: undefined,
                                  }),
                                onChange: (input: "auto" | "start" | "center" | "end" | "stretch"): void =>
                                  callback4({
                                    justifySelf:
                                      input === "auto" ? undefined : input,
                                  }),
                              }),
                            })
                          : null,
                        jsxq_.jsx(runtime.NumberPropertyRow, {
                          label: "Grow",
                          title:
                            "Share of leftover space along the group's direction. Grow 1 with Basis 0 on each sibling makes equal columns.",
                          value: value5.place?.grow,
                          min: 0,
                          max: 100,
                          step: 1,
                          clearable: true,
                          placeholder: "0",
                          onValue: (input: number | undefined): void =>
                            callback4({
                              grow: input,
                            }),
                          onScrub: (input: number): void =>
                            callback5({
                              grow: input,
                            }),
                          onScrubEnd: callback7,
                        }),
                        jsxq_.jsx(runtime.NumberPropertyRow, {
                          label: "Shrink",
                          title:
                            "How readily this child gives up space when the group overflows (CSS default 1).",
                          value: value5.place?.shrink,
                          min: 0,
                          max: 100,
                          step: 1,
                          clearable: true,
                          placeholder: "1",
                          onValue: (input: number | undefined): void =>
                            callback4({
                              shrink: input,
                            }),
                          onScrub: (input: number): void =>
                            callback5({
                              shrink: input,
                            }),
                          onScrubEnd: callback7,
                        }),
                        jsxq_.jsx(runtime.NumberPropertyRow, {
                          label: "Basis",
                          title:
                            "Starting main-axis size in design px, before grow and shrink (clear = content size).",
                          value: value5.place?.basis,
                          min: 0,
                          max: 4096,
                          step: 8,
                          clearable: true,
                          placeholder: "auto",
                          onValue: (input: number | undefined): void =>
                            callback4({
                              basis: input,
                            }),
                          onScrub: (input: number): void =>
                            callback5({
                              basis: input,
                            }),
                          onScrubEnd: callback7,
                        }),
                        jsxq_.jsx(runtime.NumberPropertyRow, {
                          label: "Aspect",
                          title:
                            value5.kind === "table"
                              ? TABLE_HEIGHT_REASON
                              : "Width ÷ height this child keeps (for example 1.78 for 16:9); clear to size freely.",
                          disabled: value5.kind === "table",
                          value: value5.place?.aspect,
                          min: 0.05,
                          max: 20,
                          step: 0.1,
                          clearable: true,
                          placeholder: "auto",
                          onValue: (input: number | undefined): void =>
                            callback4({
                              aspect: input,
                            }),
                          onScrub: (input: number): void =>
                            callback5({
                              aspect: input,
                            }),
                          onScrubEnd: callback7,
                        }),
                      ],
                    })
                  : null,
                value20 !== undefined
                  ? jsxq_.jsx(
                      runtime.StyleInspector,
                      {
                        kind: value20,
                        nested: true,
                        effectsLifted: true,
                        hiddenKeys: values,
                        disabledKeys: value39,
                        bag: value19.style,
                        swatches: value.rows,
                        mixedKeys: value31,
                        unifiedColorPopover: true,
                        onCommit: (
                          input: StyleBag | undefined,
                          options: StylePatch,
                        ): void =>
                          callback13(
                            (input2) =>
                              videoPlayerAt(input2) !== undefined
                                ? (0, runtime.patchNodeStyle)(input2, options)
                                : input2,
                          ),
                        onLive: (input: StyleBag | undefined, options: StylePatch): void =>
                          callback14(
                            (input2) =>
                              videoPlayerAt(input2) !== undefined
                                ? (0, runtime.patchNodeStyle)(input2, options)
                                : input2,
                          ),
                        onLiveEnd: callback7,
                      },
                      value13,
                    )
                  : null,
              ],
            })
          : null,
        jsxq_.jsx(runtime.ScrollbarOverlay, {}),
      ],
    });
  }
  bindRuntimeValue(
    runtime,
    "jsxq_",
    () => jsxq_,
    (value) => {
      jsxq_ = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TABLE_HEIGHT_REASON",
    () => TABLE_HEIGHT_REASON,
    (value) => {
      TABLE_HEIGHT_REASON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "TEXT_SHADOW_FILL_REASON",
    () => TEXT_SHADOW_FILL_REASON,
    (value) => {
      TEXT_SHADOW_FILL_REASON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isTransparentStyleColor",
    () => isTransparentStyleColor,
  );
  bindRuntimeValue(
    runtime,
    "LINE_DASH_REASON",
    () => LINE_DASH_REASON,
    (value) => {
      LINE_DASH_REASON = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ZERO_SIDE_PLACEHOLDERS",
    () => ZERO_SIDE_PLACEHOLDERS,
    (value) => {
      ZERO_SIDE_PLACEHOLDERS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SIDE_INDEXES",
    () => SIDE_INDEXES,
    (value) => {
      SIDE_INDEXES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EMPTY_SIDE_VALUES",
    () => EMPTY_SIDE_VALUES,
    (value) => {
      EMPTY_SIDE_VALUES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "anchorSizePatch",
    () => anchorSizePatch,
    (value) => {
      anchorSizePatch = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "STACK_CHILD_ALIGN_OPTIONS",
    () => STACK_CHILD_ALIGN_OPTIONS,
    (value) => {
      STACK_CHILD_ALIGN_OPTIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GRID_CHILD_ALIGN_OPTIONS",
    () => GRID_CHILD_ALIGN_OPTIONS,
    (value) => {
      GRID_CHILD_ALIGN_OPTIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "GridTracksPropertyRows",
    () => GridTracksPropertyRows,
  );
  bindRuntimeValue(runtime, "videoPlayerAt", () => videoPlayerAt);
  bindRuntimeValue(runtime, "imagePropertyLabel", () => imagePropertyLabel);
  bindRuntimeValue(
    runtime,
    "VideoProgressPropertyRow",
    () => VideoProgressPropertyRow,
  );
  bindRuntimeValue(
    runtime,
    "focusPropertyRowControl",
    () => focusPropertyRowControl,
  );
  bindRuntimeValue(
    runtime,
    "PROPERTY_ROW_FOCUS_SELECTOR",
    () => PROPERTY_ROW_FOCUS_SELECTOR,
    (value) => {
      PROPERTY_ROW_FOCUS_SELECTOR = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "adjacentPropertyRowControl",
    () => adjacentPropertyRowControl,
  );
  bindRuntimeValue(
    runtime,
    "suppressRepeatedKeyAfterRemoval",
    () => suppressRepeatedKeyAfterRemoval,
  );
  bindRuntimeValue(
    runtime,
    "focusAfterPropertyRemoval",
    () => focusAfterPropertyRemoval,
  );
  bindRuntimeValue(
    runtime,
    "propertyRemovalMouseHandler",
    () => propertyRemovalMouseHandler,
  );
  bindRuntimeValue(
    runtime,
    "propertyRemovalKeyHandler",
    () => propertyRemovalKeyHandler,
  );
  bindRuntimeValue(
    runtime,
    "MediaAssetPropertyRow",
    () => MediaAssetPropertyRow,
  );
  bindRuntimeValue(
    runtime,
    "CONNECTOR_END_CHOICES",
    () => CONNECTOR_END_CHOICES,
    (value) => {
      CONNECTOR_END_CHOICES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CONNECTOR_ARROW_OPTIONS",
    () => CONNECTOR_ARROW_OPTIONS,
    (value) => {
      CONNECTOR_ARROW_OPTIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CONNECTOR_ROUTE_OPTIONS",
    () => CONNECTOR_ROUTE_OPTIONS,
    (value) => {
      CONNECTOR_ROUTE_OPTIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CONNECTOR_STROKE_OPTIONS",
    () => CONNECTOR_STROKE_OPTIONS,
    (value) => {
      CONNECTOR_STROKE_OPTIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CONNECTOR_DIRECTION_OPTIONS",
    () => CONNECTOR_DIRECTION_OPTIONS,
    (value) => {
      CONNECTOR_DIRECTION_OPTIONS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SLIDE_TRANSITION_OPTIONS",
    () => SLIDE_TRANSITION_OPTIONS,
    (value) => {
      SLIDE_TRANSITION_OPTIONS = value;
    },
  );
  bindRuntimeValue(runtime, "FillPropertyRow", () => FillPropertyRow);
  bindRuntimeValue(runtime, "useFillEditor", () => useFillEditor);
  bindRuntimeValue(runtime, "TextFillPropertyRow", () => TextFillPropertyRow);
  bindRuntimeValue(runtime, "defaultFillGradient", () => defaultFillGradient);
  bindRuntimeValue(runtime, "mixHexColors", () => mixHexColors);
  bindRuntimeValue(
    runtime,
    "ConnectorEndsPropertyRows",
    () => ConnectorEndsPropertyRows,
  );
  bindRuntimeValue(
    runtime,
    "TextResizePropertyRow",
    () => TextResizePropertyRow,
  );
  bindRuntimeValue(
    runtime,
    "isNonConnectorShape",
    () => isNonConnectorShape,
    (value) => {
      isNonConnectorShape = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isDecorativePolygonShape",
    () => isDecorativePolygonShape,
    (value) => {
      isDecorativePolygonShape = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizedHexRgba",
    () => normalizedHexRgba,
    (value) => {
      normalizedHexRgba = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isDefaultShapeFill",
    () => isDefaultShapeFill,
    (value) => {
      isDefaultShapeFill = value;
    },
  );
  bindRuntimeValue(runtime, "SelectionInspector", () => SelectionInspector);
  return () => {
    (0, runtime.initializeUiInspectorIcons)();
    (0, runtime.initializeStyleSchema)();
    jsxq_ = (0, runtime.toModuleNamespace)((0, runtime.loadJsxNamespace)(), 1);
    TABLE_HEIGHT_REASON = "A table is as tall as its rows";
    TEXT_SHADOW_FILL_REASON =
      "A shadow would paint over gradient or image text — switch Color back to a plain colour to use one";
    LINE_DASH_REASON = "A line is solid (a connector can dash)";
    ZERO_SIDE_PLACEHOLDERS = ["0", "0", "0", "0"];
    SIDE_INDEXES = [0, 1, 2, 3];
    EMPTY_SIDE_VALUES = SIDE_INDEXES.map(
      (input) => ({
        side: input,
        value: undefined,
      }),
    );
    anchorSizePatch =
      (size) =>
      (input) => {
        let state = {
          ...input,
        };
        if (size === undefined) {
          delete state.size;
        } else {
          state.size = size;
        }
        return state;
      };
    STACK_CHILD_ALIGN_OPTIONS = [
      {
        value: "auto",
        label: "Auto (group)",
      },
      {
        value: "start",
        label: "Start",
      },
      {
        value: "center",
        label: "Middle",
      },
      {
        value: "end",
        label: "End",
      },
      {
        value: "stretch",
        label: "Stretch",
      },
      {
        value: "baseline",
        label: "Baseline",
      },
    ];
    GRID_CHILD_ALIGN_OPTIONS = [
      {
        value: "auto",
        label: "Auto (grid)",
      },
      {
        value: "start",
        label: "Start",
      },
      {
        value: "center",
        label: "Center",
      },
      {
        value: "end",
        label: "End",
      },
      {
        value: "stretch",
        label: "Stretch",
      },
    ];
    PROPERTY_ROW_FOCUS_SELECTOR =
      'input:not([tabindex="-1"]):not([type="file"]), button:not([tabindex="-1"]):not([data-kit="row-reset"])';
    CONNECTOR_END_CHOICES = [
      {
        which: "start",
        label: "Start",
      },
      {
        which: "end",
        label: "End",
      },
    ];
    CONNECTOR_ARROW_OPTIONS = [
      {
        value: "none",
        label: "None",
      },
      {
        value: "open",
        label: "Open",
      },
      {
        value: "filled",
        label: "Filled",
      },
    ];
    CONNECTOR_ROUTE_OPTIONS = [
      {
        value: "straight",
        label: "Straight",
      },
      {
        value: "elbow",
        label: "Elbow",
      },
      {
        value: "hv",
        label: "Bend: across, then down",
      },
      {
        value: "vh",
        label: "Bend: down, then across",
      },
    ];
    CONNECTOR_STROKE_OPTIONS = [
      {
        value: "solid",
        label: "Solid",
      },
      {
        value: "dashed",
        label: "Dashed",
      },
    ];
    CONNECTOR_DIRECTION_OPTIONS = [
      {
        value: "tl",
        label: "Down-right",
      },
      {
        value: "tr",
        label: "Down-left",
      },
      {
        value: "bl",
        label: "Up-right",
      },
      {
        value: "br",
        label: "Up-left",
      },
    ];
    SLIDE_TRANSITION_OPTIONS = [
      {
        value: "none",
        label: runtime.slideTransitionLabels.none,
      },
      ...runtime.slideTransitionValues.map(
        (input) => ({
          value: input,
          label: runtime.slideTransitionLabels[input],
        }),
      ),
    ];
    isNonConnectorShape = (node) =>
      node.kind === "shape" && node.shape !== "connector";
    isDecorativePolygonShape = (node) =>
      node.kind === "shape" &&
      node.shape !== "connector" &&
      node.shape !== "rect" &&
      node.shape !== "ellipse" &&
      node.shape !== "line";
    normalizedHexRgba = (hex) => {
      let value = hex.slice(1).toLowerCase();
      if (value.length === 3 || value.length === 4) {
        value = [...value]
          .map((input) => input + input)
          .join("");
      }
      if (value.length === 6) {
        return value + "ff";
      } else {
        return value;
      }
    };
    isDefaultShapeFill = (color) => {
      let value = (0, runtime.resolveSlideColor)(color);
      return (
        value !== undefined &&
        normalizedHexRgba(value) ===
          normalizedHexRgba((0, runtime.themeAccentColor)())
      );
    };
  };
}
