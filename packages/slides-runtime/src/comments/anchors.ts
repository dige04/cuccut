/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { Frame, Slide } from "../deck-contracts";

/**
 * A rectangle inside a host (a slide, a frame or a node) as fractions (0..1) of the host's width and height.
 * `corner` marks the pin corner of an area comment: 0 top-left, 1 top-right, 2 bottom-left, 3 bottom-right.
 */
export interface CommentAnchorBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  corner?: number;
}

/** A comment anchored to a point on the slide background. */
export interface CommentSlideAnchor {
  kind: "slide";
  slideId: string;
  fx: number;
  fy: number;
}
/** A comment anchored to a point of a frame, or of one of its nodes (`path` is the child-index path, empty for the frame itself). */
export interface CommentFrameAnchor {
  kind: "frame";
  slideId: string;
  frameId: string;
  path: number[];
  fx: number;
  fy: number;
}
/** A comment anchored to a marquee box; `frameId` is null when the box is relative to the whole slide. */
export interface CommentAreaAnchor {
  kind: "area";
  slideId: string;
  frameId: string | null;
  path: number[];
  box: CommentAnchorBox;
}
/** An anchor as the editor builds it, addressing the slide and frame by id. */
export type CommentAnchor =
  | CommentSlideAnchor
  | CommentFrameAnchor
  | CommentAreaAnchor;

/** The slide-background anchor read back from its string form (the slide is known only by its hash). */
export interface ParsedCommentSlideAnchor {
  kind: "slide";
  slideHash: string;
  fx: number;
  fy: number;
}
/** The frame anchor read back from its string form. */
export interface ParsedCommentFrameAnchor {
  kind: "frame";
  slideHash: string;
  frameHash: string;
  path: number[];
  fx: number;
  fy: number;
}
/** The area anchor read back from its string form; `frameHash` is null for a box relative to the whole slide. */
export interface ParsedCommentAreaAnchor {
  kind: "area";
  slideHash: string;
  frameHash: string | null;
  path: number[];
  box: CommentAnchorBox;
}
/** An anchor string read back by `parseSlideCommentAnchor`. */
export type ParsedCommentAnchor =
  | ParsedCommentSlideAnchor
  | ParsedCommentFrameAnchor
  | ParsedCommentAreaAnchor;
/** The parsed anchors that point into a frame or one of its nodes (everything but the slide background). */
export type ParsedCommentFrameTargetAnchor =
  | ParsedCommentFrameAnchor
  | ParsedCommentAreaAnchor;

/** The frame (by hash) and node path that a frame-level anchor string names. */
export interface CommentFramePath {
  frameHash: string;
  path: number[];
}

/** A comment thread as far as anchor counting is concerned. */
export interface CommentThreadAnchorRef {
  anchor: string;
  resolved?: boolean;
}

/** A frame id minted when a text frame is split into pieces, read back by `parsePromotedFrameId`. */
export interface ParsedPromotedFrameId {
  /** Hash of the frame the pieces came from. */
  hostHash: string;
  /** True when the piece is the root node of the host frame. */
  root: boolean;
  /** Child-index path of the piece inside the host frame. */
  path: number[];
  tag: string;
}

/** What a parsed anchor resolves to on a slide: an existing frame, the whole slide surface, or a promoted piece of a frame. */
export type PromotedCommentFrame =
  | { kind: "frame"; frameId: string }
  | { kind: "surface" }
  | { kind: "piece"; frameId: string };

