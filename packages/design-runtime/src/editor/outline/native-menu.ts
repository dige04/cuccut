/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../../runtime-types";

export function installEditorOutlineNativeMenu(
  runtime: RuntimeBindings,
): () => void {
  var OutlineNativeMenuTitle1RectOvalConfig: Dynamic;
  var OutlineNativeMenuLabelGlyphConfig: Dynamic;
  var OutlineNativeMenuLabelGlyphConfig_2: Dynamic;
  var OutlineNativeMenuLimit: Dynamic;
  var OutlineNativeMenuReplace: Dynamic;
  var OutlineNativeMenuSlice: Dynamic;
  function suppressNativeContextMenu(input?: Dynamic): Dynamic {
    runtime.nativeContextMenuTimeout != null &&
      clearTimeout(runtime.nativeContextMenuTimeout);
    (window as Dynamic).addEventListener(
      "contextmenu",
      runtime.OutlineDcOutlineTarget,
      true,
    );
    runtime.nativeContextMenuTimeout = setTimeout(
      runtime.OutlineDcOutlineRemoveEventListener,
      input
        ? runtime.OutlineDcOutlineConstant_2
        : runtime.OutlineDcOutlineConstant,
    );
  }
  bindRuntimeValue(
    runtime,
    "suppressNativeContextMenu",
    () => suppressNativeContextMenu,
  );
  bindRuntimeValue(
    runtime,
    "OutlineNativeMenuTitle1RectOvalConfig",
    () => OutlineNativeMenuTitle1RectOvalConfig,
    (value) => {
      OutlineNativeMenuTitle1RectOvalConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OutlineNativeMenuLabelGlyphConfig",
    () => OutlineNativeMenuLabelGlyphConfig,
    (value) => {
      OutlineNativeMenuLabelGlyphConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OutlineNativeMenuLabelGlyphConfig_2",
    () => OutlineNativeMenuLabelGlyphConfig_2,
    (value) => {
      OutlineNativeMenuLabelGlyphConfig_2 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OutlineNativeMenuLimit",
    () => OutlineNativeMenuLimit,
    (value) => {
      OutlineNativeMenuLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OutlineNativeMenuReplace",
    () => OutlineNativeMenuReplace,
    (value) => {
      OutlineNativeMenuReplace = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "OutlineNativeMenuSlice",
    () => OutlineNativeMenuSlice,
    (value) => {
      OutlineNativeMenuSlice = value;
    },
  );
  return () => {
    OutlineNativeMenuTitle1RectOvalConfig = {
      title1: {
        label: "Title",
        glyph: "title",
      },
      rect: {
        label: "Rectangle",
        glyph: "rect",
      },
      oval: {
        label: "Oval",
        glyph: "oval",
      },
      line: {
        label: "Line",
        glyph: "line",
      },
      arrow: {
        label: "Arrow",
        glyph: "arrow",
      },
      pen: {
        label: "Drawing",
        glyph: "pen",
      },
      image: {
        label: "Image",
        glyph: "image",
      },
    };
    OutlineNativeMenuLabelGlyphConfig = {
      label: "Note",
      glyph: "note",
    };
    OutlineNativeMenuLabelGlyphConfig_2 = {
      label: "Video",
      glyph: "image",
    };
    OutlineNativeMenuLimit = 26;
    OutlineNativeMenuReplace = (input?: Dynamic): Dynamic =>
      input.trim().replace(/\s+/g, " ");
    OutlineNativeMenuSlice = (input?: Dynamic): Dynamic => {
      let value: Dynamic = OutlineNativeMenuReplace(input);
      return value.length > OutlineNativeMenuLimit
        ? `${value.slice(0, OutlineNativeMenuLimit)}\u2026`
        : value;
    };
  };
}
