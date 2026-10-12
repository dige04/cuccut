/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installCanvasContentSnapshots(
  runtime: RuntimeBindings,
): () => void {
  var textExtractionExcludedTags: Dynamic;
  var artboardTextSnapshotLimit: Dynamic;
  var videoElementsWithSource: Dynamic;
  function extractVisibleElementText(
    element?: Dynamic,
    { enough: options = 600, visits: options2 = 1 / 0 }: Dynamic = {},
  ): Dynamic {
    let text: Dynamic = "",
      index: Dynamic = 0,
      callback: Dynamic = (input?: Dynamic): Dynamic => {
        if (!(text.length >= options || index >= options2)) {
          index += 1;
          if (input.nodeType === 3) text += input.data;
          else if (
            input.nodeType === 1 &&
            !textExtractionExcludedTags.has(
              input.tagName.toLowerCase().replace(/^sc-raw-/, ""),
            )
          )
            for (let value of input.childNodes as Dynamic) callback(value);
        }
      };
    callback(element);
    return text;
  }
  function createVideoElementIdentity(
    model?: Dynamic,
    templateId?: Dynamic,
  ): Dynamic {
    let value: Dynamic = model.element(templateId),
      value2: Dynamic =
        value?.tagName.toLowerCase() === "video"
          ? value.getAttribute("src")
          : null;
    if (!value || !value2) return null;
    let value3: Dynamic = videoElementsWithSource(model, value2),
      value4: Dynamic = value3.indexOf(value);
    return value4 < 0
      ? null
      : {
          src: value2,
          nth: value4,
          of: value3.length,
        };
  }
  function resolveVideoElementIdentity(
    model?: Dynamic,
    identity?: Dynamic,
  ): Dynamic {
    let value: Dynamic = videoElementsWithSource(model, identity.src);
    if (value.length === 0) return "gone";
    if (value.length !== identity.of) return "unsure";
    let value2: Dynamic = Number.parseInt(
      value[identity.nth]?.getAttribute(runtime.DcTplAttribute) ?? "",
      10,
    );
    return Number.isInteger(value2) ? value2 : "gone";
  }
  function isValidVideoDimensions(video?: Dynamic): Dynamic {
    let callback: Dynamic = (input?: Dynamic): Dynamic =>
      Number.isInteger(input) && input > 0 && input <= 16384;
    return (
      (0, runtime.PlatformFileContentTest_3)(video.src) !== null &&
      callback(video.width) &&
      callback(video.height)
    );
  }
  bindRuntimeValue(
    runtime,
    "textExtractionExcludedTags",
    () => textExtractionExcludedTags,
    (value) => {
      textExtractionExcludedTags = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "artboardTextSnapshotLimit",
    () => artboardTextSnapshotLimit,
    (value) => {
      artboardTextSnapshotLimit = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "extractVisibleElementText",
    () => extractVisibleElementText,
  );
  bindRuntimeValue(
    runtime,
    "videoElementsWithSource",
    () => videoElementsWithSource,
    (value) => {
      videoElementsWithSource = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createVideoElementIdentity",
    () => createVideoElementIdentity,
  );
  bindRuntimeValue(
    runtime,
    "resolveVideoElementIdentity",
    () => resolveVideoElementIdentity,
  );
  bindRuntimeValue(
    runtime,
    "isValidVideoDimensions",
    () => isValidVideoDimensions,
  );
  return () => {
    textExtractionExcludedTags = new Set([
      "style",
      "script",
      "link",
      "meta",
      "template",
      "sc-helmet",
      "helmet",
    ]);
    artboardTextSnapshotLimit = 1e3;
    videoElementsWithSource = (input?: Dynamic, options?: Dynamic): Dynamic =>
      input
        .elementsByAttr("src", options)
        .filter(
          (input2?: Dynamic): Dynamic =>
            input2.tagName.toLowerCase() === "video",
        );
  };
}