declare module "../bindings" {
  interface RuntimeBindings {
    COMMENT_ANCHOR_VERSION: number;
    COMMENT_ANCHOR_SEGMENT_PATTERN: RegExp;
    COMMENT_ANCHOR_HOST_SEGMENT_PATTERN: RegExp;
    COMMENT_ANCHOR_NODE_SEGMENT_PATTERN: RegExp;
    COMMENT_ANCHOR_POINT_SEGMENT_PATTERN: RegExp;
    COMMENT_ANCHOR_AREA_SEGMENT_PATTERN: RegExp;
    COMMENT_ANCHOR_HASH_CHARS: number;
    /** Prefix mixed into slide-id hashes so anchors of different decks do not collide. */
    commentAnchorScope: string;
    setCommentAnchorScope: (scope: string) => void;
    hashScopedSlideId: (slideId: string) => string;
    hashCommentAnchorId: (text: string) => string;
    encodeCommentAnchorFraction: (fraction: number) => string;
    decodeCommentAnchorFraction: (encoded: string) => number;
    quantizeCommentAnchorFraction: (fraction: number, edge: boolean) => number;
    encodeCommentAnchorBox: (box: CommentAnchorBox) => string | null;
    decodeCommentAnchorBox: (segment: string) => CommentAnchorBox | null;
    encodeSlideCommentAnchor: (anchor: CommentAnchor) => string | null;
    parseSlideCommentAnchor: (anchor: string) => ParsedCommentAnchor | null;
    parseCommentFramePath: (segments: string[]) => CommentFramePath | null;
    resolveCommentSlide: (
      anchor: ParsedCommentAnchor,
      slides: readonly Slide[],
    ) => Slide | null;
    countOpenCommentsBySlide: (
      threads: readonly CommentThreadAnchorRef[],
      slides: readonly Slide[],
    ) => Map<string, number>;
    resolveCommentFrameId: (
      anchor: { frameHash: string | null },
      slide: Slide,
    ) => string | null;
    PROMOTED_FRAME_ID_PATTERN: RegExp;
    encodePromotedFrameId: (
      hostId: string,
      root: boolean,
      path: number[],
      tag: string,
    ) => string | null;
    parsePromotedFrameId: (id: string) => ParsedPromotedFrameId | null;
    resolvePromotedCommentFrame: (
      anchor: ParsedCommentFrameTargetAnchor,
      slide: Slide,
    ) => PromotedCommentFrame | null;
  }
}

