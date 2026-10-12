/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { HostCommentLabels } from "../../../slides/src/editor/slides-host";
import type { Frame, Slide, SlideNode, TextNode } from "../deck-contracts";
import type { TypographyStyle, TypographyTheme } from "../model/typography";

/** Address of a table cell (row, column). */
export interface CommentTableCell {
  r: number;
  c: number;
}
/** A table cell address together with the text found in that cell. */
export interface CommentTableCellText extends CommentTableCell {
  text: string;
}
/** Locates a node: the frame id plus the child-index path from the frame's root node. */
export interface CommentNodeRef {
  frameId: string;
  path: number[];
}
/** What a frame comment points at: the whole slide, or a node of a frame (with an optional table cell). */
export type CommentLabelAnchor =
  | { kind: "slide" }
  | ({ kind: "frame"; cell?: CommentTableCell | undefined } & CommentNodeRef);
/** The region a marquee comment covers: its position on the slide and the nodes it touches. */
export interface CommentAreaDescription {
  /** Short English phrase such as `top left`; empty when the area covers the whole slide. */
  part: string;
  /** The single node the area sits inside, if any. */
  within: CommentNodeRef | null;
  covered: CommentNodeRef[];
}
/** The words used for a node in a comment label: its kind and the text shown after it. */
export interface CommentNodeDescription {
  kind: string;
  text: string | undefined;
}
/** The label people see and the detail the agent reads for one comment anchor. */
export interface CommentAnchorDescription {
  label: string;
  detail: string;
}

declare module "../bindings" {
  interface RuntimeBindings {
    COMMENT_LABEL_MAX_UTF8_BYTES: number;
    COMMENT_DETAIL_MAX_UTF8_BYTES: number;
    COMMENT_LABEL_MAX_CODEPOINTS: number;
    commentLabelTextEncoder: TextEncoder;
    commentLabelByteLength: (text: string) => number;
    replaceUnpairedSurrogates: (text: string) => string;
    normalizeCommentLabelText: (text?: string, maxChars?: number) => string;
    quoteCommentLabelText: (text: string) => string;
    truncateCommentLabelToBytes: (text: string, maxBytes: number) => string;
    COMMENT_LABEL_BREADCRUMB: string;
    COMMENT_AREA_MAX_DESCRIBED_ELEMENTS: number;
    COMMENT_DETAIL_MAX_CODEPOINTS: number;
    slideDiagnosticIdSuffix: (slide: Slide) => string;
    getTextNodeRoleLabel: (
      node: TextNode,
      typeStyles?: TypographyStyle[],
    ) => string;
    describeCommentNode: (
      node: SlideNode,
      typeStyles?: TypographyStyle[],
    ) => CommentNodeDescription;
    formatFrameCommentLabel: (
      slideNumber: number,
      slide: Slide,
      anchor: CommentLabelAnchor,
      typeStyles?: TypographyStyle[],
    ) => string;
    formatFrameCommentDetail: (
      slideNumber: number,
      slide: Slide,
      anchor: CommentLabelAnchor,
    ) => string;
    getCommentTableCellText: (
      node: SlideNode | undefined,
      cell: CommentTableCell | undefined,
    ) => CommentTableCellText | undefined;
    describeFrameCommentAnchor: (
      slideNumber: number,
      slide: Slide,
      anchor: CommentLabelAnchor,
      typeStyles?: TypographyStyle[],
    ) => CommentAnchorDescription;
    parenthesizeCommentAreaPart: (part: string) => string;
    describeAreaCommentAnchor: (
      slideNumber: number,
      slide: Slide,
      area: CommentAreaDescription,
      typeStyles?: TypographyStyle[],
    ) => string;
    formatAreaCommentDetail: (
      slideNumber: number,
      slide: Slide,
      area: CommentAreaDescription,
    ) => string;
    resolveCommentNode: (
      slide: Slide,
      target: CommentNodeRef,
    ) => SlideNode | undefined;
    getCommentNodeText: (node: SlideNode) => string | undefined;
    buildCommentLabel: (
      prefix: string,
      kindSuffix: string,
      text: string,
      detailSuffix?: string,
      maxBytes?: number,
    ) => string;
  }
}

