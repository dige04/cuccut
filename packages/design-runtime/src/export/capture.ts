/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installExportCapture(runtime: RuntimeBindings): () => void {
  function selectExportCaptureArtboard(
    artboards?: Dynamic,
    focusedFile?: Dynamic,
    selectedFiles?: Dynamic,
    pageId?: Dynamic,
  ): Dynamic {
    let callback: Dynamic = (input?: Dynamic): Dynamic =>
      input === null
        ? undefined
        : artboards.find((input2?: Dynamic): Dynamic => input2.file === input);
    if (focusedFile !== null) {
      let value3: Dynamic = callback(focusedFile);
      return value3
        ? {
            artboard: value3,
            chosen: true,
          }
        : {
            artboard: null,
            covered: true,
          };
    }
    let value: Dynamic = artboards.filter(
      (input?: Dynamic): Dynamic => selectedFiles.has(input.file),
    );
    if (value.length === 1)
      return {
        artboard: value[0],
        chosen: true,
      };
    let value2: Dynamic = callback(pageId) ?? artboards[0];
    return value2
      ? {
          artboard: value2,
          chosen: artboards.length === 1,
        }
      : {
          artboard: null,
          covered: false,
        };
  }
  async function drainArtboardExportCaptures(
    capture?: Dynamic,
    artboards?: Dynamic,
    deadline?: Dynamic,
    options?: Dynamic,
    { reserveMs: extra = 25e3, now: extra2 = Date.now }: Dynamic = {},
  ): Promise<Dynamic> {
    let value: Dynamic = null;
    for (let [value2, value3] of artboards.entries() as Dynamic) {
      if (value !== null && extra2() + extra > options)
        return {
          ok: false,
          reason: "no_time",
          after: value,
        };
      let value4: Dynamic;
      try {
        value4 = await capture(value3);
      } catch (value5: Dynamic) {
        if (value2 === artboards.length - 1) throw value5;
        value = "failed";
        continue;
      }
      if (value4 === null)
        return {
          ok: false,
          reason: "nothing",
        };
      if (value4.bytes.length === 0)
        throw new Error("the image came back empty");
      if (value4.bytes.length <= deadline)
        return {
          ok: true,
          scale: value3,
          steppedDown: value,
          ...value4,
        };
      value = "too_large";
    }
    return {
      ok: false,
      reason: "too_large",
    };
  }
  async function captureExportArtboards(
    artboards?: Dynamic,
    scale?: Dynamic,
    { signal: context }: Dynamic = {},
  ): Promise<Dynamic> {
    let value: Dynamic = (0, runtime.uniqueExportFileNames)(),
      items: Dynamic = [],
      items2: Dynamic = [],
      index: Dynamic = 0,
      index2: Dynamic = 0,
      state: Dynamic = {
        innerClipped: 0,
        scrollRegion: 0,
        collapsed: 0,
        unrevealed: 0,
      };
    for (let value2 of (0, runtime.artboardsInReadingOrder)(
      artboards,
    ) as Dynamic) {
      context?.throwIfAborted();
      let value3: Dynamic = value(value2.file, value2.title),
        value4: Dynamic = await scale(value2);
      if (value4.bytes.length === 0)
        throw new Error('"' + value3 + '" came back empty');
      items.push({
        name: value3 + ".png",
        data: value4.bytes,
      });
      value4.clipped && items2.push(value3);
      index += value4.blank;
      index2 += value4.fontFallback ?? 0;
      for (let value5 of [
        "innerClipped",
        "scrollRegion",
        "collapsed",
        "unrevealed",
      ] as Dynamic)
        (value4.hiddenContent?.[value5] ?? 0) > 0 && (state[value5] += 1);
    }
    if (items.length === 0) throw new Error("no artboards to export");
    return {
      blob: (0, runtime.createStoredZip)(items),
      clipped: items2,
      blank: index,
      fontFallback: index2,
      hiddenContent: state,
    };
  }
  function describeExportCaptureWarnings(
    capture?: Dynamic,
    scaledDownCount?: Dynamic,
  ): Dynamic {
    return {
      blankImages: capture.blank,
      clipped: capture.clipped.length > 0,
      fontFallback: capture.fontFallback,
      scaledDown: scaledDownCount > 0,
      ...capture.hiddenContent,
    };
  }
  bindRuntimeValue(
    runtime,
    "selectExportCaptureArtboard",
    () => selectExportCaptureArtboard,
  );
  bindRuntimeValue(
    runtime,
    "drainArtboardExportCaptures",
    () => drainArtboardExportCaptures,
  );
  bindRuntimeValue(
    runtime,
    "captureExportArtboards",
    () => captureExportArtboards,
  );
  bindRuntimeValue(
    runtime,
    "describeExportCaptureWarnings",
    () => describeExportCaptureWarnings,
  );
  return () => {};
}
