/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installExportCssAssets(runtime: RuntimeBindings): () => void {
  var cssImportRulePattern: Dynamic;
  var cssAssetUrlPattern: Dynamic;
  function escapeExportStyleClosingTag(css?: Dynamic): Dynamic {
    return css.replace(/<\/(style)/gi, "<\\/$1");
  }
  function escapeExportScriptClosingTags(script?: Dynamic): Dynamic {
    return script.replace(/<\//g, "<\\u002F");
  }
  function wrapImportedCssConditions(
    css?: Dynamic,
    conditions?: Dynamic,
  ): Dynamic {
    conditions = conditions.trim();
    if (!conditions) return css;
    let value: Dynamic = null,
      value2: Dynamic = null,
      value3: Dynamic = /^layer(?=\s|$|\()(?:\(([^)]*)\))?\s*/i.exec(
        conditions,
      );
    value3 &&
      ((value = (value3[1] ?? "").trim()),
      (conditions = conditions.slice(value3[0].length)));
    let value4: Dynamic = /^supports\(/i.exec(conditions);
    if (value4) {
      let index: Dynamic = 0,
        value6: Dynamic = value4[0].length - 1;
      for (; value6 < conditions.length; value6++)
        if (conditions[value6] === "(") index++;
        else if (conditions[value6] === ")" && --index === 0) {
          value6++;
          break;
        }
      value2 = conditions.slice(value4[0].length - 1, value6);
      conditions = conditions.slice(value6);
    }
    let value5: Dynamic = conditions.trim();
    value5 &&
      (css = `@media ${value5} {
${css}
}`);
    value2 &&
      (css = `@supports ${value2} {
${css}
}`);
    value !== null &&
      (css = value
        ? `@layer ${value} {
${css}
}`
        : `@layer {
${css}
}`);
    return css;
  }
  async function inlineExportCssImports(
    css?: Dynamic,
    path?: Dynamic,
    resolveAsset?: Dynamic,
    assets?: Dynamic,
    depth?: Dynamic,
    options?: Dynamic,
    warnings?: Dynamic,
  ): Promise<Dynamic> {
    if (depth >= runtime.maxCssImportDepth) return css;
    let items: Dynamic = [];
    for (let value of css.matchAll(cssImportRulePattern) as Dynamic) {
      let value2: Dynamic =
          value[1] ?? value[2] ?? value[3] ?? value[4] ?? value[5],
        value3: Dynamic = value2
          .slice(0, value2.indexOf(":") + 1)
          .toLowerCase();
      if (value3 === "data:" || value3 === "blob:") continue;
      let value4: Dynamic = (0, runtime.resolveExportAssetUrl)(value2, path),
        value5: Dynamic = await resolveAsset(value4);
      if (value5) {
        let value6: Dynamic = new TextDecoder().decode(value5.data);
        value6 = await inlineExportCssImports(
          value6,
          value4,
          resolveAsset,
          assets,
          depth + 1,
          options,
          warnings,
        );
        value6 = wrapImportedCssConditions(value6, value[6] || "");
        items.push({
          full: value[0],
          content: value6,
        });
      }
    }
    for (let value of items as Dynamic)
      css = css.split(value.full).join(value.content);
    return options === "data"
      ? inlineExportCssAssetUrls(css, path, resolveAsset, assets, warnings)
      : replaceCssAssetUrlsWithIds(css, path, resolveAsset, assets);
  }
  async function replaceCssAssetUrlsWithIds(
    css?: Dynamic,
    path?: Dynamic,
    resolveAsset?: Dynamic,
    assets?: Dynamic,
  ): Promise<Dynamic> {
    let items: Dynamic = [],
      value: Dynamic;
    for (
      cssAssetUrlPattern.lastIndex = 0;
      (value = cssAssetUrlPattern.exec(css)) !== null;

    ) {
      let value2: Dynamic = value[1] ?? value[2] ?? value[3];
      if (runtime.exportAssetUuidPattern.test(value2.split("#")[0])) continue;
      let value3: Dynamic = value2.indexOf("#"),
        value4: Dynamic = value3 >= 0 ? value2.slice(value3) : "",
        value5: Dynamic = (0, runtime.resolveExportAssetUrl)(value2, path),
        value6: Dynamic;
      if (assets.has(value5)) value6 = assets.get(value5).uuid;
      else {
        let value7: Dynamic = await resolveAsset(value5);
        if (!value7) continue;
        value6 = crypto.randomUUID();
        assets.set(value5, {
          uuid: value6,
          data: value7.data,
          mime: value7.mime,
        });
      }
      items.push({
        original: value[0],
        replacement: `url("${value6}${value4}")`,
      });
    }
    for (let value2 of items as Dynamic)
      css = css.split(value2.original).join(value2.replacement);
    return css;
  }
  async function inlineExportCssAssetUrls(
    css?: Dynamic,
    path?: Dynamic,
    resolveAsset?: Dynamic,
    assets?: Dynamic,
    warnings?: Dynamic,
  ): Promise<Dynamic> {
    let items: Dynamic = [],
      values: Dynamic = new Set(),
      value: Dynamic;
    for (
      cssAssetUrlPattern.lastIndex = 0;
      (value = cssAssetUrlPattern.exec(css)) !== null;

    ) {
      let value2: Dynamic = value[1] ?? value[2] ?? value[3],
        value3: Dynamic = value2.indexOf("#"),
        value4: Dynamic = value3 >= 0 ? value2.slice(value3) : "",
        value5: Dynamic = (0, runtime.resolveExportAssetUrl)(
          value2.split("#")[0],
          path,
        );
      if (values.has(value5)) continue;
      let entry: Dynamic = assets.get(value5);
      entry || (entry = await resolveAsset(value5));
      if (!entry) {
        values.add(value5);
        continue;
      }
      let value6: Dynamic = entry.mime.split(";")[0].trim().toLowerCase();
      if (
        !(
          runtime.alreadyCompressedExportMimeTypes.has(value6) &&
          (0, runtime.hasCompressedFileSignature)(entry.data)
        ) &&
        (0, runtime.containsProjectServeAccessToken)(
          new TextDecoder().decode(entry.data),
        )
      ) {
        warnings.push(
          `serve token not removed: asset "${(0, runtime.redactProjectServeAccessToken)(value5)}" referenced from a stylesheet ships bytes matching a project serve access token \u2014 the published file may carry a live access token`,
        );
        values.add(value5);
        continue;
      }
      let value7: Dynamic = runtime.mimeTypePattern.test(value6)
        ? value6
        : "application/octet-stream";
      items.push({
        original: value[0],
        replacement: `url("data:${value7};base64,${(0, runtime.encodeBinaryBase64)(entry.data)}${value4}")`,
      });
    }
    for (let value2 of items as Dynamic)
      css = css.split(value2.original).join(value2.replacement);
    return css;
  }
  bindRuntimeValue(
    runtime,
    "escapeExportStyleClosingTag",
    () => escapeExportStyleClosingTag,
  );
  bindRuntimeValue(
    runtime,
    "escapeExportScriptClosingTags",
    () => escapeExportScriptClosingTags,
  );
  bindRuntimeValue(
    runtime,
    "cssImportRulePattern",
    () => cssImportRulePattern,
    (value) => {
      cssImportRulePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "wrapImportedCssConditions",
    () => wrapImportedCssConditions,
  );
  bindRuntimeValue(
    runtime,
    "inlineExportCssImports",
    () => inlineExportCssImports,
  );
  bindRuntimeValue(
    runtime,
    "cssAssetUrlPattern",
    () => cssAssetUrlPattern,
    (value) => {
      cssAssetUrlPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "replaceCssAssetUrlsWithIds",
    () => replaceCssAssetUrlsWithIds,
  );
  bindRuntimeValue(
    runtime,
    "inlineExportCssAssetUrls",
    () => inlineExportCssAssetUrls,
  );
  return () => {
    cssImportRulePattern =
      /@import\s+(?:url\(\s*(?:"([^"]+)"|'([^']+)'|([^)"'\s][^)]*?))\s*\)|"([^"]+)"|'([^']+)')([^;]*);/gi;
    cssAssetUrlPattern =
      /url\(\s*(?:"(?!data:|blob:|#)([^"]+)"|'(?!data:|blob:|#)([^']+)'|(?!['"]|data:|blob:|#)([^)]+?))\s*\)/gi;
  };
}