export function installCommentsLabels(runtime: RuntimeBindings): () => void {
  var COMMENT_LABEL_MAX_UTF8_BYTES: number;
  var COMMENT_DETAIL_MAX_UTF8_BYTES: number;
  var COMMENT_LABEL_MAX_CODEPOINTS: number;
  var commentLabelTextEncoder: TextEncoder;
  var commentLabelByteLength: (text: string) => number;
  var quoteCommentLabelText: (text: string) => string;
  var COMMENT_LABEL_BREADCRUMB: string;
  var COMMENT_AREA_MAX_DESCRIBED_ELEMENTS: number;
  var COMMENT_DETAIL_MAX_CODEPOINTS: number;
  var slideDiagnosticIdSuffix: (slide: Slide) => string;
  var parenthesizeCommentAreaPart: (part: string) => string;
  function replaceUnpairedSurrogates(text: string): string {
    return text.replace(
      /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,
      String.fromCharCode(65533),
    );
  }
  function normalizeCommentLabelText(
    text?: string,
    maxChars: number = 40,
  ): string {
    let characters = Array.from(
      replaceUnpairedSurrogates(text ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .replace(/"/g, "’"),
    );
    if (characters.length <= maxChars) {
      return characters.join("");
    } else {
      return (
        characters
          .slice(0, Math.max(0, maxChars - 1))
          .join("")
          .trimEnd() + "…"
      );
    }
  }
  function truncateCommentLabelToBytes(
    text: string,
    maxBytes: number,
  ): string {
    if (commentLabelByteLength(text) <= maxBytes) {
      return text;
    }
    let characters = Array.from(text),
      length = characters.length;
    while (
      length > 0 &&
      commentLabelByteLength(
        characters.slice(0, length).join("").trimEnd() + "…",
      ) > maxBytes
    )
      length--;
    return characters.slice(0, length).join("").trimEnd() + "…";
  }
  // CucCut: the host can localise the words in the location label people see (`slidesHost.commentLabels`, in
  // CucCut's UI language); `detail` is for the agent and stays English. Anything the host leaves out stays English.
  function localizedCommentLabel<K extends keyof HostCommentLabels>(
    key: K,
    fallback: string,
    ...args: Parameters<HostCommentLabels[K]>
  ): string {
    let labels = globalThis.slidesHost?.commentLabels as
        | Partial<
            Record<K, (...args: Parameters<HostCommentLabels[K]>) => unknown>
          >
        | undefined,
      value: unknown =
        typeof labels?.[key] === "function" ? labels[key](...args) : undefined;
    return typeof value === "string" && value !== "" ? value : fallback;
  }
  function getTextNodeRoleLabel(
    node: TextNode,
    typeStyles?: TypographyStyle[],
  ): string {
    let theme: TypographyTheme = (0, runtime.getRenderingTheme)(),
      style = (0, runtime.findExactTypographyStyle)(
        node,
        typeStyles ?? (0, runtime.systemTypographyStyles)(theme),
        theme,
      ),
      role = style?.role ?? node.role,
      name = style?.name ?? runtime.textRoleLabels[node.role];
    // Styles named after their role are the runtime's own; a deck's or design system's style names stay as written.
    return name === runtime.textRoleLabels[role]
      ? localizedCommentLabel("textRole", name, role)
      : name;
  }
  function describeCommentElementKind(
    node: SlideNode,
    fallback: string,
  ): string {
    return localizedCommentLabel(
      "element",
      fallback,
      node.kind === "shape"
        ? { kind: node.kind, shape: node.shape }
        : node.kind === "table"
          ? { kind: node.kind, rows: node.rows.length, cols: node.cols }
          : { kind: node.kind },
    );
  }
  function describeCommentNode(
    node: SlideNode,
    typeStyles?: TypographyStyle[],
  ): CommentNodeDescription {
    switch (node.kind) {
      case "text":
        return {
          kind: getTextNodeRoleLabel(node, typeStyles),
          text: node.text,
        };
      case "img":
        return {
          kind: describeCommentElementKind(node, "Image"),
          text: node.alt,
        };
      case "icon":
        return {
          kind: describeCommentElementKind(node, "Icon"),
          text: node.icon,
        };
      case "stack":
        return {
          kind: describeCommentElementKind(node, "Group"),
          text: (0, runtime.nodeTextLabel)(node),
        };
      case "grid":
        return {
          kind: describeCommentElementKind(node, "Grid"),
          text: (0, runtime.nodeTextLabel)(node),
        };
      case "overlay":
        return {
          kind: describeCommentElementKind(node, "Overlay"),
          text: (0, runtime.nodeTextLabel)(node),
        };
      case "shape":
      case "html":
      case "table":
      case "spacer":
        return {
          kind: describeCommentElementKind(
            node,
            (0, runtime.nodeDisplayLabel)(node),
          ),
          text: undefined,
        };
    }
  }
  function formatFrameCommentLabel(
    slideNumber: number,
    slide: Slide,
    anchor: CommentLabelAnchor,
    typeStyles?: TypographyStyle[],
  ): string {
    let prefix = localizedCommentLabel(
      "slide",
      "Slide " + String(slideNumber),
      slideNumber,
    );
    if (anchor.kind === "slide") {
      return buildCommentLabel(
        prefix,
        "",
        normalizeCommentLabelText((0, runtime.slideDisplayLabel)(slide)),
      );
    }
    let value = (0, runtime.frameById)(
      slide,
      anchor.frameId,
    );
    if (!value) {
      return prefix;
    }
    let value2 = (0, runtime.nodeAtPath)(
        value.node,
        anchor.path,
      ),
      value3 = describeCommentNode(value2 ?? value.node, typeStyles);
    return buildCommentLabel(
      prefix,
      COMMENT_LABEL_BREADCRUMB + value3.kind,
      normalizeCommentLabelText(
        getCommentTableCellText(value2, anchor.cell)?.text ?? value3.text,
      ),
    );
  }
  function formatFrameCommentDetail(
    slideNumber: number,
    slide: Slide,
    anchor: CommentLabelAnchor,
  ): string {
    let prefix =
      "Slide " + String(slideNumber) + slideDiagnosticIdSuffix(slide);
    if (anchor.kind === "slide") {
      return buildCommentLabel(
        prefix,
        "",
        normalizeCommentLabelText(
          (0, runtime.slideDisplayLabel)(slide),
          COMMENT_DETAIL_MAX_CODEPOINTS,
        ),
        "",
        COMMENT_DETAIL_MAX_UTF8_BYTES,
      );
    }
    let value = (0, runtime.frameById)(
      slide,
      anchor.frameId,
    );
    if (!value) {
      return prefix;
    }
    let value2 = (0, runtime.nodeAtPath)(
        value.node,
        anchor.path,
      ),
      value3 = value2 ?? value.node,
      value4 = value2 ? anchor.path : [],
      value5 = getCommentTableCellText(value2, anchor.cell),
      value6 = normalizeCommentLabelText(
        value5 ? value5.text : getCommentNodeText(value3),
        COMMENT_DETAIL_MAX_CODEPOINTS,
      ),
      callback = (input: number[]): string | undefined =>
        (0, runtime.normalizeObjectContextIds)([
          [anchor.frameId, ...input].join("/"),
        ])[0],
      value7 = callback(
        value5 ? [...value4, value5.r, value5.c] : value4,
      );
    if (value7 !== undefined) {
      return buildCommentLabel(
        prefix,
        ": " + value7 + " " + (value5 ? "cell" : value3.kind),
        value6,
        "",
        COMMENT_DETAIL_MAX_UTF8_BYTES,
      );
    }
    let value8 = value5
      ? "cell " + String(value5.r) + "/" + String(value5.c)
      : value3.kind;
    for (let length = value4.length; length >= 0; length--) {
      let value9 = callback(value4.slice(0, length));
      if (value9 !== undefined) {
        return buildCommentLabel(
          prefix,
          ": " +
            value9 +
            " " +
            (
              (0, runtime.nodeAtPath)(value.node, value4.slice(0, length)) ??
              value.node
            ).kind +
            COMMENT_LABEL_BREADCRUMB +
            value8,
          value6,
          "",
          COMMENT_DETAIL_MAX_UTF8_BYTES,
        );
      }
    }
    return buildCommentLabel(
      prefix,
      ": " + value8,
      value6,
      "",
      COMMENT_DETAIL_MAX_UTF8_BYTES,
    );
  }
  function getCommentTableCellText(
    node: SlideNode | undefined,
    cell: CommentTableCell | undefined,
  ): CommentTableCellText | undefined {
    let text =
      cell && node?.kind === "table" ? node.rows[cell.r]?.[cell.c] : undefined;
    if (cell && text !== undefined) {
      return {
        ...cell,
        text: text,
      };
    } else {
      return undefined;
    }
  }
  function describeFrameCommentAnchor(
    slideNumber: number,
    slide: Slide,
    anchor: CommentLabelAnchor,
    typeStyles?: TypographyStyle[],
  ): CommentAnchorDescription {
    return {
      label: formatFrameCommentLabel(slideNumber, slide, anchor, typeStyles),
      detail: formatFrameCommentDetail(slideNumber, slide, anchor),
    };
  }
  function describeAreaCommentAnchor(
    slideNumber: number,
    slide: Slide,
    area: CommentAreaDescription,
    typeStyles?: TypographyStyle[],
  ): string {
    let value = localizedCommentLabel(
        "slide",
        "Slide " + String(slideNumber),
        slideNumber,
      ),
      value2 =
        area.covered.length === 0
          ? ""
          : localizedCommentLabel(
              "covered",
              " · " +
                String(area.covered.length) +
                (area.covered.length === 1 ? " element" : " elements"),
              area.covered.length,
            ),
      value3 =
        (area.part
          ? localizedCommentLabel(
              "areaPart",
              parenthesizeCommentAreaPart(area.part),
              area.part,
            )
          : "") + value2,
      value4 = area.within
        ? resolveCommentNode(slide, area.within)
        : undefined;
    if (!value4) {
      return value + value3;
    }
    let value5 = describeCommentNode(value4, typeStyles);
    return buildCommentLabel(
      value,
      COMMENT_LABEL_BREADCRUMB + value5.kind,
      normalizeCommentLabelText(value5.text),
      value3,
    );
  }
  function formatAreaCommentDetail(
    slideNumber: number,
    slide: Slide,
    area: CommentAreaDescription,
  ): string {
    let callback = (input: CommentNodeRef): string =>
        [input.frameId, ...input.path].join("/"),
      callback2 = (input: CommentNodeRef, options: number | null): string | null => {
        let value2 = resolveCommentNode(slide, input),
          [value3] = (0, runtime.normalizeObjectContextIds)([
            callback(input),
          ]);
        if (!value2 || value3 === undefined) {
          return null;
        }
        let value4 =
          options === null
            ? ""
            : normalizeCommentLabelText(getCommentNodeText(value2), options);
        return value3 + " " + value2.kind + quoteCommentLabelText(value4);
      },
      value = slideDiagnosticIdSuffix(slide),
      callback3 = (input: number | null, options: number): string => {
        let value2 = area.within
            ? callback2(area.within, input)
            : null,
          value3 =
            "Area on slide " +
            String(slideNumber) +
            value +
            (value2 !== null ? " in " + value2 : "") +
            " (" +
            (area.part || "whole") +
            ")",
          value4 = area.covered
            .slice(0, options)
            .map((input2) => callback2(input2, input))
            .filter((input2) => input2 !== null),
          value5 = area.covered.length - value4.length;
        if (value5 > 0) {
          value4.push("+" + String(value5) + " more");
        }
        return value3 + (value4.length > 0 ? ": " + value4.join(", ") : "");
      },
      items: [number | null, number][] = [
        [COMMENT_LABEL_MAX_CODEPOINTS, COMMENT_AREA_MAX_DESCRIBED_ELEMENTS],
        [16, COMMENT_AREA_MAX_DESCRIBED_ELEMENTS],
        [null, COMMENT_AREA_MAX_DESCRIBED_ELEMENTS],
        [null, 4],
        [null, 2],
        [null, 0],
      ];
    for (let [value2, value3] of items) {
      let value4 = callback3(value2, value3);
      if (commentLabelByteLength(value4) <= COMMENT_DETAIL_MAX_UTF8_BYTES) {
        return value4;
      }
    }
    return truncateCommentLabelToBytes(
      callback3(null, 0),
      COMMENT_DETAIL_MAX_UTF8_BYTES,
    );
  }
  function resolveCommentNode(
    slide: Slide,
    target: CommentNodeRef,
  ): SlideNode | undefined {
    let frame = (0, runtime.frameById)(
      slide,
      target.frameId,
    );
    if (frame) {
      return (0, runtime.nodeAtPath)(frame.node, target.path);
    } else {
      return undefined;
    }
  }
  function getCommentNodeText(node: SlideNode): string | undefined {
    switch (node.kind) {
      case "text":
        return node.text;
      case "img":
        return node.alt;
      case "icon":
        return node.icon;
      case "stack":
      case "grid":
      case "overlay":
        return (0, runtime.nodeTextLabel)(node);
      case "shape":
        return (0, runtime.nodeDisplayLabel)(node);
      case "table":
      case "html":
      case "spacer":
        return;
    }
  }
  function buildCommentLabel(
    prefix: string,
    kindSuffix: string,
    text: string,
    detailSuffix: string = "",
    maxBytes: number = COMMENT_LABEL_MAX_UTF8_BYTES,
  ): string {
    let label = prefix + kindSuffix,
      textBytes =
        maxBytes -
        commentLabelByteLength(label) -
        commentLabelByteLength(detailSuffix) -
        3;
    return (
      label +
      (textBytes >= 4
        ? quoteCommentLabelText(truncateCommentLabelToBytes(text, textBytes))
        : "") +
      detailSuffix
    );
  }
  bindRuntimeValue(
    runtime,
    "COMMENT_LABEL_MAX_UTF8_BYTES",
    () => COMMENT_LABEL_MAX_UTF8_BYTES,
    (value) => {
      COMMENT_LABEL_MAX_UTF8_BYTES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMMENT_DETAIL_MAX_UTF8_BYTES",
    () => COMMENT_DETAIL_MAX_UTF8_BYTES,
    (value) => {
      COMMENT_DETAIL_MAX_UTF8_BYTES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMMENT_LABEL_MAX_CODEPOINTS",
    () => COMMENT_LABEL_MAX_CODEPOINTS,
    (value) => {
      COMMENT_LABEL_MAX_CODEPOINTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "commentLabelTextEncoder",
    () => commentLabelTextEncoder,
    (value) => {
      commentLabelTextEncoder = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "commentLabelByteLength",
    () => commentLabelByteLength,
    (value) => {
      commentLabelByteLength = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "replaceUnpairedSurrogates",
    () => replaceUnpairedSurrogates,
  );
  bindRuntimeValue(
    runtime,
    "normalizeCommentLabelText",
    () => normalizeCommentLabelText,
  );
  bindRuntimeValue(
    runtime,
    "quoteCommentLabelText",
    () => quoteCommentLabelText,
    (value) => {
      quoteCommentLabelText = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "truncateCommentLabelToBytes",
    () => truncateCommentLabelToBytes,
  );
  bindRuntimeValue(
    runtime,
    "COMMENT_LABEL_BREADCRUMB",
    () => COMMENT_LABEL_BREADCRUMB,
    (value) => {
      COMMENT_LABEL_BREADCRUMB = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMMENT_AREA_MAX_DESCRIBED_ELEMENTS",
    () => COMMENT_AREA_MAX_DESCRIBED_ELEMENTS,
    (value) => {
      COMMENT_AREA_MAX_DESCRIBED_ELEMENTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMMENT_DETAIL_MAX_CODEPOINTS",
    () => COMMENT_DETAIL_MAX_CODEPOINTS,
    (value) => {
      COMMENT_DETAIL_MAX_CODEPOINTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slideDiagnosticIdSuffix",
    () => slideDiagnosticIdSuffix,
    (value) => {
      slideDiagnosticIdSuffix = value;
    },
  );
  bindRuntimeValue(runtime, "getTextNodeRoleLabel", () => getTextNodeRoleLabel);
  bindRuntimeValue(runtime, "describeCommentNode", () => describeCommentNode);
  bindRuntimeValue(
    runtime,
    "formatFrameCommentLabel",
    () => formatFrameCommentLabel,
  );
  bindRuntimeValue(
    runtime,
    "formatFrameCommentDetail",
    () => formatFrameCommentDetail,
  );
  bindRuntimeValue(
    runtime,
    "getCommentTableCellText",
    () => getCommentTableCellText,
  );
  bindRuntimeValue(
    runtime,
    "describeFrameCommentAnchor",
    () => describeFrameCommentAnchor,
  );
  bindRuntimeValue(
    runtime,
    "parenthesizeCommentAreaPart",
    () => parenthesizeCommentAreaPart,
    (value) => {
      parenthesizeCommentAreaPart = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "describeAreaCommentAnchor",
    () => describeAreaCommentAnchor,
  );
  bindRuntimeValue(
    runtime,
    "formatAreaCommentDetail",
    () => formatAreaCommentDetail,
  );
  bindRuntimeValue(runtime, "resolveCommentNode", () => resolveCommentNode);
  bindRuntimeValue(runtime, "getCommentNodeText", () => getCommentNodeText);
  bindRuntimeValue(runtime, "buildCommentLabel", () => buildCommentLabel);
  return () => {
    COMMENT_LABEL_MAX_UTF8_BYTES = 128;
    COMMENT_DETAIL_MAX_UTF8_BYTES = 512;
    COMMENT_LABEL_MAX_CODEPOINTS = 40;
    commentLabelTextEncoder = new TextEncoder();
    commentLabelByteLength = (input: string): number =>
      commentLabelTextEncoder.encode(input).length;
    quoteCommentLabelText = (input: string): string =>
      input ? ' "' + input + '"' : "";
    (0, runtime.initializeSlideModel)();
    (0, runtime.initializeModelEditing)();
    (0, runtime.initializeModelSelection)();
    (0, runtime.initializeRenderingTheme)();
    (0, runtime.initializeTypographyInference)();
    COMMENT_LABEL_BREADCRUMB = " › ";
    COMMENT_AREA_MAX_DESCRIBED_ELEMENTS = 8;
    COMMENT_DETAIL_MAX_CODEPOINTS = 300;
    slideDiagnosticIdSuffix = (input: Slide): string =>
      (0, runtime.frameContextId)(input.id) !== null ? " #" + input.id : "";
    parenthesizeCommentAreaPart = (part: string): string =>
      part ? " (" + part + ")" : "";
  };
}
