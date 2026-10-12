/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

declare module "../bindings" {
  interface RuntimeBindings {
    COMMENT_PIN_SIZE: number;
    COMMENT_PIN_HOTSPOT: { x: number; y: number };
    COMMENT_PIN_PATH: string;
    COMMENT_PIN_FILL: string;
    COMMENT_PIN_STROKE: string;
    COMMENT_PIN_STROKE_WIDTH: number;
    encodedCommentPinSvg: string;
    COMMENT_MODE_CURSOR: string;
  }
}

export function installCommentsPinGeometry(
  runtime: RuntimeBindings,
): () => void {
  var COMMENT_PIN_SIZE: number;
  var COMMENT_PIN_HOTSPOT: { x: number; y: number };
  var COMMENT_PIN_PATH: string;
  var COMMENT_PIN_FILL: string;
  var COMMENT_PIN_STROKE: string;
  var COMMENT_PIN_STROKE_WIDTH: number;
  var encodedCommentPinSvg: string;
  var COMMENT_MODE_CURSOR: string;

  bindRuntimeValue(
    runtime,
    "COMMENT_PIN_SIZE",
    () => COMMENT_PIN_SIZE,
    (value) => {
      COMMENT_PIN_SIZE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMMENT_PIN_HOTSPOT",
    () => COMMENT_PIN_HOTSPOT,
    (value) => {
      COMMENT_PIN_HOTSPOT = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMMENT_PIN_PATH",
    () => COMMENT_PIN_PATH,
    (value) => {
      COMMENT_PIN_PATH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMMENT_PIN_FILL",
    () => COMMENT_PIN_FILL,
    (value) => {
      COMMENT_PIN_FILL = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMMENT_PIN_STROKE",
    () => COMMENT_PIN_STROKE,
    (value) => {
      COMMENT_PIN_STROKE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMMENT_PIN_STROKE_WIDTH",
    () => COMMENT_PIN_STROKE_WIDTH,
    (value) => {
      COMMENT_PIN_STROKE_WIDTH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "encodedCommentPinSvg",
    () => encodedCommentPinSvg,
    (value) => {
      encodedCommentPinSvg = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "COMMENT_MODE_CURSOR",
    () => COMMENT_MODE_CURSOR,
    (value) => {
      COMMENT_MODE_CURSOR = value;
    },
  );
  return () => {
    COMMENT_PIN_SIZE = 28;
    COMMENT_PIN_HOTSPOT = {
      x: 2,
      y: 2,
    };
    COMMENT_PIN_PATH = "M 2 2 L 2 14 A 12 12 0 1 0 14 2 Z";
    COMMENT_PIN_FILL = "#000";
    COMMENT_PIN_STROKE = "#fff";
    COMMENT_PIN_STROKE_WIDTH = 2;
    encodedCommentPinSvg =
      "<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'><path d='M 2 2 L 2 14 A 12 12 0 1 0 14 2 Z' fill='#000' stroke='#fff' stroke-width='2'/></svg>".replace(
        /[ '<>#]/g,
        (input: string): string =>
          "%" + input.charCodeAt(0).toString(16).toUpperCase(),
      );
    COMMENT_MODE_CURSOR = `url("data:image/svg+xml,${encodedCommentPinSvg}") ${COMMENT_PIN_HOTSPOT.x} ${COMMENT_PIN_HOTSPOT.y}, crosshair`;
  };
}
