/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPreviewAssetRewriting(
  runtime: RuntimeBindings,
): () => void {
  var PreviewAssetRewritingWebpAvifPattern: Dynamic;
  var PreviewAssetRewritingPattern: Dynamic;
  var PreviewAssetRewritingPngJpgJpegConfig: Dynamic;
  var PreviewAssetRewritingSlice: Dynamic;
  var PreviewAssetRewritingSourceFilesFromDirConfig: Dynamic;
  function resolveProjectAssetPath(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic = options.split("#")[0].split("?")[0].trim();
    if (
      /(^|\/)\.{0,2}$/.test(value) ||
      /^[a-z][a-z0-9+.-]*:/i.test(value) ||
      value.startsWith("//")
    )
      return null;
    value.startsWith("/appifact/")
      ? ((value = value.slice(10)), (input = ""))
      : value.startsWith("/") && (input = "");
    try {
      value = decodeURIComponent(value);
    } catch {}
    let items: Dynamic = [];
    for (let value2 of (input + value).split("/") as Dynamic)
      value2 === "" ||
        value2 === "." ||
        (value2 === ".." ? items.pop() : items.push(value2));
    return items.length > 0 ? items.join("/") : null;
  }
  function relativeProjectPath(input?: Dynamic, options?: Dynamic): Dynamic {
    let value: Dynamic = input.split("/").filter(Boolean),
      value2: Dynamic = options.split("/"),
      index: Dynamic = 0;
    for (
      ;
      index < value.length &&
      index < value2.length - 1 &&
      value[index] === value2[index];

    )
      index++;
    return "../".repeat(value.length - index) + value2.slice(index).join("/");
  }
  function rewriteProjectAssets(
    input?: Dynamic,
    options?: Dynamic,
    context: Dynamic = "",
  ): Dynamic {
    if (
      PreviewAssetRewritingSourceFilesFromDirConfig?.files === options &&
      PreviewAssetRewritingSourceFilesFromDirConfig.source === input &&
      PreviewAssetRewritingSourceFilesFromDirConfig.fromDir === context
    )
      return PreviewAssetRewritingSourceFilesFromDirConfig.out;
    let value: Dynamic = input,
      value2: Dynamic = Object.entries(options);
    context !== "" &&
      value2.sort(
        ([input2]: Dynamic, [options2]: Dynamic): Dynamic =>
          Number(options2.startsWith(context)) -
          Number(input2.startsWith(context)),
      );
    for (let [value3, value4] of value2 as Dynamic) {
      if (!PreviewAssetRewritingWebpAvifPattern.test(value3)) continue;
      let value5: Dynamic =
          context === "" ? value3 : relativeProjectPath(context, value3),
        value6: Dynamic = encodeURI(value3);
      if (
        !value.includes(value3) &&
        !value.includes(value5) &&
        (value6 === value3 ||
          (!value.includes(value6) && !value.includes(encodeURI(value5))))
      )
        continue;
      let value7: Dynamic = value3
          .slice(value3.lastIndexOf(".") + 1)
          .toLowerCase(),
        value8: Dynamic =
          "data:" +
          (PreviewAssetRewritingPngJpgJpegConfig[value7] ??
            "application/octet-stream") +
          ";base64," +
          value4,
        values: Dynamic = new Set([
          value3,
          "./" + value3,
          "/" + value3,
          value5,
        ]);
      value5.startsWith("../") || values.add("./" + value5);
      if (value6 !== value3)
        for (let value9 of [...values] as Dynamic)
          values.add(encodeURI(value9));
      for (let value9 of values as Dynamic) {
        for (let value10 of ["src=", "poster=", "href="] as Dynamic) {
          for (let value11 of ['"', "'"] as Dynamic)
            value = value
              .split(value10 + value11 + value9 + value11)
              .join(value10 + value11 + value8 + value11);
          for (let value11 of [
            " ",
            ">",
            `
`,
            "	",
            "\r",
            "\f",
          ] as Dynamic)
            value = value
              .split(value10 + value9 + value11)
              .join(value10 + value8 + value11);
        }
        for (let value10 of ['"', "'", ""] as Dynamic)
          value = value
            .split("url(" + value10 + value9 + value10 + ")")
            .join("url(" + value10 + value8 + value10 + ")");
      }
    }
    /srcset\s*=/i.test(value) &&
      (value = value.replace(
        /(\b(?:data-)?srcset\s*=\s*)("([^"]*)"|'([^']*)')/gi,
        (
          input2?: Dynamic,
          options2?: Dynamic,
          context2?: Dynamic,
          value3?: Dynamic,
          extra?: Dynamic,
        ): Dynamic => {
          let value4: Dynamic = value3 ?? extra ?? "",
            value5: Dynamic = context2[0],
            value6: Dynamic = value4
              .split(",")
              .map((input3?: Dynamic): Dynamic => {
                let value7: Dynamic = input3.trim();
                if (value7 === "") return input3;
                let value8: Dynamic = value7.search(/\s/),
                  value9: Dynamic =
                    value8 < 0 ? value7 : value7.slice(0, value8),
                  value10: Dynamic = value8 < 0 ? "" : value7.slice(value8),
                  value11: Dynamic = resolveProjectAssetPath(context, value9);
                if (
                  value11 === null ||
                  options[value11] == null ||
                  !PreviewAssetRewritingWebpAvifPattern.test(value11)
                )
                  return input3;
                let value12: Dynamic = value11
                  .slice(value11.lastIndexOf(".") + 1)
                  .toLowerCase();
                return (
                  " data:" +
                  (PreviewAssetRewritingPngJpgJpegConfig[value12] ??
                    "application/octet-stream") +
                  ";base64," +
                  options[value11] +
                  value10
                );
              });
          return options2 + value5 + value6.join(",").trim() + value5;
        },
      ));
    PreviewAssetRewritingSourceFilesFromDirConfig = {
      source: input,
      files: options,
      fromDir: context,
      out: value,
    };
    return value;
  }
  bindRuntimeValue(
    runtime,
    "PreviewAssetRewritingWebpAvifPattern",
    () => PreviewAssetRewritingWebpAvifPattern,
    (value) => {
      PreviewAssetRewritingWebpAvifPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PreviewAssetRewritingPattern",
    () => PreviewAssetRewritingPattern,
    (value) => {
      PreviewAssetRewritingPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PreviewAssetRewritingPngJpgJpegConfig",
    () => PreviewAssetRewritingPngJpgJpegConfig,
    (value) => {
      PreviewAssetRewritingPngJpgJpegConfig = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PreviewAssetRewritingSlice",
    () => PreviewAssetRewritingSlice,
    (value) => {
      PreviewAssetRewritingSlice = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "resolveProjectAssetPath",
    () => resolveProjectAssetPath,
  );
  bindRuntimeValue(runtime, "relativeProjectPath", () => relativeProjectPath);
  bindRuntimeValue(
    runtime,
    "PreviewAssetRewritingSourceFilesFromDirConfig",
    () => PreviewAssetRewritingSourceFilesFromDirConfig,
    (value) => {
      PreviewAssetRewritingSourceFilesFromDirConfig = value;
    },
  );
  bindRuntimeValue(runtime, "rewriteProjectAssets", () => rewriteProjectAssets);
  return () => {
    PreviewAssetRewritingWebpAvifPattern =
      /\.(png|jpe?g|gif|webp|avif|bmp|svg)$/i;
    PreviewAssetRewritingPattern = /\.(m?js|jsx|tsx)$/i;
    PreviewAssetRewritingPngJpgJpegConfig = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      webp: "image/webp",
      avif: "image/avif",
      bmp: "image/bmp",
      svg: "image/svg+xml",
    };
    PreviewAssetRewritingSlice = (input?: Dynamic): Dynamic =>
      input.slice(0, input.lastIndexOf("/") + 1);
    PreviewAssetRewritingSourceFilesFromDirConfig = null;
  };
}
