import type { DataRecord } from "../contracts/storage";
import type {
  UnicodeRange,
  FontDescriptor,
  ExportFontFace,
  FontUsageIndex,
  FontPruning,
  ExportAssetResolver,
  FontAwareResolver,
} from "../contracts/fonts";
import type { PreviewHandle } from "../contracts/geometry";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installExportFontUsage(runtime: RuntimeBindings): () => void {
  var fontLoadStates: Set<string>;
  var maxExportFontFaces: number;
  var maxExportFontDescriptorLength: number;
  var maxExportFontDescriptorBytes: number;
  var exportFontProbeTimeoutMs: number;
  var fontLoadProbeScript: (timeoutMs: number) => string;
  var fontLoadProbeScriptDefault: string;
  var isValidExportFontDescriptor: (state: unknown) => state is FontDescriptor;
  var fullUnicodeRange: UnicodeRange;
  var normalizeFontFamily: (family: string) => string;
  var fontUnicodeRangesKey: (ranges: readonly UnicodeRange[]) => string;
  var fontFaceKey: (family: string, style: string, weight: string) => string;
  var spaceCodepoint: number;
  var fontRangesContainSpace: (ranges: readonly UnicodeRange[]) => boolean;
  var cssFontFaceRulePattern: RegExp;
  var cssFontFacePropertyPattern: (property: string) => RegExp;
  var fontFamilyDeclarationPattern: RegExp;
  var fontStyleDeclarationPattern: RegExp;
  var fontWeightDeclarationPattern: RegExp;
  var fontUnicodeRangeDeclarationPattern: RegExp;
  var fontFaceAssetUrlPattern: RegExp;
  var googleFontsCssUrlPattern: RegExp;
  async function collectArtboardFontDescriptors(
    webview: PreviewHandle,
  ): Promise<FontDescriptor[] | null> {
    try {
      let value = await webview.executeJavaScript(
        fontLoadProbeScriptDefault,
        exportFontProbeTimeoutMs + 5e3,
      );
      return !Array.isArray(value) ||
        value.length > maxExportFontFaces ||
        !value.every(isValidExportFontDescriptor) ||
        value.reduce(
          (input, options) =>
            input +
            options.family.length +
            options.style.length +
            options.weight.length +
            options.unicodeRange.length,
          0,
        ) > maxExportFontDescriptorBytes ||
        (value.length > 0 &&
          value.every((state) => state.status === "unloaded"))
        ? null
        : value.map((state) => ({
            family: state.family,
            style: state.style,
            weight: state.weight,
            unicodeRange: state.unicodeRange,
            status: state.status,
          }));
    } catch {
      return null;
    }
  }
  function parseFontUnicodeRanges(
    unicodeRange?: string,
  ): UnicodeRange[] | null {
    if (unicodeRange === undefined || unicodeRange.trim() === "")
      return [fullUnicodeRange];
    let items: UnicodeRange[] = [];
    for (let value of unicodeRange.split(",")) {
      let value2 = /^u\+([0-9a-f?]{1,6})(?:-([0-9a-f]{1,6}))?$/i.exec(
        value.trim(),
      );
      if (value2 === null) return null;
      let [, value3, value4] = value2;
      value4 !== undefined
        ? items.push([parseInt(value3!, 16), parseInt(value4, 16)])
        : value3!.includes("?")
          ? items.push([
              parseInt(value3!.replaceAll("?", "0"), 16),
              parseInt(value3!.replaceAll("?", "f"), 16),
            ])
          : items.push([parseInt(value3!, 16), parseInt(value3!, 16)]);
    }
    if (
      items.some(
        ([input, input2]) =>
          Number.isNaN(input) || Number.isNaN(input2) || input > input2,
      )
    )
      return null;
    items.sort((input, options) => input[0] - options[0]);
    let items2: UnicodeRange[] = [];
    for (let value of items) {
      let value2 = items2[items2.length - 1];
      value2 !== undefined && value[0] <= value2[1] + 1
        ? (value2[1] = Math.max(value2[1], value[1]))
        : items2.push([value[0], value[1]]);
    }
    return items2;
  }
  function normalizeFontWeightRange(weight: string): string {
    let value = weight
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .filter((input) => input !== ""),
      callback: (weight: string) => number = (input) =>
        input === "normal" ? 400 : input === "bold" ? 700 : Number(input),
      value2 = value.length === 0 ? 400 : callback(value[0]!),
      value3 = value.length > 1 ? callback(value[1]!) : value2;
    return Number.isFinite(value2) && Number.isFinite(value3)
      ? String(Math.min(value2, value3)) +
          " " +
          String(Math.max(value2, value3))
      : value.join(" ");
  }
  function parseExportFontFaceRules(css: string): ExportFontFace[] {
    let items: ExportFontFace[] = [];
    for (let value of css.match(cssFontFaceRulePattern) ?? []) {
      if (value.indexOf("{") !== value.lastIndexOf("{")) continue;
      let value2 = parseFontUnicodeRanges(
          fontUnicodeRangeDeclarationPattern.exec(value)?.[1],
        ),
        value3 = [...value.matchAll(fontFaceAssetUrlPattern)]
          .map((input) =>
            (input[1] ?? input[2] ?? input[3] ?? "").split("#")[0]!.trim(),
          )
          .filter((input) => /^https:\/\//i.test(input));
      if (value3.length === 0) continue;
      let value4 = fontFamilyDeclarationPattern.exec(value)?.[1] ?? "";
      items.push({
        family: normalizeFontFamily(value4),
        face: fontFaceKey(
          value4,
          fontStyleDeclarationPattern.exec(value)?.[1] ?? "normal",
          fontWeightDeclarationPattern.exec(value)?.[1] ?? "400",
        ),
        ranges: value2 === null ? null : fontUnicodeRangesKey(value2),
        coversSpace: value2 === null || fontRangesContainSpace(value2),
        files: value3,
      });
    }
    return items;
  }
  function indexExportFontUsage(
    fontFaces: readonly FontDescriptor[],
  ): FontUsageIndex {
    let entries: Map<string, string[]> = new Map(),
      entries2: Map<string, Set<string>> = new Map();
    for (let value of fontFaces) {
      let value2 = parseFontUnicodeRanges(value.unicodeRange),
        value3 = value.status.toLowerCase(),
        value4 =
          fontFaceKey(value.family, value.style, value.weight) +
          `
` +
          (value2 === null ? "unreadable" : fontUnicodeRangesKey(value2));
      if (value2 !== null) {
        let entry = entries.get(value4);
        entry === undefined
          ? entries.set(value4, [value3])
          : entry.push(value3);
      }
      if (value3 !== "unloaded") {
        let entry = entries2.get(normalizeFontFamily(value.family));
        entry === undefined
          ? entries2.set(normalizeFontFamily(value.family), new Set([value4]))
          : entry.add(value4);
      }
    }
    return {
      byRule: entries,
      drawnByFamily: entries2,
    };
  }
  function pruneUnusedExportFontFaces(
    css: string,
    fontUsage: FontUsageIndex,
  ): FontPruning {
    let value = parseExportFontFaceRules(css),
      values = new Set(
        value.map((input) =>
          input.ranges === null
            ? null
            : input.face +
              `
` +
              input.ranges,
        ),
      ),
      values2 = new Set(
        [...fontUsage.drawnByFamily]
          .filter(([, input]) =>
            [...input].some((input2) => !values.has(input2)),
          )
          .map(([input]) => input),
      ),
      value2 = value.map((input) => {
        if (input.ranges === null || values2.has(input.family)) return true;
        let entry = fontUsage.byRule.get(
          input.face +
            `
` +
            input.ranges,
        );
        return (
          entry === undefined || entry.some((input2) => input2 !== "unloaded")
        );
      }),
      values3 = new Set(
        value
          .filter((input, options) => value2[options])
          .map((input) => input.face),
      ),
      values4: Set<string> = new Set(),
      values5: Set<string> = new Set();
    value.forEach((input, options) => {
      let value3 =
        value2[options] || (input.coversSpace && values3.has(input.face));
      for (let value4 of input.files) (value3 ? values4 : values5).add(value4);
    });
    for (let value3 of values4) values5.delete(value3);
    return {
      keep: values4,
      leave: values5,
    };
  }
  function createFontAwareExportResolver(
    resolveAsset: ExportAssetResolver,
    fontDescriptors: readonly FontDescriptor[],
  ): FontAwareResolver {
    let value = indexExportFontUsage(fontDescriptors),
      values: Set<string> = new Set(),
      values2: Set<string> = new Set(),
      values3: Set<string> = new Set();
    return {
      resolve: async (input, options) => {
        if (values2.has(input)) {
          values3.add(input);
          return null;
        }
        let value2 = await resolveAsset(input, options);
        if (
          value2 !== null &&
          fontDescriptors.length > 0 &&
          /^text\/css\b/i.test(value2.mime)
        ) {
          let value3 = new TextDecoder().decode(value2.data),
            { keep: value4, leave: value5 } = googleFontsCssUrlPattern.test(
              input,
            )
              ? pruneUnusedExportFontFaces(value3, value)
              : {
                  keep: parseExportFontFaceRules(value3).flatMap(
                    (input2) => input2.files,
                  ),
                  leave: [],
                };
          for (let value6 of value4) {
            values.add(value6);
            values2.delete(value6);
          }
          for (let value6 of value5) values.has(value6) || values2.add(value6);
        }
        return value2;
      },
      leftOut: () => [...values3],
    };
  }
  bindRuntimeValue(
    runtime,
    "fontLoadStates",
    () => fontLoadStates,
    (value) => {
      fontLoadStates = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxExportFontFaces",
    () => maxExportFontFaces,
    (value) => {
      maxExportFontFaces = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxExportFontDescriptorLength",
    () => maxExportFontDescriptorLength,
    (value) => {
      maxExportFontDescriptorLength = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "maxExportFontDescriptorBytes",
    () => maxExportFontDescriptorBytes,
    (value) => {
      maxExportFontDescriptorBytes = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "exportFontProbeTimeoutMs",
    () => exportFontProbeTimeoutMs,
    (value) => {
      exportFontProbeTimeoutMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontLoadProbeScript",
    () => fontLoadProbeScript,
    (value) => {
      fontLoadProbeScript = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontLoadProbeScriptDefault",
    () => fontLoadProbeScriptDefault,
    (value) => {
      fontLoadProbeScriptDefault = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isValidExportFontDescriptor",
    () => isValidExportFontDescriptor,
    (value) => {
      isValidExportFontDescriptor = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "collectArtboardFontDescriptors",
    () => collectArtboardFontDescriptors,
  );
  bindRuntimeValue(
    runtime,
    "fullUnicodeRange",
    () => fullUnicodeRange,
    (value) => {
      fullUnicodeRange = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parseFontUnicodeRanges",
    () => parseFontUnicodeRanges,
  );
  bindRuntimeValue(
    runtime,
    "normalizeFontWeightRange",
    () => normalizeFontWeightRange,
  );
  bindRuntimeValue(
    runtime,
    "normalizeFontFamily",
    () => normalizeFontFamily,
    (value) => {
      normalizeFontFamily = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontUnicodeRangesKey",
    () => fontUnicodeRangesKey,
    (value) => {
      fontUnicodeRangesKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontFaceKey",
    () => fontFaceKey,
    (value) => {
      fontFaceKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "spaceCodepoint",
    () => spaceCodepoint,
    (value) => {
      spaceCodepoint = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontRangesContainSpace",
    () => fontRangesContainSpace,
    (value) => {
      fontRangesContainSpace = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssFontFaceRulePattern",
    () => cssFontFaceRulePattern,
    (value) => {
      cssFontFaceRulePattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "cssFontFacePropertyPattern",
    () => cssFontFacePropertyPattern,
    (value) => {
      cssFontFacePropertyPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontFamilyDeclarationPattern",
    () => fontFamilyDeclarationPattern,
    (value) => {
      fontFamilyDeclarationPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontStyleDeclarationPattern",
    () => fontStyleDeclarationPattern,
    (value) => {
      fontStyleDeclarationPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontWeightDeclarationPattern",
    () => fontWeightDeclarationPattern,
    (value) => {
      fontWeightDeclarationPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontUnicodeRangeDeclarationPattern",
    () => fontUnicodeRangeDeclarationPattern,
    (value) => {
      fontUnicodeRangeDeclarationPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fontFaceAssetUrlPattern",
    () => fontFaceAssetUrlPattern,
    (value) => {
      fontFaceAssetUrlPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parseExportFontFaceRules",
    () => parseExportFontFaceRules,
  );
  bindRuntimeValue(runtime, "indexExportFontUsage", () => indexExportFontUsage);
  bindRuntimeValue(
    runtime,
    "pruneUnusedExportFontFaces",
    () => pruneUnusedExportFontFaces,
  );
  bindRuntimeValue(
    runtime,
    "googleFontsCssUrlPattern",
    () => googleFontsCssUrlPattern,
    (value) => {
      googleFontsCssUrlPattern = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createFontAwareExportResolver",
    () => createFontAwareExportResolver,
  );
  return () => {
    fontLoadStates = new Set(["unloaded", "loading", "loaded", "error"]);
    maxExportFontFaces = 2e4;
    maxExportFontDescriptorLength = 16e3;
    maxExportFontDescriptorBytes = 8e6;
    exportFontProbeTimeoutMs = 3e3;
    fontLoadProbeScript = (timeoutMs: number): string =>
      "(function(){if(window.frames.length>0||!document.fonts)return null;var deadline=Date.now()+" +
      String(timeoutMs) +
      `;var raf=window.requestAnimationFrame||function(f){setTimeout(f,16)};var headAt=Date.now();var mo=window.MutationObserver&&document.head?new MutationObserver(function(){headAt=Date.now()}):null;if(mo)mo.observe(document.head,{childList:true});var pending=function(){void(document.body&&document.body.offsetHeight);if(Date.now()-headAt<200||document.readyState!=='complete')return true;var l=document.querySelectorAll('link[rel~="stylesheet"][href^="https://fonts.googleapis.com/"]');for(var i=0;i<l.length;i++){if(!l[i].sheet)return true}return false};var loaded=new Promise(function(r){var on=0;var done=function(v){if(mo)mo.disconnect();r(v)};var tick=function(){if(!pending())done(true);else if(Date.now()>deadline)done(false);else setTimeout(tick,100)};var start=function(){if(!on){on=1;tick()}};raf(function(){raf(start)});setTimeout(start,120)});return loaded.then(function(ok){if(!ok)return null;var settled=document.fonts.ready.then(function(){},function(){});var cap=new Promise(function(r){setTimeout(r,Math.max(0,deadline-Date.now()))});return Promise.race([settled,cap]).then(function(){void(document.documentElement&&document.documentElement.offsetHeight);var o=[],seen={};document.fonts.forEach(function(f){var r={family:String(f.family),style:String(f.style),weight:String(f.weight),unicodeRange:String(f.unicodeRange),status:String(f.status)};var k=[r.family,r.style,r.weight,r.unicodeRange,r.status].join('|');if(!seen[k]){seen[k]=1;o.push(r)}});return o})})})()`;
    fontLoadProbeScriptDefault = fontLoadProbeScript(exportFontProbeTimeoutMs);
    isValidExportFontDescriptor = (state: unknown): state is FontDescriptor =>
      typeof state == "object" &&
      state !== null &&
      ["family", "style", "weight", "unicodeRange", "status"].every(
        (input) =>
          typeof (state as DataRecord)[input] == "string" &&
          ((state as DataRecord)[input] as string).length <=
            maxExportFontDescriptorLength,
      ) &&
      fontLoadStates.has((state as DataRecord).status as string);
    fullUnicodeRange = [0, 1114111];
    normalizeFontFamily = (family: string): string =>
      family
        .trim()
        .replace(/^["']|["']$/g, "")
        .trim()
        .toLowerCase();
    fontUnicodeRangesKey = (ranges: readonly UnicodeRange[]): string =>
      ranges
        .map((input2) => String(input2[0]) + "-" + String(input2[1]))
        .join(",");
    fontFaceKey = (family: string, style: string, weight: string): string =>
      normalizeFontFamily(family) +
      `
` +
      style.trim().toLowerCase() +
      `
` +
      normalizeFontWeightRange(weight);
    spaceCodepoint = 32;
    fontRangesContainSpace = (ranges: readonly UnicodeRange[]): boolean =>
      ranges.some(
        ([input2, input3]) =>
          input2 <= spaceCodepoint && spaceCodepoint <= input3,
      );
    cssFontFaceRulePattern = /@font-face\s*\{[^}]*\}/gi;
    cssFontFacePropertyPattern = (property: string): RegExp =>
      new RegExp("(?:^|[{;\\s])" + property + "\\s*:\\s*([^;}]+)", "i");
    fontFamilyDeclarationPattern = cssFontFacePropertyPattern("font-family");
    fontStyleDeclarationPattern = cssFontFacePropertyPattern("font-style");
    fontWeightDeclarationPattern = cssFontFacePropertyPattern("font-weight");
    fontUnicodeRangeDeclarationPattern =
      cssFontFacePropertyPattern("unicode-range");
    fontFaceAssetUrlPattern =
      /url\(\s*(?:"(?!data:|blob:|#)([^"]+)"|'(?!data:|blob:|#)([^']+)'|(?!['"]|data:|blob:|#)([^)]+?))\s*\)/gi;
    googleFontsCssUrlPattern = /^https:\/\/fonts\.googleapis\.com\//i;
  };
}
