/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installAssetsImagePlacement(
  runtime: RuntimeBindings,
): () => void {
  var jsx_Gn: Dynamic;
  var maxAnimatedGifPlacementBytes: Dynamic;
  var maxCanvasImagePlacementBytes: Dynamic;
  var CanvasImagePlacementError: Dynamic;
  function imagePlacementRejectionReason(file?: Dynamic): Dynamic {
    return file.type === "image/gif" && file.size > maxAnimatedGifPlacementBytes
      ? `animated GIFs over ${maxAnimatedGifPlacementBytes >> 20} MB can't be placed`
      : file.size > maxCanvasImagePlacementBytes ||
          (((0, runtime.isSvgFile)(file) || file.type === "image/gif") &&
            file.size > runtime.CanvasWorkingStateFloorValue)
        ? "too large to place here"
        : null;
  }
  async function validateCanvasPlacedImage(
    file?: Dynamic,
    decodeOptions?: Dynamic,
  ): Promise<Dynamic> {
    return (
      imagePlacementRejectionReason(file) ??
      ((await (0, runtime.isPlayableImage)(file, decodeOptions).catch(
        (): Dynamic => false,
      ))
        ? null
        : "not an image the editor can decode")
    );
  }
  bindRuntimeValue(
    runtime,
    "jsx_Gn",
    () => jsx_Gn,
    (value) => {
      jsx_Gn = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxAnimatedGifPlacementBytes",
    () => maxAnimatedGifPlacementBytes,
    (value) => {
      maxAnimatedGifPlacementBytes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxCanvasImagePlacementBytes",
    () => maxCanvasImagePlacementBytes,
    (value) => {
      maxCanvasImagePlacementBytes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "CanvasImagePlacementError",
    () => CanvasImagePlacementError,
    (value) => {
      CanvasImagePlacementError = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "imagePlacementRejectionReason",
    () => imagePlacementRejectionReason,
  );
  bindRuntimeValue(
    runtime,
    "validateCanvasPlacedImage",
    () => validateCanvasPlacedImage,
  );
  return () => {
    jsx_Gn = (0, runtime.toModuleNamespace)(
      (0, runtime.load_react_jsx_runtime)(),
      1,
    );
    maxAnimatedGifPlacementBytes = 2 * 1024 * 1024;
    maxCanvasImagePlacementBytes =
      runtime.ClipboardImageValidationResolvedValue_2;
    CanvasImagePlacementError = class extends Error {};
  };
}
