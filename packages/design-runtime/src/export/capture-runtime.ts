/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installExportCaptureRuntime(
  runtime: RuntimeBindings,
): () => void {
  var maxCaptureEdge: Dynamic;
  var maxCapturePixels: Dynamic;
  var imageCaptureRuntimeScript: Dynamic;

  bindRuntimeValue(
    runtime,
    "maxCaptureEdge",
    () => maxCaptureEdge,
    (value) => {
      maxCaptureEdge = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxCapturePixels",
    () => maxCapturePixels,
    (value) => {
      maxCapturePixels = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "imageCaptureRuntimeScript",
    () => imageCaptureRuntimeScript,
    (value) => {
      imageCaptureRuntimeScript = value;
    },
  );
  return () => {
    maxCaptureEdge = 12e3;
    maxCapturePixels = 12e7;
    imageCaptureRuntimeScript = runtime.buildCaptureTemplate({
      resolveSelectionRoot: runtime.captureSelectionSvg.toString(),
      maxCaptureSide: maxCaptureEdge,
      maxCapturePixels: maxCapturePixels,
      collectFontFaceRules: runtime.resolveCaptureFonts.toString(),
      warnUnembeddedFonts: runtime.collectUsedFontFaces.toString(),
      collectBackgroundUrls: runtime.collectCssImageUrls.toString(),
      replaceBackgroundUrls: runtime.replaceCssImageUrls.toString(),
      makeCloneStyled: runtime.captureElementStyle.toString(),
      prepareWebGlCapture: runtime.prepareWebGlCanvasCapture.toString(),
      settleFrozenAnimations: runtime.captureAnimationStates.toString(),
      freezeAnimations: runtime.captureAnimationStyles.toString(),
      measureTextOriginOffset: runtime.calculateFlowTail.toString(),
      collectLinks: runtime.captureDomSnapshot.toString(),
      collectTextLayer: runtime.captureReadableText.toString(),
      countHiddenContent: runtime.inspectCaptureLayout.toString(),
      sanitizeXmlCharacters: runtime.sanitizeXmlCharacters.toString(),
      computePaginationCuts: runtime.computePaginationCuts.toString(),
    });
  };
}
