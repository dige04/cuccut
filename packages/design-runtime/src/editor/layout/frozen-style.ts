/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorLayoutFrozenStyle(
  runtime: RuntimeBindings,
): () => void {
  var FrozenStyleCache: Dynamic;
  var LayoutFrozenStyleMmLlHhVvCcSsQqTtAaZzPattern: Dynamic;
  function isSafeSvgPath(items?: Dynamic): Dynamic {
    return (
      typeof items == "string" &&
      items.length > 0 &&
      items.length <= 1e5 &&
      LayoutFrozenStyleMmLlHhVvCcSsQqTtAaZzPattern.test(items)
    );
  }
  function isFiniteRect(input?: Dynamic): Dynamic {
    return typeof input != "object" || input == null
      ? false
      : ["x", "y", "w", "h"].every((input2?: Dynamic): Dynamic => {
          let value: Dynamic = input[input2];
          return (
            typeof value == "number" &&
            Number.isFinite(value) &&
            Math.abs(value) < 1e6
          );
        });
  }
  function validateResizeMessage(input?: Dynamic): Dynamic {
    let callback: Dynamic = (input2?: Dynamic): Dynamic =>
      typeof input2 == "number" &&
      Number.isFinite(input2) &&
      Math.abs(input2) < 1e6;
    if (
      (input.width == null && input.height == null) ||
      (input.width != null && !callback(input.width)) ||
      (input.height != null && !callback(input.height))
    )
      return null;
    let state: Dynamic = {
      ...input,
    };
    for (let value of ["left", "top", "right", "bottom"] as Dynamic)
      state[value] != null && !callback(state[value]) && delete state[value];
    state.left != null && delete state.right;
    state.top != null && delete state.bottom;
    return state;
  }
  function validateRotateMessage(input?: Dynamic): Dynamic {
    let angle: Dynamic = input.angle;
    return typeof angle == "number" &&
      Number.isFinite(angle) &&
      Math.abs(angle) <= 360
      ? input
      : null;
  }
  function normalizePickerPayload(input?: Dynamic): Dynamic {
    let state: Dynamic = {
      ...input,
    };
    state.rect != null && !isFiniteRect(state.rect) && delete state.rect;
    state.path != null &&
      !(typeof state.path == "object" && isSafeSvgPath(state.path.d)) &&
      delete state.path;
    state.dir != null &&
      !(
        (state.dir.x === 1 || state.dir.x === -1) &&
        (state.dir.y === 1 || state.dir.y === -1)
      ) &&
      delete state.dir;
    state.targetTid != null &&
      !Number.isInteger(state.targetTid) &&
      (state.targetTid = null);
    let position: Dynamic = state.position;
    position !== "before" &&
      position !== "after" &&
      position !== "into" &&
      position !== "root-end" &&
      (state.position = "root-end");
    return state;
  }
  bindRuntimeValue(
    runtime,
    "FrozenStyleCache",
    () => FrozenStyleCache,
    (value) => {
      FrozenStyleCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LayoutFrozenStyleMmLlHhVvCcSsQqTtAaZzPattern",
    () => LayoutFrozenStyleMmLlHhVvCcSsQqTtAaZzPattern,
    (value) => {
      LayoutFrozenStyleMmLlHhVvCcSsQqTtAaZzPattern = value;
    },
  );
  bindRuntimeValue(runtime, "isSafeSvgPath", () => isSafeSvgPath);
  bindRuntimeValue(runtime, "isFiniteRect", () => isFiniteRect);
  bindRuntimeValue(
    runtime,
    "validateResizeMessage",
    () => validateResizeMessage,
  );
  bindRuntimeValue(
    runtime,
    "validateRotateMessage",
    () => validateRotateMessage,
  );
  bindRuntimeValue(
    runtime,
    "normalizePickerPayload",
    () => normalizePickerPayload,
  );
  return () => {
    FrozenStyleCache = class {
      key: Dynamic = "";
      styles: Dynamic = new Map();
      clear(): Dynamic {
        this.key = "";
        this.styles.clear();
      }
      capture(input: Dynamic, options: Dynamic, context: Dynamic): Dynamic {
        input !== this.key && (this.clear(), (this.key = input));
        this.styles.has(options) || this.styles.set(options, context());
      }
      baselineFor(input: Dynamic, options: Dynamic): Dynamic {
        return input === this.key ? this.styles.get(options) : undefined;
      }
      tids(input: Dynamic): Dynamic {
        return input === this.key ? [...this.styles.keys()] : [];
      }
      forget(input: Dynamic): Dynamic {
        input === this.key && this.clear();
      }
    };
    LayoutFrozenStyleMmLlHhVvCcSsQqTtAaZzPattern =
      /^[MmLlHhVvCcSsQqTtAaZz0-9\s,.eE+-]+$/;
  };
}
