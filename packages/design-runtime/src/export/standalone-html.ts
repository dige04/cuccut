import type { OwnedBytes } from "../contracts/export";
/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";
export function installExportStandaloneHtml(
  runtime: RuntimeBindings,
): () => void {
  var safeExportColorPattern: Dynamic;
  var designSystemBaseFilename: Dynamic;
  var exportReactUmdUrl: Dynamic;
  var exportReactUmdIntegrity: Dynamic;
  var exportReactDomUmdUrl: Dynamic;
  var exportReactDomUmdIntegrity: Dynamic;
  var exportBabelStandaloneUrl: Dynamic;
  var exportBabelStandaloneIntegrity: Dynamic;
  var alreadyCompressedExportMimeTypes: Dynamic;
  var maxCssImportDepth: Dynamic;
  var maxEmbeddedExportDepth: Dynamic;
  var jsxAssetFilenamePattern: Dynamic;
  var mimeTypePattern: Dynamic;
  var exportAssetUuidPattern: Dynamic;
  var imageSlotsStateFilename: Dynamic;
  var projectServeUrlPattern: Dynamic;
  var projectServeAccessTokenPattern: Dynamic;
  var designSystemAssetPathPattern: Dynamic;
  var invalidExportAssetPathSegmentsPattern: Dynamic;
  function sanitizeExportColor(color?: Dynamic, fallback?: Dynamic): Dynamic {
    let value: Dynamic = (color ?? "").trim();
    return safeExportColorPattern.test(value) ? value : fallback;
  }
  function maskJavaScriptCommentsAndStrings(source?: Dynamic): Dynamic {
    let flag: Dynamic = false,
      flag2: Dynamic = false,
      value: Dynamic = source.split(`
`);
    for (let index: Dynamic = 0; index < value.length; index++) {
      let value2: Dynamic = value[index],
        value3: Dynamic = new Array(value2.length).fill(" "),
        entries: Dynamic = new Map(),
        value4: Dynamic = null,
        value5: Dynamic = -1,
        index2: Dynamic = 0;
      for (; index2 < value2.length; ) {
        let value9: Dynamic = value2[index2],
          value10: Dynamic = value2[index2 + 1];
        if (flag) {
          if (value9 === "*" && value10 === "/") {
            flag = false;
            index2 += 2;
            continue;
          }
          index2++;
          continue;
        }
        if (flag2) {
          if (value9 === "\\") {
            index2 += 2;
            continue;
          }
          value9 === "`" && (flag2 = false);
          index2++;
          continue;
        }
        if (value4 != null) {
          if (value9 === "\\") {
            index2 += 2;
            continue;
          }
          value9 === value4 &&
            ((value3[index2] = value9),
            entries.set(value5, index2),
            (value4 = null));
          index2++;
          continue;
        }
        if (value9 === "'" || value9 === '"') {
          value3[index2] = value9;
          value4 = value9;
          value5 = index2;
          index2++;
          continue;
        }
        if (value9 === "`") {
          flag2 = true;
          index2++;
          continue;
        }
        if (value9 === "/" && value10 === "/") break;
        if (value9 === "/" && value10 === "*") {
          flag = true;
          index2 += 2;
          continue;
        }
        value3[index2] = value9;
        index2++;
      }
      let value6: Dynamic = value3.join(""),
        value7: Dynamic = /const\s+base\s*=\s*(['"])/g,
        value8: Dynamic;
      for (; (value8 = value7.exec(value6)) != null; ) {
        let value9: Dynamic = value6.slice(0, value8.index);
        if (!(/^\s*$/.test(value9) || /[;{}]\s*$/.test(value9))) continue;
        let value10: Dynamic = value8.index + value8[0].length - 1,
          entry: Dynamic = entries.get(value10);
        if (entry != null)
          return {
            lineIndex: index,
            value: value2.slice(value10 + 1, entry),
            quoteStart: value10,
            quoteEnd: entry,
            quote: value8[1],
          };
      }
    }
    return null;
  }
  function encodeBinaryBase64(bytes: Uint8Array | ArrayBuffer): string {
    let value = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
      text = "";
    for (let index = 0; index < value.length; index += 32768)
      text += String.fromCharCode(...value.subarray(index, index + 32768));
    return btoa(text);
  }
  function decodeBinaryBase64(base64: string): OwnedBytes {
    let value = atob(base64),
      value2 = new Uint8Array(value.length);
    for (let index = 0; index < value.length; index++)
      value2[index] = value.charCodeAt(index);
    return value2;
  }
  function formatExportByteSize(
    bytes?: Dynamic,
    options: Dynamic = {},
  ): Dynamic {
    let {
        decimals: value = 1,
        ceil: value2 = false,
        binary: value3 = false,
      }: Dynamic = options,
      value4: Dynamic = 1024 * 1024;
    if (bytes >= value4) {
      let value5: Dynamic = 10 ** value;
      return `${(value2 ? Math.ceil((bytes / value4) * value5) / value5 : bytes / value4).toFixed(value)} ${value3 ? "MiB" : "MB"}`;
    }
    if (bytes >= 1024) {
      let value5: Dynamic = bytes / 1024;
      return `${value2 ? Math.ceil(value5) : Math.round(value5)} ${value3 ? "KiB" : "KB"}`;
    }
    return `${bytes} B`;
  }
  function hasCompressedFileSignature(bytes?: Dynamic): Dynamic {
    if (bytes.length < 12) return false;
    let value: Dynamic = bytes;
    return (
      (value[0] === 137 &&
        value[1] === 80 &&
        value[2] === 78 &&
        value[3] === 71) ||
      (value[0] === 255 && value[1] === 216 && value[2] === 255) ||
      (value[0] === 71 &&
        value[1] === 73 &&
        value[2] === 70 &&
        value[3] === 56) ||
      (value[0] === 82 &&
        value[1] === 73 &&
        value[2] === 70 &&
        value[3] === 70) ||
      (value[0] === 119 && value[1] === 79 && value[2] === 70) ||
      (value[0] === 31 && value[1] === 139) ||
      (value[0] === 80 && value[1] === 75) ||
      (value[0] === 79 &&
        value[1] === 103 &&
        value[2] === 103 &&
        value[3] === 83) ||
      (value[0] === 26 &&
        value[1] === 69 &&
        value[2] === 223 &&
        value[3] === 163) ||
      (value[0] === 73 && value[1] === 68 && value[2] === 51) ||
      (value[0] === 255 && (value[1] & 224) === 224) ||
      (value[4] === 102 &&
        value[5] === 116 &&
        value[6] === 121 &&
        value[7] === 112)
    );
  }
  function parseImageSlotState(bytes?: Dynamic): Dynamic {
    let value: Dynamic;
    try {
      value = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      return null;
    }
    if (value === null || typeof value != "object" || Array.isArray(value))
      return null;
    let entries: Dynamic = new Map();
    for (let [value2, value3] of Object.entries(value) as Dynamic) {
      let value4: Dynamic =
        typeof value3 == "string"
          ? value3
          : value3 !== null &&
              typeof value3 == "object" &&
              "u" in value3 &&
              typeof value3.u == "string"
            ? value3.u
            : null;
      value4 !== null &&
        /^data:image\//i.test(value4) &&
        entries.set(value2, value4);
    }
    return entries;
  }
  function parseExportSrcset(srcset?: Dynamic): Dynamic {
    let items: Dynamic = [],
      index: Dynamic = 0,
      length: Dynamic = srcset.length,
      callback: Dynamic = (input?: Dynamic): Dynamic =>
        input === " " ||
        input === "	" ||
        input ===
          `
` ||
        input === "\r" ||
        input === "\f";
    for (; index < length; ) {
      for (
        ;
        index < length && (callback(srcset[index]) || srcset[index] === ",");

      )
        index++;
      if (index >= length) break;
      let value: Dynamic = index;
      for (; index < length && !callback(srcset[index]); ) index++;
      let value2: Dynamic = srcset.slice(value, index);
      if (value2.endsWith(",")) {
        for (; value2.endsWith(","); ) value2 = value2.slice(0, -1);
        value2 && items.push(value2);
        continue;
      }
      for (; index < length && callback(srcset[index]); ) index++;
      let value3: Dynamic = index;
      for (; index < length && srcset[index] !== ","; ) index++;
      let value4: Dynamic = srcset.slice(value3, index).trim();
      items.push(value4 ? `${value2} ${value4}` : value2);
    }
    return items;
  }
  function normalizeExportHtmlOutsideScripts(html?: Dynamic): Dynamic {
    return html
      .split(/(<script\b[^>]*>[\s\S]*?<\/script\s*>)/i)
      .map(
        (input?: Dynamic, options?: Dynamic): Dynamic =>
          options % 2 ? input : (0, runtime.encodeCamelCaseAttributes)(input),
      )
      .join("");
  }
  function normalizeExportDesignTags(html?: Dynamic): Dynamic {
    for (let [value, value2] of Object.entries(
      runtime.HtmlTagNormalizationSelectTableTbodyConfig,
    ) as Dynamic)
      html = html.replace(
        new RegExp("(</?)" + value + "(?=[\\s>])", "gi"),
        "$1" + value2,
      );
    return html;
  }
  function decodeExportPathEscapes(
    path?: Dynamic,
    percentDecode: Dynamic = false,
  ): Dynamic {
    let value: Dynamic = path;
    for (let index: Dynamic = 0; index < 2; index++)
      value = value
        .replace(/&amp;/gi, "&")
        .replace(/&quest;/gi, "?")
        .replace(/&sol;/gi, "/")
        .replace(/&period;/gi, ".")
        .replace(/&equals;/gi, "=")
        .replace(/&percnt;/gi, "%")
        .replace(
          /&#x([0-9a-f]+);?/gi,
          (input?: Dynamic, options?: Dynamic): Dynamic => {
            let value2: Dynamic = parseInt(options, 16);
            return value2 > 0 && value2 < 1114112
              ? String.fromCodePoint(value2)
              : input;
          },
        )
        .replace(
          /&#(\d+);?/g,
          (input?: Dynamic, options?: Dynamic): Dynamic => {
            let value2: Dynamic = Number(options);
            return value2 > 0 && value2 < 1114112
              ? String.fromCodePoint(value2)
              : input;
          },
        )
        .replace(
          percentDecode
            ? /\\([0-9a-f]{1,6})(?:\r\n|[ \t\n\r\f])?/gi
            : /\\u([0-9a-f]{4})/gi,
          (input?: Dynamic, options?: Dynamic): Dynamic => {
            let value2: Dynamic = parseInt(options, 16);
            return value2 > 0 && value2 < 1114112
              ? String.fromCodePoint(value2)
              : input;
          },
        )
        .replace(
          /\\x([0-9a-f]{2})/gi,
          (input?: Dynamic, options?: Dynamic): Dynamic =>
            String.fromCharCode(parseInt(options, 16)),
        )
        .replace(
          /\\u\{([0-9a-f]+)\}/gi,
          (input?: Dynamic, options?: Dynamic): Dynamic => {
            let value2: Dynamic = parseInt(options, 16);
            return value2 > 0 && value2 < 1114112
              ? String.fromCodePoint(value2)
              : input;
          },
        )
        .replace(
          /\\([0-3][0-7]{0,2}|[4-7][0-7]?)/g,
          (input?: Dynamic, options?: Dynamic): Dynamic => {
            let value2: Dynamic = parseInt(options, 8);
            return value2 > 0 && value2 < 256
              ? String.fromCharCode(value2)
              : input;
          },
        )
        .replace(
          /%([0-9a-f]{2})/gi,
          (input?: Dynamic, options?: Dynamic): Dynamic =>
            String.fromCharCode(parseInt(options, 16)),
        )
        .replace(/\\(\r\n|[\n\r\f\u2028\u2029])/g, "")
        .replace(/\\(.)/g, "$1");
    return value;
  }
  function containsProjectServeAccessToken(path?: Dynamic): Dynamic {
    return (
      projectServeAccessTokenPattern.test(decodeExportPathEscapes(path)) ||
      projectServeAccessTokenPattern.test(decodeExportPathEscapes(path, true))
    );
  }
  function containsProjectServeCredential(path?: Dynamic): Dynamic {
    for (let value of [
      decodeExportPathEscapes(path),
      decodeExportPathEscapes(path, true),
    ] as Dynamic) {
      let flag: Dynamic = false;
      value.replace(
        projectServeUrlPattern,
        (items?: Dynamic, items2?: Dynamic): Dynamic => (
          items.length > items2.length && (flag = true),
          items
        ),
      );
      if (flag || projectServeAccessTokenPattern.test(value)) return true;
    }
    return false;
  }
  function isSuspiciousExportAssetPath(path?: Dynamic): Dynamic {
    let callback: Dynamic = (input?: Dynamic): Dynamic =>
        /\\|%(?:[0-9a-f]{2}|u[0-9a-f]{4})/i.test(input) ||
        /\p{C}/u.test(input) ||
        /\p{Zl}|\p{Zp}|(?!\x20)\p{Zs}/u.test(input) ||
        /(?=[^\x00-\x7f])\p{S}/u.test(input) ||
        /(^|[^\p{L}\p{M}])\p{M}/u.test(input),
      value: Dynamic = path.normalize("NFKC");
    return (
      callback(path) ||
      callback(value) ||
      value.split("/").length !== path.split("/").length
    );
  }
  function matchesNormalizedPathPattern(
    path?: Dynamic,
    pattern?: Dynamic,
  ): Dynamic {
    return pattern.test(path) || pattern.test(path.normalize("NFKC"));
  }
  function redactProjectServeAccessToken(path?: Dynamic): Dynamic {
    let value: Dynamic = path,
      value2: Dynamic = value.indexOf("?");
    value2 >= 0 &&
      containsProjectServeAccessToken(value.slice(value2)) &&
      (value = value.slice(0, value2));
    value = value.replace(
      /\/_t\/([^/]+)\//i,
      (input?: Dynamic, options?: Dynamic): Dynamic =>
        projectServeAccessTokenPattern.test(options) ? "/" : input,
    );
    return containsProjectServeAccessToken(value)
      ? "(path withheld: it matches a project serve access token)"
      : value;
  }
  function parseExportRuntimeAssetPaths(source?: Dynamic): Dynamic {
    let value: Dynamic = /for\s*\(\s*const\s+p\s+of\s*\[/.exec(source);
    if (!value) return null;
    let items: Dynamic = [],
      value2: Dynamic = value.index + value[0].length,
      state: Dynamic = {
        n: `
`,
        t: "	",
        r: "\r",
        b: "\b",
        f: "\f",
        v: "\v",
        0: "\0",
      };
    for (; value2 < source.length; ) {
      let value3: Dynamic = source[value2];
      if (value3 === "]") return items;
      if (/[\s,]/.test(value3)) {
        value2++;
        continue;
      }
      if (value3 !== "'" && value3 !== '"') return null;
      let value4: Dynamic = value3;
      value2++;
      let text: Dynamic = "";
      for (;;) {
        if (value2 >= source.length) return null;
        let value5: Dynamic = source[value2];
        if (value5 === value4) {
          value2++;
          break;
        }
        if (value5 === "\\") {
          let value6: Dynamic = source[value2 + 1];
          if (value6 === undefined) return null;
          if (value6 === "u" || value6 === "x") {
            let value7: Dynamic = value6 === "u" ? 4 : 2,
              value8: Dynamic = source.slice(value2 + 2, value2 + 2 + value7);
            if (!new RegExp("^[0-9a-fA-F]{" + value7 + "}$").test(value8))
              return null;
            text += String.fromCharCode(parseInt(value8, 16));
            value2 += 2 + value7;
            continue;
          }
          text += state[value6] ?? value6;
          value2 += 2;
          continue;
        }
        text += value5;
        value2++;
      }
      text && items.push(text);
    }
    return null;
  }
  async function bundleStandaloneDesignHtml(
    html?: Dynamic,
    path?: Dynamic,
    resolveAsset?: Dynamic,
    context: Dynamic = {},
    options: Dynamic = {},
  ): Promise<Dynamic> {
    let state: Dynamic = {
        ancestors: context.ancestors ?? new Set([path]),
        depth: context.depth ?? 0,
        pages: context.pages ?? new Map(),
        pageOrder: context.pageOrder ?? [],
        dsProject: context.dsProject ?? false,
      },
      value: Dynamic = /<x-dc(?:\s[^>]*)?>/.exec(html),
      value2: Dynamic = html.lastIndexOf("</x-dc>"),
      value3: Dynamic =
        value && value2 >= value.index + value[0].length
          ? html.slice(0, value.index + value[0].length) +
            normalizeExportDesignTags(
              normalizeExportHtmlOutsideScripts(
                (0, runtime.expandSelfClosingImports)(
                  html.slice(value.index + value[0].length, value2),
                ),
              ),
            ) +
            html.slice(value2)
          : html,
      value4: Dynamic = new DOMParser().parseFromString(value3, "text/html"),
      entries: Dynamic = new Map(),
      entries2: Dynamic = new Map(),
      items: Dynamic = [],
      values: Dynamic = new Set(),
      callback: Dynamic = async (
        input?: Dynamic,
        options2?: Dynamic,
      ): Promise<Dynamic> => {
        let value19: Dynamic = await resolveAsset(input, options2);
        !value19 &&
          !values.has(input) &&
          (values.add(input),
          items.push(
            `asset not found: ${redactProjectServeAccessToken(input)}`,
          ));
        return value19;
      };
    async function value5(input?: Dynamic): Promise<Dynamic> {
      if (!input || input.startsWith("#")) return null;
      let value19: Dynamic = input
        .slice(0, input.indexOf(":") + 1)
        .toLowerCase();
      if (
        value19 === "data:" ||
        value19 === "blob:" ||
        value19 === "javascript:"
      )
        return null;
      let value20: Dynamic = resolveExportAssetUrl(input, path);
      if (entries.has(value20)) return entries.get(value20).uuid;
      if (entries2.has(value20)) return entries2.get(value20);
      let value21: Dynamic = (async (): Promise<Dynamic> => {
        let value23: Dynamic = await callback(value20);
        if (!value23) return null;
        let value24: Dynamic = crypto.randomUUID();
        entries.set(value20, {
          uuid: value24,
          data: value23.data,
          mime: value23.mime,
        });
        return value24;
      })();
      entries2.set(value20, value21);
      let value22: Dynamic = await value21;
      entries2.delete(value20);
      return value22;
    }
    async function value6(
      element2?: Dynamic,
      options2?: Dynamic,
    ): Promise<Dynamic> {
      let attribute: Dynamic = element2.getAttribute(options2);
      if (!attribute) return;
      let value19: Dynamic = attribute.indexOf("#"),
        value20: Dynamic = value19 >= 0 ? attribute.slice(value19) : "",
        value21: Dynamic = await value5(attribute);
      value21 && element2.setAttribute(options2, value21 + value20);
    }
    async function value7(element2?: Dynamic): Promise<Dynamic> {
      for (let value19 of ["srcset", "sc-camel-src-set"] as Dynamic) {
        let attribute: Dynamic = element2.getAttribute(value19);
        if (!attribute) continue;
        let value20: Dynamic = parseExportSrcset(attribute),
          items3: Dynamic = [];
        for (let value21 of value20 as Dynamic) {
          let [value22, ...value23]: Dynamic = value21.split(/\s+/),
            value24: Dynamic = await value5(value22);
          items3.push(
            value24 ? `${value24} ${value23.join(" ")}`.trim() : value21,
          );
        }
        element2.setAttribute(value19, items3.join(", "));
      }
    }
    await Promise.all(
      Array.from(value4.querySelectorAll("img")).map(
        async (input?: Dynamic): Promise<Dynamic> => {
          await value6(input, "src");
          await value7(input);
        },
      ),
    );
    await Promise.all(
      Array.from(
        value4.querySelectorAll("source[srcset], source[sc-camel-src-set]"),
      ).map((input?: Dynamic): Dynamic => value7(input)),
    );
    let value8: Dynamic = Array.from(
      value4.querySelectorAll("image-slot"),
    ).concat(
      Array.from(
        value4.querySelectorAll(
          'x-dc x-import[component-from-global-scope="image-slot"]',
        ),
      ),
    );
    if (value8.length > 0) {
      let value19: Dynamic = resolveExportAssetUrl(
          imageSlotsStateFilename,
          path,
        ),
        value20: Dynamic = await resolveAsset(value19, {
          optional: true,
        }),
        value21: Dynamic = value20 ? parseImageSlotState(value20.data) : null;
      value20 &&
        value21 === null &&
        items.push(
          `image-slot sidecar ${redactProjectServeAccessToken(value19)} could not be parsed \u2014 user-dropped slot images will not appear in the bundle`,
        );
      await Promise.all(
        value8.map(async (element2?: Dynamic): Promise<Dynamic> => {
          let attribute: Dynamic = element2.getAttribute("id"),
            value22: Dynamic = attribute ? value21?.get(attribute) : undefined;
          if (value22 !== undefined) {
            let entry: Dynamic = entries.get(value22);
            if (!entry) {
              let [, value23, value24]: Dynamic =
                /^data:(image\/[\w.+-]+);base64,([\s\S]*)$/i.exec(value22) ??
                [];
              if (value23 !== undefined && value24 !== undefined)
                try {
                  entry = {
                    uuid: crypto.randomUUID(),
                    data: decodeBinaryBase64(value24),
                    mime: value23.toLowerCase(),
                  };
                  entries.set(value22, entry);
                } catch {}
            }
            if (entry) {
              element2.setAttribute("src", entry.uuid);
              element2.removeAttribute("credit");
              element2.removeAttribute("credit-href");
              return;
            }
            items.push(
              `image-slot "${attribute}": the stored replacement image could not be decoded \u2014 the bundle falls back to the slot's src image`,
            );
          }
          element2.tagName.toLowerCase() === "image-slot" &&
            element2.hasAttribute("src") &&
            (await value6(element2, "src"));
        }),
      );
    }
    await Promise.all(
      Array.from(value4.querySelectorAll("svg image, svg use")).map(
        async (input?: Dynamic): Promise<Dynamic> => {
          input.hasAttribute("href")
            ? await value6(input, "href")
            : input.hasAttribute("xlink:href")
              ? await value6(input, "xlink:href")
              : input.hasAttribute("sc-camel-xlink-href") &&
                (await value6(input, "sc-camel-xlink-href"));
        },
      ),
    );
    let items2: Dynamic = [],
      value9: Dynamic = Array.from(
        value4.querySelectorAll('meta[name="ext-resource-dependency"]'),
      );
    await Promise.all(
      value9.map(async (element2?: Dynamic): Promise<Dynamic> => {
        let attribute: Dynamic = element2.getAttribute("content"),
          attribute2: Dynamic = element2.getAttribute("data-resource-id");
        if (attribute && attribute2) {
          let value19: Dynamic = await value5(attribute);
          value19 &&
            items2.push({
              id: attribute2,
              uuid: value19,
            });
        }
        element2.remove();
      }),
    );
    await Promise.all(
      Array.from(
        value4.querySelectorAll(
          "video[src], audio[src], source[src], track[src]",
        ),
      ).map((input?: Dynamic): Dynamic => value6(input, "src")),
    );
    await Promise.all(
      Array.from(value4.querySelectorAll("video[poster]")).map(
        (input?: Dynamic): Dynamic => value6(input, "poster"),
      ),
    );
    await Promise.all(
      Array.from(
        value4.querySelectorAll(
          'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]',
        ),
      ).map((input?: Dynamic): Dynamic => value6(input, "href")),
    );
    {
      let value19: Dynamic =
          /const\s+(\w+)\s*=\s*document\.createElement\(\s*(['"])link\2\s*\)\s*;\s*\1\.rel\s*=\s*(['"])stylesheet\3\s*;\s*\1\.href\s*=\s*base\s*\+\s*(['"])\/\4\s*\+\s*p\s*;\s*document\.head\.appendChild\(\s*\1\s*\)\s*;(?=\s*\})/,
        value20: Dynamic =
          /(\w+)\.src\s*=\s*base\s*\+\s*(['"])\/_ds_bundle\.js\2\s*;/,
        values4: Dynamic = new Set(),
        values5: Dynamic = new Set(),
        callback3: Dynamic = async (
          input?: Dynamic,
          options2?: Dynamic,
          context2: Dynamic = "",
        ): Promise<Dynamic> => {
          if (
            matchesNormalizedPathPattern(input, /(^|\/)\.\.(\/|$)/) ||
            isSuspiciousExportAssetPath(input)
          ) {
            values5.has(input) ||
              (values5.add(input),
              items.push(
                `design-system file not embedded (${redactProjectServeAccessToken(input)}): the resolved path carries dot segments \u2014 point ds-base.js at a plain _ds/<folder> path to publish this page with its design system`,
              ));
            return null;
          }
          if (/\/v1\/design\/projects\/[^/]+\/serve\//.test(input)) {
            values5.has(input) ||
              (values5.add(input),
              items.push(
                `design-system file not embedded (${redactProjectServeAccessToken(input)}): project serve URLs may not be loaded as design-system files \u2014 point ds-base.js at the project's _ds/<folder> tree to publish this page with its design system`,
              ));
            return null;
          }
          let callback4: Dynamic = async (
              input2?: Dynamic,
            ): Promise<Dynamic> => {
              let value23: Dynamic = /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(
                input2,
              );
              if (/\/v1\/design\/projects\/[^/]+\/serve\//.test(input2)) {
                values5.has(input2) ||
                  (values5.add(input2),
                  items.push(
                    `design-system file not embedded (${redactProjectServeAccessToken(input2)}): project serve URLs may not be referenced from design-system stylesheets \u2014 the reference ships live and will not load for public viewers`,
                  ));
                return null;
              }
              if (
                !value23 &&
                context2 !== "" &&
                matchesNormalizedPathPattern(input2, /(^|\/)\.\.(\/|$)/)
              ) {
                values5.has(input2) ||
                  (values5.add(input2),
                  items.push(
                    `design-system file not embedded (${redactProjectServeAccessToken(input2)}): referenced from a design-system stylesheet with dot segments in the path \u2014 design-system styles may only embed plain relative paths from their own tree`,
                  ));
                return null;
              }
              if (
                !value23 &&
                context2 !== "" &&
                isSuspiciousExportAssetPath(input2)
              ) {
                values5.has(input2) ||
                  (values5.add(input2),
                  items.push(
                    `design-system file not embedded (${redactProjectServeAccessToken(input2)}): referenced from a design-system stylesheet with unsupported characters in the path \u2014 design-system styles may only embed plain relative paths from their own tree`,
                  ));
                return null;
              }
              if (
                !value23 &&
                context2 !== "" &&
                input2 !== context2 &&
                !input2.startsWith(context2 + "/")
              ) {
                values5.has(input2) ||
                  (values5.add(input2),
                  items.push(
                    `design-system file not embedded (${redactProjectServeAccessToken(input2)}): referenced from a design-system stylesheet but resolves outside the design-system tree \u2014 design-system styles may only embed files from their own tree`,
                  ));
                return null;
              }
              let value24: Dynamic = await resolveAsset(input2);
              !value24 &&
                !values5.has(input2) &&
                (values5.add(input2),
                items.push(
                  `design-system file not embedded (${redactProjectServeAccessToken(input2)}): not found \u2014 referenced from a design-system stylesheet, and the published page may not render its design system`,
                ));
              return value24;
            },
            callback5: Dynamic = async (input2?: Dynamic): Promise<Dynamic> => {
              let value23: Dynamic = await (0, runtime.inlineExportCssImports)(
                input2,
                input,
                callback4,
                entries,
                0,
                "data",
                items,
              );
              /\/v1\/design\/projects\/[^/]+\/serve\//.test(value23) &&
                ((value23 = value23.replace(projectServeUrlPattern, "$1")),
                items.push(
                  `design-system file "${redactProjectServeAccessToken(input)}" references project serve URLs \u2014 detected access tokens were removed, but the URLs (and project id) ship in the published file and will not load for public viewers`,
                ));
              containsProjectServeCredential(value23) &&
                items.push(
                  `serve token not removed: design-system file "${redactProjectServeAccessToken(input)}" ships project serve URLs whose query tokens were not stripped \u2014 the published file may carry a live access token`,
                );
              return {
                uuid: crypto.randomUUID(),
                data: new TextEncoder().encode(value23),
                mime: "text/css",
              };
            },
            entry: Dynamic = entries.get(input);
          if (entry) {
            if (options2 === "js") {
              containsProjectServeAccessToken(
                new TextDecoder().decode(entry.data),
              ) &&
                items.push(
                  `serve token not removed: design-system file "${redactProjectServeAccessToken(input)}" ships bytes matching a project serve access token \u2014 the published file may carry a live access token`,
                );
              return entry.uuid;
            }
            if (values4.has(input)) return entry.uuid;
            let entry2: Dynamic = entries.get("ds-css:" + input);
            if (entry2) return entry2.uuid;
            let value23: Dynamic = await callback5(
              new TextDecoder().decode(entry.data),
            );
            entries.set("ds-css:" + input, value23);
            return value23.uuid;
          }
          let value21: Dynamic = await resolveAsset(input);
          if (!value21) {
            items.push(
              `design-system file not embedded (${redactProjectServeAccessToken(input)}): not found in the project \u2014 the page loads it dynamically via ds-base.js, and the published file will not render its design system`,
            );
            return null;
          }
          if (options2 === "css") {
            let value23: Dynamic = await callback5(
              new TextDecoder().decode(value21.data),
            );
            entries.set(input, value23);
            values4.add(input);
            return value23.uuid;
          }
          let value22: Dynamic = new TextDecoder().decode(value21.data);
          /\/v1\/design\/projects\/[^/]+\/serve\//.test(value22) &&
            ((value22 = value22.replace(projectServeUrlPattern, "$1")),
            items.push(
              `design-system file "${redactProjectServeAccessToken(input)}" references project serve URLs \u2014 detected access tokens were removed, but the URLs (and project id) ship in the published file and will not load for public viewers`,
            ));
          containsProjectServeCredential(value22) &&
            items.push(
              `serve token not removed: design-system file "${redactProjectServeAccessToken(input)}" ships project serve URLs whose query tokens were not stripped \u2014 the published file may carry a live access token`,
            );
          let state3: Dynamic = {
            uuid: crypto.randomUUID(),
            data: new TextEncoder().encode(value22),
            mime: value21.mime,
          };
          entries.set(input, state3);
          return state3.uuid;
        },
        values6: Dynamic = new Set();
      for (let value21 of Array.from(
        value4.querySelectorAll("script[src]"),
      ) as Dynamic) {
        let value22: Dynamic = (value21.getAttribute("src") || "").trim(),
          value23: Dynamic = value22.split("#")[0].split("?")[0];
        if (
          (value23 !== designSystemBaseFilename &&
            !value23.endsWith("/" + designSystemBaseFilename)) ||
          /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value23)
        )
          continue;
        let value24: Dynamic = resolveExportAssetUrl(value22, path);
        if (values6.has(value24)) continue;
        values6.add(value24);
        if (
          matchesNormalizedPathPattern(
            value24,
            invalidExportAssetPathSegmentsPattern,
          ) ||
          isSuspiciousExportAssetPath(value24)
        ) {
          items.push(
            `design-system file not embedded (${redactProjectServeAccessToken(value24)}): the ds-base.js reference carries dot, empty, or unsupported path segments \u2014 reference the loader by a plain path (if the page's own folder name carries symbols or emoji, renaming that folder to plain characters also resolves this) to publish this page with its design system`,
          );
          continue;
        }
        let entry: Dynamic = entries.get(value24),
          value25: Dynamic = entry ?? (await resolveAsset(value24));
        if (!value25) continue;
        let value26: Dynamic = new TextDecoder().decode(value25.data);
        if (value26.includes("(window.__resources || {})[base + ")) continue;
        let value27: Dynamic = maskJavaScriptCommentsAndStrings(value26),
          value28: Dynamic = value19.test(value26),
          value29: Dynamic = value20.test(value26);
        if (!value27 && !value28 && !value29) continue;
        if (!value27) {
          items.push(
            `design-system file not embedded (${redactProjectServeAccessToken(value24)}): ds-base.js has no live 'const base = \u2026' statement to follow, so its dynamically loaded files ship un-embedded and will not load on strict hosts (e.g. published artifacts) \u2014 restoring the generated base line re-enables embedding`,
          );
          continue;
        }
        if (!value28 && !value29) {
          items.push(
            `design-system file not embedded (${redactProjectServeAccessToken(value24)}): ds-base.js was customized beyond the generated load lines, so its dynamically loaded files ship un-embedded and will not load on strict hosts (e.g. published artifacts) \u2014 restoring the generated lines re-enables embedding`,
          );
          continue;
        }
        let value30: Dynamic = value27.value,
          value31: Dynamic = resolveExportAssetUrl(value30, path);
        if (isSuspiciousExportAssetPath(value30)) {
          items.push(
            `design-system file not embedded (${redactProjectServeAccessToken(value24)}): ds-base.js's base line carries unsupported characters \u2014 point base at a plain _ds/<folder> path to publish this page with its design system`,
          );
          continue;
        }
        if (/\/v1\/design\/projects\/[^/]+\/serve(\/|$)/.test("/" + value30)) {
          items.push(
            `design-system file not embedded (${redactProjectServeAccessToken(value24)}): ds-base.js points base at a project serve path, which is not a design-system tree \u2014 point base at the project's _ds/<folder> tree to publish this page with its design system`,
          );
          continue;
        }
        if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value30)) {
          items.push(
            `design-system file not embedded (${redactProjectServeAccessToken(value24)}): ds-base.js points base at an absolute URL, which is loaded live and blocked on strict hosts (e.g. published artifacts) \u2014 point base at the project's _ds/<folder> tree to publish this page with its design system`,
          );
          continue;
        }
        {
          let value35: Dynamic = /^\/?(_ds\/[^/]+)(\/|$)/,
            value36: Dynamic = value24.normalize("NFKC"),
            value37: Dynamic = value31.normalize("NFKC"),
            callback4: Dynamic = (
              input?: Dynamic,
              options2?: Dynamic,
            ): Dynamic => {
              let value38: Dynamic = value35.exec(input);
              if (!value38) return true;
              let value39: Dynamic = options2.replace(/^\//, "");
              return (
                value39 === value38[1] || value39.startsWith(value38[1] + "/")
              );
            };
          if (
            !(
              !!value35.exec(value24) == !!value35.exec(value36) &&
              designSystemAssetPathPattern.test(value31) ===
                designSystemAssetPathPattern.test(value37) &&
              callback4(value24, value31) === callback4(value36, value37) &&
              (value31 === "") == (value37 === "")
            )
          ) {
            items.push(
              `design-system file not embedded (${redactProjectServeAccessToken(value24)}): the loader path or its base changes meaning under Unicode normalization, so it cannot be safely classified \u2014 reference the loader and point base at a plain _ds/<folder> path`,
            );
            continue;
          }
        }
        let value32: Dynamic = /^\/?(_ds\/[^/]+)(\/|$)/.exec(value24);
        if (value32) {
          let value35: Dynamic = value32[1],
            value36: Dynamic = value31.replace(/^\//, "");
          if (value36 !== value35 && !value36.startsWith(value35 + "/")) {
            items.push(
              `design-system file not embedded (${redactProjectServeAccessToken(value24)}): a loader inside ${value35}/ may only embed from its own tree, and its base resolves elsewhere \u2014 the page loads these files live, which strict hosts block`,
            );
            continue;
          }
        }
        if (value31 === "" && !state.dsProject) {
          items.push(
            `design-system file not embedded (${redactProjectServeAccessToken(value24)}): ds-base.js's base resolves to the project root, which a bound design system may not embed from \u2014 place design files under '_ds/<name>/' and point base at that tree`,
          );
          continue;
        }
        if (
          !state.dsProject &&
          value31 !== "" &&
          !designSystemAssetPathPattern.test(value31)
        ) {
          items.push(
            `design-system file not embedded (${redactProjectServeAccessToken(value24)}): ds-base.js's base does not point at a bound design-system tree \u2014 place design files under '_ds/<name>/' and point base at that tree`,
          );
          continue;
        }
        let value33: Dynamic = parseExportRuntimeAssetPaths(value26),
          value34: Dynamic = value26,
          flag: Dynamic = false;
        if (value29) {
          let value35: Dynamic = `${value30}/_ds_bundle.js`,
            value36: Dynamic = await callback3(
              resolveExportAssetUrl(value35, path),
              "js",
            );
          value36 &&
            (items2.push({
              id: value35,
              uuid: value36,
            }),
            (value34 = value34.replace(
              new RegExp(value20.source, "g"),
              "$1.src = (window.__resources || {})[base + $2/_ds_bundle.js$2] || base + $2/_ds_bundle.js$2;",
            )),
            (flag = true));
        } else
          items.push(
            `design-system file not embedded (${redactProjectServeAccessToken(value24)}): ds-base.js's _ds_bundle.js load line was customized beyond the generated shape, so the published page loads the design-system bundle live, which strict hosts block \u2014 restoring the generated line re-enables embedding`,
          );
        if (value28 && value33 && value33.length > 0) {
          let flag2: Dynamic = false;
          for (let value35 of value33 as Dynamic) {
            if (
              isSuspiciousExportAssetPath(value35) ||
              /[#?]/.test(value35) ||
              value35.startsWith("/") ||
              matchesNormalizedPathPattern(value35, /(^|\/)\.\.(\/|$)/)
            ) {
              items.push(
                `design-system stylesheet not embedded ("${redactProjectServeAccessToken(value35)}" in ds-base.js): the path is not a plain relative path inside the design-system tree \u2014 the reference ships live and will not load for public viewers`,
              );
              continue;
            }
            let value36: Dynamic = `${value30}/${value35}`,
              value37: Dynamic = await callback3(
                resolveExportAssetUrl(value36, path),
                "css",
                value31,
              );
            value37 &&
              (items2.push({
                id: value36,
                uuid: value37,
              }),
              (flag2 = true));
          }
          flag2 &&
            ((value34 = value34.replace(
              new RegExp(value19.source, "g"),
              `const __dsu = (window.__resources || {})[base + $4/$4 + p];
    const __dsb = __dsu && (window.__resourceBlobs || {})[__dsu];
    if (__dsb) {
      const __dst = document.createElement($2style$2);
      __dsb.text().then(function (t) { __dst.textContent = t; });
      document.head.appendChild(__dst);
    } else {
      const $1 = document.createElement($2link$2);
      $1.href = base + $4/$4 + p; $1.rel = $3stylesheet$3;
      document.head.appendChild($1);
    }`,
            )),
            (flag = true));
        } else
          value28 && value33 === null
            ? items.push(
                `design-system file not embedded (${redactProjectServeAccessToken(value24)}): ds-base.js's stylesheet list could not be read as a plain string array, so its stylesheets ship un-embedded and will not load on strict hosts \u2014 restoring the generated 'for (const p of [...])' loop head re-enables embedding`,
              )
            : value33 &&
              value33.length > 0 &&
              items.push(
                `design-system file not embedded (${redactProjectServeAccessToken(value24)}): ds-base.js's stylesheet loop was customized beyond the generated shape, so the published page loads its design-system stylesheets live, which strict hosts block \u2014 restoring the generated lines re-enables embedding`,
              );
        flag &&
          (entry
            ? (entry.data = new TextEncoder().encode(value34))
            : entries.set(value24, {
                uuid: crypto.randomUUID(),
                data: new TextEncoder().encode(value34),
                mime: value25.mime,
              }));
      }
    }
    await Promise.all(
      Array.from(value4.querySelectorAll("script[src]")).map(
        (input?: Dynamic): Dynamic => value6(input, "src"),
      ),
    );
    await Promise.all(
      Array.from(value4.querySelectorAll("x-dc x-import")).map(
        async (element2?: Dynamic): Promise<Dynamic> => {
          let text3: Dynamic = "from";
          if (!element2.getAttribute(text3)) return;
          let value19: Dynamic = element2.getAttribute(text3).trim();
          if (value19.includes("{{")) return;
          let value20: Dynamic = value19.split(/\s+/),
            items3: Dynamic = [],
            flag: Dynamic = false;
          for (let value21 of value20 as Dynamic) {
            if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value21)) {
              if (!/\/v1\/design\/projects\/[^/]+\/serve\//.test(value21)) {
                items3.push(value21);
                continue;
              }
              let value29: Dynamic = resolveExportAssetUrl(value21, path);
              if (!entries.has(value29)) {
                let value30: Dynamic = await resolveAsset(value29);
                if (!value30) {
                  let value31: Dynamic = value21.indexOf("#"),
                    value32: Dynamic =
                      value31 >= 0 ? value21.slice(value31) : "",
                    value33: Dynamic =
                      (value31 >= 0 ? value21.slice(0, value31) : value21)
                        .split("?")[0]
                        .replace(/\/_t\/[^/]+\//i, "/") +
                      (containsProjectServeAccessToken(value32) ? "" : value32);
                  items3.push(value33);
                  value33 !== value21 && (flag = true);
                  continue;
                }
                entries.has(value29) ||
                  entries.set(value29, {
                    uuid: crypto.randomUUID(),
                    data: value30.data,
                    mime: value30.mime,
                  });
              }
            }
            let value22: Dynamic = value21.indexOf("#"),
              value23: Dynamic = value22 >= 0 ? value21.slice(value22) : "",
              value24: Dynamic = containsProjectServeAccessToken(value23)
                ? ""
                : value23,
              value25: Dynamic =
                value21.split("#")[0].split("?")[0].split("/").pop() || "",
              value26: Dynamic = await value5(value21);
            if (!value26) {
              value24 !== value23
                ? (items3.push(value21.slice(0, value22)), (flag = true))
                : items3.push(value21);
              continue;
            }
            let value27: Dynamic = `${value26}#/${value25}${value24}`,
              value28: Dynamic = jsxAssetFilenamePattern.exec(value21);
            value28 &&
              !jsxAssetFilenamePattern.test(value27) &&
              (value27 += `#.${value28[1]}`);
            items3.push(value27);
            flag = true;
          }
          flag && element2.setAttribute(text3, items3.join(" "));
        },
      ),
    );
    {
      let entries3: Dynamic = new Map(),
        callback3: Dynamic = async (input?: Dynamic): Promise<Dynamic> => {
          if (state.ancestors.has(input)) {
            items.push(
              `embedded page not bundled (${input}): the page embeds itself, directly or through a chain of embedded pages \u2014 the frame will render empty`,
            );
            return null;
          }
          if (state.depth >= maxEmbeddedExportDepth) {
            items.push(
              `embedded page not bundled (${input}): embedded pages nest more than ${maxEmbeddedExportDepth} levels deep \u2014 the frame will render empty`,
            );
            return null;
          }
          let entry: Dynamic = state.pages.get(input);
          if (entry) return "about:blank#" + entry.uuid;
          let value19: Dynamic = await callback(input);
          if (!value19) return null;
          let value20: Dynamic = value19.mime
            .split(";")[0]
            .trim()
            .toLowerCase();
          if (value20 !== "text/html") {
            let entry2: Dynamic = entries.get(input),
              value24: Dynamic = entry2?.data ?? value19.data;
            !(
              alreadyCompressedExportMimeTypes.has(value20) &&
              hasCompressedFileSignature(value24)
            ) &&
              containsProjectServeAccessToken(
                new TextDecoder().decode(value24),
              ) &&
              items.push(
                `serve token not removed: embedded file "${input}" ships bytes matching a project serve access token \u2014 the published file may carry a live access token`,
              );
            if (entry2) return entry2.uuid;
            let state4: Dynamic = {
              uuid: crypto.randomUUID(),
              data: value19.data,
              mime: value19.mime,
            };
            entries.set(input, state4);
            return state4.uuid;
          }
          let value21: Dynamic = new TextDecoder().decode(value19.data);
          /\/v1\/design\/projects\/[^/]+\/serve\//.test(value21) &&
            ((value21 = value21.replace(projectServeUrlPattern, "$1")),
            items.push(
              `embedded page "${input}" references project serve URLs \u2014 detected access tokens were removed, but the URLs (and project id) ship in the published file and will not load for public viewers`,
            ));
          containsProjectServeCredential(value21) &&
            items.push(
              `serve token not removed: embedded page "${input}" ships project serve URLs whose query tokens were not stripped \u2014 the published file may carry a live access token`,
            );
          let value22: Dynamic = await bundleStandaloneDesignHtml(
            value21,
            input,
            resolveAsset,
            {
              ancestors: new Set([...state.ancestors, input]),
              depth: state.depth + 1,
              pages: state.pages,
              pageOrder: state.pageOrder,
              dsProject: state.dsProject,
            },
          );
          for (let value24 of value22.warnings as Dynamic)
            items.push(`${value24} \u2014 inside embedded page "${input}"`);
          let state3: Dynamic = {
              uuid: crypto.randomUUID(),
              data: new TextEncoder().encode(value22.html),
              hasSubPages: [...state.pages.values()].some(
                (input2?: Dynamic): Dynamic =>
                  value22.html.includes("about:blank#" + input2.uuid),
              ),
            },
            value23: Dynamic = value22.warnings.some(
              (input2?: Dynamic): Dynamic =>
                input2.startsWith("embedded page not bundled ("),
            );
          state.pages.set(value23 ? "instance:" + state3.uuid : input, state3);
          state.pageOrder.push(state3.uuid);
          return "about:blank#" + state3.uuid;
        };
      for (let value19 of Array.from(
        value4.querySelectorAll("iframe[src]"),
      ) as Dynamic) {
        let value20: Dynamic = (value19.getAttribute("src") || "").trim();
        if (!value20 || value20.includes("{{")) continue;
        let value21: Dynamic = value20.indexOf("#"),
          value22: Dynamic = value21 >= 0 ? value20.slice(value21) : "",
          value23: Dynamic = containsProjectServeAccessToken(value22)
            ? ""
            : value22,
          value24: Dynamic = value21 >= 0 ? value20.slice(0, value21) : value20;
        if (!value24) continue;
        let value25: Dynamic = value24;
        try {
          value25 = decodeURIComponent(value24);
        } catch {}
        let value26: Dynamic = /^([a-z][a-z0-9+.-]*):/i
          .exec(value25)?.[1]
          ?.toLowerCase();
        if (value26 && value26 !== "http" && value26 !== "https") continue;
        let value27: Dynamic = /\/v1\/design\/projects\/[^/]+\/serve\//.test(
          value25,
        );
        if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value25) && !value27) continue;
        let value28: Dynamic;
        if (value27) value28 = resolveExportAssetUrl(value25, path);
        else {
          value28 = resolveExportAssetUrl(value24, path);
          try {
            value28 = decodeURIComponent(value28);
          } catch {}
        }
        let value29: Dynamic = value27 ? value28.split("?")[0] : value28;
        if (!value27 && /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value29)) continue;
        let entry: Dynamic = entries3.get(value29);
        if (entry === undefined) {
          if (value27) {
            let value30: Dynamic = value29.replace(/\/_t\/[^/]+\//i, "/");
            containsProjectServeAccessToken(value30)
              ? (items.push(
                  "serve token not removed: an embedded frame references a project serve URL whose access token could not be stripped \u2014 the published file may carry a live access token",
                ),
                (entry = null))
              : (items.push(
                  `embedded page not bundled (${value30}): project serve URLs are not embedded as pages \u2014 the frame ships without its access token and will not load for public viewers`,
                ),
                (entry = value30));
          } else entry = await callback3(value29);
          entries3.set(value29, entry);
        }
        if (
          value19.hasAttribute("sandbox") &&
          !(value19.getAttribute("sandbox") || "")
            .toLowerCase()
            .split(/[ \t\n\f\r]+/)
            .includes("allow-same-origin") &&
          entry?.startsWith("about:blank#")
        ) {
          let value30: Dynamic = entry.slice(12);
          [...state.pages.values()].find(
            (input?: Dynamic): Dynamic => input.uuid === value30,
          )?.hasSubPages &&
            items.push(
              `embedded page inside a sandboxed frame (${redactProjectServeAccessToken(value29)}): pages embedded inside this sandboxed frame will not display in the published deck on the web \u2014 remove the sandbox attribute or avoid nesting page embeds inside it`,
            );
        }
        entry
          ? value19.setAttribute("src", entry + value23)
          : value23 !== value22 && value19.setAttribute("src", value24);
      }
    }
    let callback2: Dynamic = (input?: Dynamic): Dynamic =>
        Array.from(input.querySelectorAll("x-dc dc-import")).flatMap(
          (element2?: Dynamic): Dynamic => {
            let value19: Dynamic =
              element2.getAttribute("name") ||
              element2.getAttribute("component") ||
              "";
            return value19 ? [value19] : [];
          },
        ),
      values2: Dynamic = new Set(),
      values3: Dynamic = new Set(),
      value10: Dynamic = callback2(value4);
    for (; value10.length > 0; ) {
      let value19: Dynamic = value10.shift();
      if (values2.has(value19)) continue;
      values2.add(value19);
      if (/[/\\#?]/.test(value19)) {
        items.push(
          `sibling component not embedded (<${value19}/>): the name is not a plain sibling filename \u2014 the reference renders as an empty placeholder`,
        );
        continue;
      }
      let value20: Dynamic = "./" + encodeURIComponent(value19) + ".dc.html",
        value21: Dynamic = resolveExportAssetUrl(
          "./" + value19 + ".dc.html",
          path,
        ),
        entry: Dynamic = entries.get(value21);
      entry &&
        containsProjectServeAccessToken(new TextDecoder().decode(entry.data)) &&
        items.push(
          `serve token not removed: sibling component <${value19}/> ships project serve URLs whose query tokens were not stripped \u2014 the published file may carry a live access token`,
        );
      if (!entry) {
        let value23: Dynamic = await resolveAsset(value21);
        if (!value23) {
          items.push(
            `sibling component not embedded (<${value19}/>): ${value20} is not in the project \u2014 the reference renders as an empty placeholder`,
          );
          continue;
        }
        let value24: Dynamic = new TextDecoder().decode(value23.data);
        /\/v1\/design\/projects\/[^/]+\/serve\//.test(value24) &&
          ((value24 = value24.replace(projectServeUrlPattern, "$1")),
          items.push(
            `sibling component <${value19}/> references project serve URLs \u2014 detected access tokens were removed, but the URLs (and project id) ship in the published file and will not load for public viewers`,
          ));
        containsProjectServeCredential(value24) &&
          items.push(
            `serve token not removed: sibling component <${value19}/> ships project serve URLs whose query tokens were not stripped \u2014 the published file may carry a live access token`,
          );
        entry = {
          uuid: crypto.randomUUID(),
          data: new TextEncoder().encode(value24),
          mime: value23.mime,
        };
        entries.set(value21, entry);
      }
      items2.push({
        id: value20,
        uuid: entry.uuid,
      });
      let value22: Dynamic = new DOMParser().parseFromString(
        new TextDecoder().decode(entry.data),
        "text/html",
      );
      value10.push(...callback2(value22));
      for (let value23 of Array.from(
        value22.querySelectorAll("x-dc x-import"),
      ) as Dynamic) {
        let value24: Dynamic =
            value23.getAttribute("from") ||
            (value23.getAttribute("component-from-global-scope")
              ? ""
              : value23.getAttribute("src") ||
                value23.getAttribute("import") ||
                ""),
          value25: Dynamic = value24.trim();
        if (!(!value25 || value24.includes("{{")))
          for (let value26 of value25.split(/\s+/) as Dynamic)
            (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value26) &&
              !/\/v1\/design\/projects\/[^/]+\/serve\//.test(value26)) ||
              items.push(
                `x-import inside sibling component <${value19}/> (${value26}) is not embedded \u2014 it will fail to load in the published page`,
              );
      }
      for (let value23 of Array.from(
        value22.querySelectorAll(
          'x-dc helmet link[rel~="stylesheet" i], x-dc sc-helmet link[rel~="stylesheet" i]',
        ),
      ) as Dynamic) {
        let value24: Dynamic = (value23.getAttribute("href") || "").trim();
        if (
          !value24 ||
          value24.includes("{{") ||
          values3.has(value24) ||
          (value23.getAttribute("rel") || "")
            .toLowerCase()
            .split(/\s+/)
            .includes("alternate") ||
          !/^(?:https?:|\/\/)/i.test(value24)
        )
          continue;
        let value25: Dynamic = resolveExportAssetUrl(value24, path),
          value26: Dynamic = await callback(value25);
        if (!value26) continue;
        let value27: Dynamic = new TextDecoder().decode(value26.data);
        value27 = await (0, runtime.inlineExportCssAssetUrls)(
          value27,
          value25,
          callback,
          entries,
          items,
        );
        values3.add(value24);
        let state3: Dynamic = {
          uuid: crypto.randomUUID(),
          data: new TextEncoder().encode(value27),
          mime: "text/css",
        };
        entries.set("helmet-css:" + value24, state3);
        items2.push({
          id: value24,
          uuid: state3.uuid,
        });
      }
    }
    if ((0, runtime.isDcHtmlDocument)(html)) {
      let items3: Dynamic = [
        {
          url: exportReactUmdUrl,
          sri: exportReactUmdIntegrity,
        },
        {
          url: exportReactDomUmdUrl,
          sri: exportReactDomUmdIntegrity,
        },
      ];
      Array.from(value4.querySelectorAll("x-dc x-import")).some(
        (element2?: Dynamic): Dynamic => {
          let value19: Dynamic = element2.getAttribute("from") || "";
          return value19.includes("{{")
            ? false
            : value19
                .trim()
                .split(/\s+/)
                .some(
                  (input?: Dynamic): Dynamic =>
                    jsxAssetFilenamePattern.test(input),
                );
        },
      ) &&
        items3.push({
          url: exportBabelStandaloneUrl,
          sri: exportBabelStandaloneIntegrity,
        });
      await Promise.all(
        items3.map(
          async ({ url: url, sri: sri }: Dynamic): Promise<Dynamic> => {
            let value19: Dynamic = resolveExportAssetUrl(url, path),
              entry: Dynamic = entries.get(value19),
              value20: Dynamic = entry ?? (await resolveAsset(value19));
            if (
              !value20 ||
              !(await (0, runtime.verifyExportAssetIntegrity)(
                value20.data,
                sri,
              ))
            ) {
              items.push(
                `runtime dependency not embedded (${url}): ${value20 ? "integrity check failed" : "fetch failed"} \u2014 the page will load it from the CDN when opened, which strict hosts (e.g. published artifacts) block`,
              );
              return;
            }
            let value21: Dynamic = entry ?? {
              uuid: crypto.randomUUID(),
              data: value20.data,
              mime: value20.mime,
            };
            entry || entries.set(value19, value21);
            items2.push({
              id: url,
              uuid: value21.uuid,
            });
          },
        ),
      );
    }
    let value11: Dynamic = Array.from(value4.querySelectorAll("style"));
    for (let value19 of Array.from(
      value4.querySelectorAll('link[rel~="stylesheet" i]'),
    ) as Dynamic) {
      let attribute: Dynamic = value19.getAttribute("href");
      if (
        !attribute ||
        (value19.getAttribute("rel") || "")
          .toLowerCase()
          .split(/\s+/)
          .includes("alternate")
      )
        continue;
      let value20: Dynamic = attribute
        .slice(0, attribute.indexOf(":") + 1)
        .toLowerCase();
      if (value20 === "data:" || value20 === "blob:") continue;
      let value21: Dynamic = resolveExportAssetUrl(attribute, path),
        value22: Dynamic = await callback(value21);
      if (value22) {
        let value23: Dynamic = new TextDecoder().decode(value22.data);
        value23 = await (0, runtime.inlineExportCssImports)(
          value23,
          value21,
          callback,
          entries,
          0,
          "uuid",
          items,
        );
        let value24: Dynamic = value4.createElement("style");
        value19.hasAttribute("disabled")
          ? value24.setAttribute("media", "not all")
          : value19.hasAttribute("media") &&
            value24.setAttribute("media", value19.getAttribute("media"));
        value19.hasAttribute("title") &&
          value24.setAttribute("title", value19.getAttribute("title"));
        value24.textContent = (0, runtime.escapeExportStyleClosingTag)(value23);
        value19.replaceWith(value24);
      }
    }
    for (let value19 of Array.from(
      value4.querySelectorAll(
        'link[rel~="preload" i], link[rel~="prefetch" i], link[rel~="modulepreload" i]',
      ),
    ) as Dynamic)
      value19.remove();
    for (let value19 of value11 as Dynamic) {
      let value20: Dynamic = await (0, runtime.inlineExportCssImports)(
        value19.textContent || "",
        path,
        callback,
        entries,
        0,
        "uuid",
        items,
      );
      value19.textContent = (0, runtime.escapeExportStyleClosingTag)(value20);
    }
    for (let value19 of Array.from(
      value4.querySelectorAll("[style]"),
    ) as Dynamic) {
      let value20: Dynamic = value19.getAttribute("style") || "";
      value19.setAttribute(
        "style",
        await (0, runtime.replaceCssAssetUrlsWithIds)(
          value20,
          path,
          callback,
          entries,
        ),
      );
    }
    let element: Dynamic = value4.querySelector("template#__bundler_thumbnail"),
      text: Dynamic = "",
      text2: Dynamic = "#faf9f5";
    element &&
      ((text = element.innerHTML),
      (text2 = sanitizeExportColor(
        element.getAttribute("data-bg-color"),
        text2,
      )),
      element.remove(),
      /\/v1\/design\/projects\/[^/]+\/serve\//.test(text) &&
        ((text = text.replace(projectServeUrlPattern, "$1")),
        items.push(
          "thumbnail splash references project serve URLs \u2014 detected access tokens were removed, but the URLs (and project id) ship in the published file and will not load for public viewers",
        )),
      containsProjectServeCredential(text) &&
        items.push(
          "serve token not removed: the thumbnail splash ships project serve URLs whose query tokens were not stripped \u2014 the published file may carry a live access token",
        ));
    options.branding;
    let value12: Dynamic = value4;
    if (state.depth === 0 && options.finalizeTemplate) {
      let value19: Dynamic = value4.cloneNode(true),
        value20: Dynamic = [...entries.values()]
          .filter(
            (input?: Dynamic): Dynamic =>
              /^text\/|javascript|json|xml/i.test(input.mime),
          )
          .map(
            (input?: Dynamic): Dynamic => ({
              mime: input.mime,
              text: new TextDecoder().decode(input.data),
            }),
          );
      try {
        options.finalizeTemplate(value19, value20);
        value12 = value19;
      } catch (value21: Dynamic) {
        items.push(
          "importer-ready pass failed; exported without it: " +
            (value21 instanceof Error ? value21.message : String(value21)),
        );
      }
    }
    let value13: Dynamic =
        value12.querySelector("title")?.textContent || "Bundled Page",
      value14: Dynamic =
        `<!DOCTYPE html>
` + value12.documentElement.outerHTML;
    containsProjectServeAccessToken(value14) &&
      items.push(
        "serve token not removed: the bundled page ships bytes matching a project serve access token \u2014 the published file may carry a live access token",
      );
    if (state.depth === 0)
      for (let [value19, value20] of state.pages as Dynamic)
        entries.set("bundled-page:" + value19, {
          uuid: value20.uuid,
          data: value20.data,
          mime: "text/html",
        });
    let state2: Dynamic = {},
      value15: Dynamic = items.some(
        (input?: Dynamic): Dynamic =>
          input.startsWith("serve token not removed:"),
      );
    for (let [value19, value20] of entries as Dynamic) {
      !value15 &&
        !(
          alreadyCompressedExportMimeTypes.has(
            value20.mime.split(";")[0].trim().toLowerCase(),
          ) && hasCompressedFileSignature(value20.data)
        ) &&
        !value19.startsWith("bundled-page:") &&
        containsProjectServeAccessToken(
          new TextDecoder().decode(value20.data),
        ) &&
        ((value15 = true),
        items.push(
          state.depth > 0
            ? "serve token not removed: an asset referenced by this embedded page ships bytes matching a project serve access token \u2014 the published file may carry a live access token"
            : "serve token not removed: an asset referenced by this page ships bytes matching a project serve access token \u2014 the published file may carry a live access token",
        ));
      let value21: Dynamic = value20.mime.split(";")[0].trim().toLowerCase(),
        value22: Dynamic = mimeTypePattern.test(value21)
          ? value21
          : "application/octet-stream",
        value23: Dynamic = !alreadyCompressedExportMimeTypes.has(value22),
        value24: Dynamic = value23
          ? await (0, runtime.gzipExportAsset)(value20.data)
          : value20.data;
      state2[value20.uuid] = {
        mime: value22,
        compressed: value23,
        data: encodeBinaryBase64(value24),
      };
    }
    let value16: Dynamic = (0, runtime.escapeExportScriptClosingTags)(
      JSON.stringify(value14),
    );
    containsProjectServeAccessToken(
      items2.map((input?: Dynamic): Dynamic => input.id).join(`
`),
    ) &&
      items.push(
        "serve token not removed: an ext-resource id ships bytes matching a project serve access token \u2014 the published file may carry a live access token",
      );
    let value17: Dynamic = (0, runtime.escapeExportScriptClosingTags)(
        JSON.stringify(items2),
      ),
      value18: Dynamic = Object.values(state2).reduce(
        (input?: Dynamic, options2?: Dynamic): Dynamic =>
          input + options2.data.length,
        0,
      );
    value18 > 200 * 1024 * 1024 &&
      items.push(
        `total output is ${formatExportByteSize(value18)} \u2014 may cause browser perf issues`,
      );
    value18 > 20 * 1024 * 1024 &&
      items.push(
        `total output is ${formatExportByteSize(value18)} \u2014 publishing at this size may fail at the upload limit; pages embedded via iframe re-ship their shared dependencies, so consolidating or removing embedded pages reduces size most`,
      );
    return {
      html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${(0, runtime.escapeHtml)(value13)}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: ${text2}; display: flex; align-items: center; justify-content: center; min-height: 100vh; font-family: -apple-system, BlinkMacSystemFont, sans-serif; }
    #__bundler_loading { position: fixed; bottom: 20px; right: 20px; font: 13px/1.4 -apple-system, BlinkMacSystemFont, sans-serif; color: #666; background: #fff; padding: 8px 14px; border-radius: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.12); z-index: 10000; }
    #__bundler_thumbnail { position: fixed; inset: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: ${text2}; z-index: 9999; }
    #__bundler_thumbnail svg { width: 100%; height: 100%; object-fit: contain; }
    #__bundler_placeholder { color: #999; font-size: 14px; }
  </style>
  <noscript>
    <style>#__bundler_loading { display: none; }</style>
    <div style="position:fixed;bottom:12px;left:12px;font:13px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;color:#999;background:rgba(255,255,255,0.9);padding:6px 12px;border-radius:6px;box-shadow:0 1px 4px rgba(0,0,0,0.08);z-index:10000;">
      This page requires JavaScript to display.
    </div>
  </noscript>
</head>
<body>
  ${text ? '<div id="__bundler_thumbnail">' + text + "</div>" : '<div id="__bundler_placeholder">Loading ' + (0, runtime.escapeHtml)(value13) + "...</div>"}
  <div id="__bundler_loading">Unpacking...</div>

  <script>
    ${runtime.standaloneExportBootstrapScript}
  <\/script>

  <script type="__bundler/manifest">
${(0, runtime.escapeExportScriptClosingTags)(JSON.stringify(state2))}
  <\/script>

  <script type="__bundler/ext_resources">
${value17}
  <\/script>

  <script type="__bundler/page_order">
${(0, runtime.escapeExportScriptClosingTags)(JSON.stringify(state.depth === 0 ? state.pageOrder : []))}
  <\/script>

  <script type="__bundler/template">
${value16}
  <\/script>
</body>
</html>`,
      warnings: items,
    };
  }
  function resolveExportAssetUrl(
    reference?: Dynamic,
    basePath?: Dynamic,
  ): Dynamic {
    let value: Dynamic = reference.split("#")[0];
    if (/^(https?:)?\/\//.test(value)) return value;
    if (/^https?:\/\//.test(basePath)) return new URL(value, basePath).href;
    if (basePath.startsWith("//"))
      return new URL(value, "https:" + basePath).href;
    let value2: Dynamic = value.split("?")[0];
    if (value2.startsWith("/")) return value2;
    let value3: Dynamic = basePath.split("?")[0],
      value4: Dynamic = value3.startsWith("/"),
      value5: Dynamic = value3.split("/");
    value5.pop();
    let items: Dynamic = [];
    for (let value6 of [...value5, ...value2.split("/")] as Dynamic)
      value6 === "." ||
        value6 === "" ||
        (value6 === ".." ? items.pop() : items.push(value6));
    return (value4 ? "/" : "") + items.join("/");
  }
  bindRuntimeValue(
    runtime,
    "safeExportColorPattern",
    () => safeExportColorPattern,
    (value) => {
      safeExportColorPattern = value;
    },
  );
  bindRuntimeValue(runtime, "sanitizeExportColor", () => sanitizeExportColor);
  bindRuntimeValue(
    runtime,
    "designSystemBaseFilename",
    () => designSystemBaseFilename,
    (value) => {
      designSystemBaseFilename = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maskJavaScriptCommentsAndStrings",
    () => maskJavaScriptCommentsAndStrings,
  );
  bindRuntimeValue(runtime, "encodeBinaryBase64", () => encodeBinaryBase64);
  bindRuntimeValue(runtime, "decodeBinaryBase64", () => decodeBinaryBase64);
  bindRuntimeValue(runtime, "formatExportByteSize", () => formatExportByteSize);
  bindRuntimeValue(
    runtime,
    "exportReactUmdUrl",
    () => exportReactUmdUrl,
    (value) => {
      exportReactUmdUrl = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exportReactUmdIntegrity",
    () => exportReactUmdIntegrity,
    (value) => {
      exportReactUmdIntegrity = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exportReactDomUmdUrl",
    () => exportReactDomUmdUrl,
    (value) => {
      exportReactDomUmdUrl = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exportReactDomUmdIntegrity",
    () => exportReactDomUmdIntegrity,
    (value) => {
      exportReactDomUmdIntegrity = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exportBabelStandaloneUrl",
    () => exportBabelStandaloneUrl,
    (value) => {
      exportBabelStandaloneUrl = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exportBabelStandaloneIntegrity",
    () => exportBabelStandaloneIntegrity,
    (value) => {
      exportBabelStandaloneIntegrity = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "alreadyCompressedExportMimeTypes",
    () => alreadyCompressedExportMimeTypes,
    (value) => {
      alreadyCompressedExportMimeTypes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hasCompressedFileSignature",
    () => hasCompressedFileSignature,
  );
  bindRuntimeValue(
    runtime,
    "maxCssImportDepth",
    () => maxCssImportDepth,
    (value) => {
      maxCssImportDepth = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxEmbeddedExportDepth",
    () => maxEmbeddedExportDepth,
    (value) => {
      maxEmbeddedExportDepth = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "jsxAssetFilenamePattern",
    () => jsxAssetFilenamePattern,
    (value) => {
      jsxAssetFilenamePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "mimeTypePattern",
    () => mimeTypePattern,
    (value) => {
      mimeTypePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exportAssetUuidPattern",
    () => exportAssetUuidPattern,
    (value) => {
      exportAssetUuidPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "imageSlotsStateFilename",
    () => imageSlotsStateFilename,
    (value) => {
      imageSlotsStateFilename = value;
    },
  );
  bindRuntimeValue(runtime, "parseImageSlotState", () => parseImageSlotState);
  bindRuntimeValue(runtime, "parseExportSrcset", () => parseExportSrcset);
  bindRuntimeValue(
    runtime,
    "normalizeExportHtmlOutsideScripts",
    () => normalizeExportHtmlOutsideScripts,
  );
  bindRuntimeValue(
    runtime,
    "normalizeExportDesignTags",
    () => normalizeExportDesignTags,
  );
  bindRuntimeValue(
    runtime,
    "projectServeUrlPattern",
    () => projectServeUrlPattern,
    (value) => {
      projectServeUrlPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "projectServeAccessTokenPattern",
    () => projectServeAccessTokenPattern,
    (value) => {
      projectServeAccessTokenPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "decodeExportPathEscapes",
    () => decodeExportPathEscapes,
  );
  bindRuntimeValue(
    runtime,
    "containsProjectServeAccessToken",
    () => containsProjectServeAccessToken,
  );
  bindRuntimeValue(
    runtime,
    "containsProjectServeCredential",
    () => containsProjectServeCredential,
  );
  bindRuntimeValue(
    runtime,
    "isSuspiciousExportAssetPath",
    () => isSuspiciousExportAssetPath,
  );
  bindRuntimeValue(
    runtime,
    "designSystemAssetPathPattern",
    () => designSystemAssetPathPattern,
    (value) => {
      designSystemAssetPathPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "matchesNormalizedPathPattern",
    () => matchesNormalizedPathPattern,
  );
  bindRuntimeValue(
    runtime,
    "invalidExportAssetPathSegmentsPattern",
    () => invalidExportAssetPathSegmentsPattern,
    (value) => {
      invalidExportAssetPathSegmentsPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "redactProjectServeAccessToken",
    () => redactProjectServeAccessToken,
  );
  bindRuntimeValue(
    runtime,
    "parseExportRuntimeAssetPaths",
    () => parseExportRuntimeAssetPaths,
  );
  bindRuntimeValue(
    runtime,
    "bundleStandaloneDesignHtml",
    () => bundleStandaloneDesignHtml,
  );
  bindRuntimeValue(
    runtime,
    "resolveExportAssetUrl",
    () => resolveExportAssetUrl,
  );
  return () => {
    safeExportColorPattern =
      /^(#[0-9a-fA-F]{3,8}|rgba?\([\d.,%\s/]+\)|hsla?\([\d.,%\s/]+\)|[a-zA-Z]+)$/;
    designSystemBaseFilename = "ds-base.js";
    exportReactUmdUrl =
      "https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js";
    exportReactUmdIntegrity =
      "sha384-DGyLxAyjq0f9SPpVevD6IgztCFlnMF6oW/XQGmfe+IsZ8TqEiDrcHkMLKI6fiB/Z";
    exportReactDomUmdUrl =
      "https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js";
    exportReactDomUmdIntegrity =
      "sha384-gTGxhz21lVGYNMcdJOyq01Edg0jhn/c22nsx0kyqP0TxaV5WVdsSH1fSDUf5YJj1";
    exportBabelStandaloneUrl =
      "https://cdn.jsdelivr.net/npm/@babel/standalone@7.29.0/babel.min.js";
    exportBabelStandaloneIntegrity =
      "sha384-m08KidiNqLdpJqLq95G/LEi8Qvjl/xUYll3QILypMoQ65QorJ9Lvtp2RXYGBFj1y";
    alreadyCompressedExportMimeTypes = new Set([
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/avif",
      "image/gif",
      "video/mp4",
      "video/webm",
      "audio/mpeg",
      "audio/mp3",
      "audio/aac",
      "audio/ogg",
      "font/woff",
      "font/woff2",
      "application/zip",
      "application/gzip",
    ]);
    maxCssImportDepth = 10;
    maxEmbeddedExportDepth = 3;
    jsxAssetFilenamePattern = /\.(jsx|tsx)(\?|#|$)/i;
    mimeTypePattern = /^[\w.+-]+\/[\w.+-]+$/;
    exportAssetUuidPattern =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    imageSlotsStateFilename = ".image-slots.state.json";
    projectServeUrlPattern =
      /(\/v1\/design\/projects\/[^/"'\s)>`]+\/serve\/[^"'\s)>`?#]*)(?:\?[^"'\s<)>`]*)?/g;
    projectServeAccessTokenPattern =
      /[0-9a-f]{64}\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.\d{10}/i;
    designSystemAssetPathPattern = /^\/?_ds\/(?!\.\.?(\/|$))[^/]+(\/|$)/;
    invalidExportAssetPathSegmentsPattern = /(^|\/)\.\.?(\/|$)|\/\//;
  };
}