export function installCommentsAnchors(runtime: RuntimeBindings): () => void {
  var COMMENT_ANCHOR_VERSION: number;
  var COMMENT_ANCHOR_SEGMENT_PATTERN: RegExp;
  var COMMENT_ANCHOR_HOST_SEGMENT_PATTERN: RegExp;
  var COMMENT_ANCHOR_NODE_SEGMENT_PATTERN: RegExp;
  var COMMENT_ANCHOR_POINT_SEGMENT_PATTERN: RegExp;
  var COMMENT_ANCHOR_AREA_SEGMENT_PATTERN: RegExp;
  var COMMENT_ANCHOR_HASH_CHARS: number;
  var commentAnchorScope: string;
  var hashScopedSlideId: RuntimeBindings["hashScopedSlideId"];
  var encodeCommentAnchorFraction: RuntimeBindings["encodeCommentAnchorFraction"];
  var decodeCommentAnchorFraction: RuntimeBindings["decodeCommentAnchorFraction"];
  var quantizeCommentAnchorFraction: RuntimeBindings["quantizeCommentAnchorFraction"];
  var encodeCommentAnchorBox: RuntimeBindings["encodeCommentAnchorBox"];
  var decodeCommentAnchorBox: RuntimeBindings["decodeCommentAnchorBox"];
  var PROMOTED_FRAME_ID_PATTERN: RegExp;
  function setCommentAnchorScope(scope: string): void {
    commentAnchorScope = scope;
  }
  function hashCommentAnchorId(text: string): string {
    let firstHash = -559038737,
      secondHash = 1103547991;
    for (let index = 0; index < text.length; index++) {
      let value = text.charCodeAt(index);
      firstHash = Math.imul(firstHash ^ value, 2654435761);
      secondHash = Math.imul(secondHash ^ value, 1597334677);
    }
    firstHash =
      Math.imul(firstHash ^ (firstHash >>> 16), 2246822507) ^
      Math.imul(secondHash ^ (secondHash >>> 13), 3266489909);
    secondHash =
      Math.imul(secondHash ^ (secondHash >>> 16), 2246822507) ^
      Math.imul(firstHash ^ (firstHash >>> 13), 3266489909);
    return (4294967296 * (2097151 & secondHash) + (firstHash >>> 0))
      .toString(16)
      .padStart(14, "0")
      .slice(-COMMENT_ANCHOR_HASH_CHARS);
  }
  function encodeSlideCommentAnchor(anchor: CommentAnchor): string | null {
    let segments = [
        "sl" + hashScopedSlideId(anchor.slideId) + ":nth-of-type(1)",
      ],
      frameId =
        anchor.kind === "frame"
          ? anchor.frameId
          : anchor.kind === "area"
            ? anchor.frameId
            : null;
    if (frameId !== null) {
      segments.push("fr" + hashCommentAnchorId(frameId) + ":nth-of-type(1)");
      if (anchor.kind !== "slide" && anchor.path.length > 0) {
        if (
          !anchor.path.every(
            (input: number): boolean =>
              Number.isInteger(input) && input >= 0 && input <= 999,
          )
        ) {
          return null;
        }
        let value4 = "np" + anchor.path.join("-");
        if (value4.length > 24) {
          return null;
        }
        segments.push(value4 + ":nth-of-type(1)");
      }
    } else if (anchor.kind === "area" && anchor.path.length > 0) {
      return null;
    }
    let value =
      anchor.kind === "area" ? encodeCommentAnchorBox(anchor.box) : "";
    if (value === null) {
      return null;
    }
    let value2 =
      anchor.kind === "area"
        ? (frameId !== null ? "g" : "r") + value
        : (anchor.kind === "frame" ? "x" : "b") +
          encodeCommentAnchorFraction(anchor.fx) +
          encodeCommentAnchorFraction(anchor.fy);
    segments.push(
      "s" + value2 + ":nth-of-type(" + String(COMMENT_ANCHOR_VERSION) + ")",
    );
    let value3 = segments.join(" > ");
    if (
      segments.every((input: string): boolean =>
        COMMENT_ANCHOR_SEGMENT_PATTERN.test(input),
      ) &&
      value3.length <= 1024
    ) {
      return value3;
    } else {
      return null;
    }
  }
  function parseSlideCommentAnchor(anchor: string): ParsedCommentAnchor | null {
    if (typeof anchor !== "string" || anchor === "" || anchor.length > 1024) {
      return null;
    }
    let segments = anchor.split(" > ");
    if (
      !segments.every((input: string): boolean =>
        COMMENT_ANCHOR_SEGMENT_PATTERN.test(input),
      )
    ) {
      return null;
    }
    let tail = segments[segments.length - 1] ?? "",
      slideMatch = COMMENT_ANCHOR_HOST_SEGMENT_PATTERN.exec(segments[0] ?? "");
    if (!slideMatch || slideMatch[1] !== "sl") {
      return null;
    }
    let value = slideMatch[2]!,
      value2 = COMMENT_ANCHOR_AREA_SEGMENT_PATTERN.exec(tail);
    if (value2) {
      let value7 = decodeCommentAnchorBox(value2[2]!);
      if (!value7 || Number(value2[3]) !== COMMENT_ANCHOR_VERSION) {
        return null;
      }
      if (value2[1] === "r") {
        if (segments.length === 2) {
          return {
            kind: "area",
            slideHash: value,
            frameHash: null,
            path: [],
            box: value7,
          };
        } else {
          return null;
        }
      }
      let value8 = parseCommentFramePath(segments);
      if (value8) {
        return {
          kind: "area",
          slideHash: value,
          frameHash: value8.frameHash,
          path: value8.path,
          box: value7,
        };
      } else {
        return null;
      }
    }
    let value3 = COMMENT_ANCHOR_POINT_SEGMENT_PATTERN.exec(tail);
    if (!value3 || Number(value3[4]) !== COMMENT_ANCHOR_VERSION) {
      return null;
    }
    let value4 = decodeCommentAnchorFraction(value3[2]!),
      value5 = decodeCommentAnchorFraction(value3[3]!);
    if (value3[1] === "b") {
      if (segments.length === 2) {
        return {
          kind: "slide",
          slideHash: value,
          fx: value4,
          fy: value5,
        };
      } else {
        return null;
      }
    }
    let value6 = parseCommentFramePath(segments);
    if (value6) {
      return {
        kind: "frame",
        slideHash: value,
        frameHash: value6.frameHash,
        path: value6.path,
        fx: value4,
        fy: value5,
      };
    } else {
      return null;
    }
  }
  function parseCommentFramePath(segments: string[]): CommentFramePath | null {
    let frameMatch = COMMENT_ANCHOR_HOST_SEGMENT_PATTERN.exec(
      segments[1] ?? "",
    );
    if (!frameMatch || frameMatch[1] !== "fr") {
      return null;
    }
    if (segments.length === 3) {
      return {
        frameHash: frameMatch[2]!,
        path: [],
      };
    }
    let value =
      segments.length === 4
        ? COMMENT_ANCHOR_NODE_SEGMENT_PATTERN.exec(segments[2]!)
        : null;
    if (value) {
      return {
        frameHash: frameMatch[2]!,
        path: value[1]!.split("-").map(Number),
      };
    } else {
      return null;
    }
  }
  function resolveCommentSlide(
    anchor: ParsedCommentAnchor,
    slides: readonly Slide[],
  ): Slide | null {
    return (
      slides.find(
        (input: Slide): boolean =>
          hashScopedSlideId(input.id) === anchor.slideHash,
      ) ?? null
    );
  }
  function countOpenCommentsBySlide(
    threads: readonly CommentThreadAnchorRef[],
    slides: readonly Slide[],
  ): Map<string, number> {
    let countByHash = new Map<string, number>();
    for (let value of threads) {
      let value2 = value.resolved ? null : parseSlideCommentAnchor(value.anchor);
      if (value2) {
        countByHash.set(
          value2.slideHash,
          (countByHash.get(value2.slideHash) ?? 0) + 1,
        );
      }
    }
    let countById = new Map<string, number>();
    if (countByHash.size === 0) {
      return countById;
    }
    for (let value of slides) {
      let entry = countByHash.get(hashScopedSlideId(value.id));
      if (entry !== undefined) {
        countById.set(value.id, entry);
      }
    }
    return countById;
  }
  function resolveCommentFrameId(
    anchor: { frameHash: string | null },
    slide: Slide,
  ): string | null {
    if (anchor.frameHash === null) {
      return null;
    } else {
      return (
        slide.frames.find(
          (input: Frame): boolean =>
            hashCommentAnchorId(input.id) === anchor.frameHash,
        )?.id ?? null
      );
    }
  }
  function encodePromotedFrameId(
    hostId: string,
    root: boolean,
    path: number[],
    tag: string,
  ): string | null {
    if (
      path.length === 0 ||
      !path.every(
        (input: number): boolean =>
          Number.isInteger(input) && input >= 0 && input <= 999,
      )
    ) {
      return null;
    }
    let id =
      "p" +
      hashCommentAnchorId(hostId) +
      (root ? "r" : "c") +
      path.join("_") +
      "-" +
      tag;
    if (id.length <= 64 && parsePromotedFrameId(id) !== null) {
      return id;
    } else {
      return null;
    }
  }
  function parsePromotedFrameId(id: string): ParsedPromotedFrameId | null {
    let match = PROMOTED_FRAME_ID_PATTERN.exec(id);
    if (!match) {
      return null;
    }
    let path = match[3]!.split("_").map(Number);
    if (path.join("_") === match[3]) {
      return {
        hostHash: match[1]!,
        root: match[2] === "r",
        path: path,
        tag: match[4]!,
      };
    } else {
      return null;
    }
  }
  function resolvePromotedCommentFrame(
    anchor: ParsedCommentFrameTargetAnchor,
    slide: Slide,
  ): PromotedCommentFrame | null {
    let frameId = resolveCommentFrameId(anchor, slide);
    if (frameId !== null) {
      return {
        kind: "frame",
        frameId: frameId,
      };
    }
    let promotedFrames = slide.frames.flatMap(
      (input: Frame): Array<ParsedPromotedFrameId & { id: string }> => {
        let value2 = parsePromotedFrameId(input.id);
        if (value2 !== null && value2.hostHash === anchor.frameHash) {
          return [
            {
              id: input.id,
              ...value2,
            },
          ];
        } else {
          return [];
        }
      },
    );
    if (anchor.path.length === 0) {
      if (
        promotedFrames.length > 0 &&
        promotedFrames.every(
          (input: ParsedPromotedFrameId & { id: string }): boolean =>
            input.root,
        )
      ) {
        return {
          kind: "surface",
        };
      } else {
        return null;
      }
    }
    if (
      new Set(
        promotedFrames.map(
          (input: ParsedPromotedFrameId & { id: string }): string => input.tag,
        ),
      ).size > 1
    ) {
      return null;
    }
    let value = promotedFrames.filter(
      (input: ParsedPromotedFrameId & { id: string }): boolean =>
        input.path.length === anchor.path.length &&
        input.path.every(
          (input2: number, options: number): boolean =>
            input2 === anchor.path[options],
        ),
    );
    if (value.length === 1) {
      return {
        kind: "piece",
        frameId: value[0]!.id,
      };
    } else {
      return null;
    }
  }
  bindRuntimeValue(
    runtime,
    "COMMENT_ANCHOR_VERSION",
    () => COMMENT_ANCHOR_VERSION,
    (value) => {
      COMMENT_ANCHOR_VERSION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMMENT_ANCHOR_SEGMENT_PATTERN",
    () => COMMENT_ANCHOR_SEGMENT_PATTERN,
    (value) => {
      COMMENT_ANCHOR_SEGMENT_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMMENT_ANCHOR_HOST_SEGMENT_PATTERN",
    () => COMMENT_ANCHOR_HOST_SEGMENT_PATTERN,
    (value) => {
      COMMENT_ANCHOR_HOST_SEGMENT_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMMENT_ANCHOR_NODE_SEGMENT_PATTERN",
    () => COMMENT_ANCHOR_NODE_SEGMENT_PATTERN,
    (value) => {
      COMMENT_ANCHOR_NODE_SEGMENT_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMMENT_ANCHOR_POINT_SEGMENT_PATTERN",
    () => COMMENT_ANCHOR_POINT_SEGMENT_PATTERN,
    (value) => {
      COMMENT_ANCHOR_POINT_SEGMENT_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMMENT_ANCHOR_AREA_SEGMENT_PATTERN",
    () => COMMENT_ANCHOR_AREA_SEGMENT_PATTERN,
    (value) => {
      COMMENT_ANCHOR_AREA_SEGMENT_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMMENT_ANCHOR_HASH_CHARS",
    () => COMMENT_ANCHOR_HASH_CHARS,
    (value) => {
      COMMENT_ANCHOR_HASH_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "commentAnchorScope",
    () => commentAnchorScope,
    (value) => {
      commentAnchorScope = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "setCommentAnchorScope",
    () => setCommentAnchorScope,
  );
  bindRuntimeValue(
    runtime,
    "hashScopedSlideId",
    () => hashScopedSlideId,
    (value) => {
      hashScopedSlideId = value;
    },
  );
  bindRuntimeValue(runtime, "hashCommentAnchorId", () => hashCommentAnchorId);
  bindRuntimeValue(
    runtime,
    "encodeCommentAnchorFraction",
    () => encodeCommentAnchorFraction,
    (value) => {
      encodeCommentAnchorFraction = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "decodeCommentAnchorFraction",
    () => decodeCommentAnchorFraction,
    (value) => {
      decodeCommentAnchorFraction = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "quantizeCommentAnchorFraction",
    () => quantizeCommentAnchorFraction,
    (value) => {
      quantizeCommentAnchorFraction = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "encodeCommentAnchorBox",
    () => encodeCommentAnchorBox,
    (value) => {
      encodeCommentAnchorBox = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "decodeCommentAnchorBox",
    () => decodeCommentAnchorBox,
    (value) => {
      decodeCommentAnchorBox = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "encodeSlideCommentAnchor",
    () => encodeSlideCommentAnchor,
  );
  bindRuntimeValue(
    runtime,
    "parseSlideCommentAnchor",
    () => parseSlideCommentAnchor,
  );
  bindRuntimeValue(
    runtime,
    "parseCommentFramePath",
    () => parseCommentFramePath,
  );
  bindRuntimeValue(runtime, "resolveCommentSlide", () => resolveCommentSlide);
  bindRuntimeValue(
    runtime,
    "countOpenCommentsBySlide",
    () => countOpenCommentsBySlide,
  );
  bindRuntimeValue(
    runtime,
    "resolveCommentFrameId",
    () => resolveCommentFrameId,
  );
  bindRuntimeValue(
    runtime,
    "PROMOTED_FRAME_ID_PATTERN",
    () => PROMOTED_FRAME_ID_PATTERN,
    (value) => {
      PROMOTED_FRAME_ID_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "encodePromotedFrameId",
    () => encodePromotedFrameId,
  );
  bindRuntimeValue(runtime, "parsePromotedFrameId", () => parsePromotedFrameId);
  bindRuntimeValue(
    runtime,
    "resolvePromotedCommentFrame",
    () => resolvePromotedCommentFrame,
  );
  return () => {
    COMMENT_ANCHOR_VERSION = 1;
    COMMENT_ANCHOR_SEGMENT_PATTERN =
      /^[a-z][a-z0-9-]{0,23}:nth-of-type\([1-9][0-9]{0,3}\)$/;
    COMMENT_ANCHOR_HOST_SEGMENT_PATTERN =
      /^(sl|fr)([0-9a-f]{12}):nth-of-type\(1\)$/;
    COMMENT_ANCHOR_NODE_SEGMENT_PATTERN =
      /^np(\d{1,3}(?:-\d{1,3})*):nth-of-type\(1\)$/;
    COMMENT_ANCHOR_POINT_SEGMENT_PATTERN =
      /^s([xb])(\d{4})(\d{4}):nth-of-type\(([1-9][0-9]{0,3})\)$/;
    COMMENT_ANCHOR_AREA_SEGMENT_PATTERN =
      /^s([gr])(\d{12}[0-3]?):nth-of-type\(([1-9][0-9]{0,3})\)$/;
    COMMENT_ANCHOR_HASH_CHARS = 12;
    commentAnchorScope = "";
    hashScopedSlideId = (slideId: string): string =>
      hashCommentAnchorId(
        commentAnchorScope === ""
          ? slideId
          : commentAnchorScope + "/" + slideId,
      );
    encodeCommentAnchorFraction = (fraction: number): string =>
      String(
        Math.round(
          Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0.5)) *
            9999,
        ),
      ).padStart(4, "0");
    decodeCommentAnchorFraction = (encoded: string): number =>
      Number(encoded) / 9999;
    quantizeCommentAnchorFraction = (
      fraction: number,
      edge: boolean,
    ): number => {
      let scaled = Math.min(1, Math.max(0, fraction)) * 1000;
      return Math.min(
        999,
        Math.max(
          0,
          edge
            ? Math.ceil(scaled - 0.0000001) - 1
            : Math.floor(scaled + 0.0000001),
        ),
      );
    };
    encodeCommentAnchorBox = (box: CommentAnchorBox): string | null => {
      if (
        ![box.x0, box.y0, box.x1, box.y1].every(Number.isFinite) ||
        !(box.x1 > box.x0 && box.y1 > box.y0)
      ) {
        return null;
      }
      if (box.corner != null && ![0, 1, 2, 3].includes(box.corner)) {
        return null;
      }
      let value = quantizeCommentAnchorFraction(box.x0, false),
        value2 = quantizeCommentAnchorFraction(box.y0, false),
        callback = (input: number): string => String(input).padStart(3, "0");
      return (
        callback(value) +
        callback(value2) +
        callback(Math.max(value, quantizeCommentAnchorFraction(box.x1, true))) +
        callback(
          Math.max(value2, quantizeCommentAnchorFraction(box.y1, true)),
        ) +
        (box.corner != null ? String(box.corner) : "")
      );
    };
    decodeCommentAnchorBox = (segment: string): CommentAnchorBox | null => {
      let value = /^(\d{3})(\d{3})(\d{3})(\d{3})([0-3])?$/.exec(segment);
      if (!value) {
        return null;
      }
      let [items, items2, items3, items4] = [
        Number(value[1]) / 1000,
        Number(value[2]) / 1000,
        (Number(value[3]) + 1) / 1000,
        (Number(value[4]) + 1) / 1000,
      ];
      if (!(items3 > items && items4 > items2)) {
        return null;
      }
      if (value[5] != null) {
        return {
          x0: items,
          y0: items2,
          x1: items3,
          y1: items4,
          corner: Number(value[5]),
        };
      } else {
        return {
          x0: items,
          y0: items2,
          x1: items3,
          y1: items4,
        };
      }
    };
    PROMOTED_FRAME_ID_PATTERN =
      /^p([0-9a-f]{12})([rc])(\d{1,3}(?:_\d{1,3})*)-([0-9a-z]{8})$/;
  };
}
