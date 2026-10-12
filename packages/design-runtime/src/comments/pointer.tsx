/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installCommentsPointer(runtime: RuntimeBindings): () => void {
  var commentPointerTip: Dynamic;
  var commentPointerPath: Dynamic;
  var commentPointerFill: Dynamic;
  var commentPointerStroke: Dynamic;
  var commentPointerStrokeWidth: Dynamic;
  var commentPointerSvg: Dynamic;
  var commentPointerCursorUrl: Dynamic;
  var commentPointerCursor: Dynamic;
  var jsx_r1e: Dynamic;
  var subtractCssPixels: Dynamic;
  function CommentPointer({
    at: at,
    className: className,
    "data-testid": dataTestid,
  }: Dynamic): Dynamic {
    return (
      <svg
        aria-hidden={true}
        data-testid={dataTestid}
        className={(0, runtime.joinClassNames)(
          "pointer-events-none absolute",
          className,
        )}
        width={28}
        height={28}
        viewBox={`0 0 ${28} ${28}`}
        style={{
          left: subtractCssPixels(at.x, commentPointerTip.x),
          top: subtractCssPixels(at.y, commentPointerTip.y),
        }}
      >
        <path
          d={commentPointerPath}
          fill={commentPointerFill}
          stroke={commentPointerStroke}
          strokeWidth={commentPointerStrokeWidth}
        />
      </svg>
    );
  }
  bindRuntimeValue(
    runtime,
    "commentPointerTip",
    () => commentPointerTip,
    (value) => {
      commentPointerTip = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "commentPointerPath",
    () => commentPointerPath,
    (value) => {
      commentPointerPath = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "commentPointerFill",
    () => commentPointerFill,
    (value) => {
      commentPointerFill = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "commentPointerStroke",
    () => commentPointerStroke,
    (value) => {
      commentPointerStroke = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "commentPointerStrokeWidth",
    () => commentPointerStrokeWidth,
    (value) => {
      commentPointerStrokeWidth = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "commentPointerSvg",
    () => commentPointerSvg,
    (value) => {
      commentPointerSvg = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "commentPointerCursorUrl",
    () => commentPointerCursorUrl,
    (value) => {
      commentPointerCursorUrl = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "commentPointerCursor",
    () => commentPointerCursor,
    (value) => {
      commentPointerCursor = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsx_r1e",
    () => jsx_r1e,
    (value) => {
      jsx_r1e = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "subtractCssPixels",
    () => subtractCssPixels,
    (value) => {
      subtractCssPixels = value;
    },
  );
  bindRuntimeValue(runtime, "CommentPointer", () => CommentPointer);
  return () => {
    commentPointerTip = {
      x: 2,
      y: 2,
    };
    commentPointerPath = "M 2 2 L 2 14 A 12 12 0 1 0 14 2 Z";
    commentPointerFill = "#000";
    commentPointerStroke = "#fff";
    commentPointerStrokeWidth = 2;
    commentPointerSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' viewBox='0 0 28 28'><path d='${commentPointerPath}' fill='${commentPointerFill}' stroke='${commentPointerStroke}' stroke-width='${commentPointerStrokeWidth}'/></svg>`;
    commentPointerCursorUrl = commentPointerSvg.replace(
      /[ '<>#]/g,
      (input?: Dynamic): Dynamic =>
        "%" + input.charCodeAt(0).toString(16).toUpperCase(),
    );
    commentPointerCursor = `url("data:image/svg+xml,${commentPointerCursorUrl}") ${commentPointerTip.x} ${commentPointerTip.y}, crosshair`;
    jsx_r1e = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    subtractCssPixels = (input?: Dynamic, options?: Dynamic): Dynamic =>
      typeof input == "number"
        ? input - options
        : `calc(${input} - ${options}px)`;
  };
}
