import type * as React from "react";
import type * as Editor from "../contracts/editor-runtime";
import type * as Model from "../contracts";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorFontFaces(runtime: RuntimeBindings): () => void {
  var CSS_GENERIC_FONT_FAMILIES: Set<string>;
  var FONT_DATA_URL_PATTERN: RegExp;
  var fontFileUrl: (font: Model.ParsedFont) => string;
  function quoteCssFontFamily(family: string): string {
    let normalizedFamily = family.trim().toLowerCase();
    if (CSS_GENERIC_FONT_FAMILIES.has(normalizedFamily)) {
      return normalizedFamily;
    }
    return '"' + family.replace(/[\\"]/g, "\\$&") + '"';
  }
  function fontFileCssFamilyName(path: string): string {
    return (
      "ds-font-" +
      path
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
    );
  }
  function fontFamilyStack(family: string, fontPaths: string[] = []): string {
    let fallbackStack: string =
      quoteCssFontFamily(family) + ", ui-sans-serif, system-ui, sans-serif";
    if (fontPaths.length === 0) {
      return fallbackStack;
    }
    return (
      fontPaths
        .map((input) => quoteCssFontFamily(fontFileCssFamilyName(input)))
        .join(", ") +
      ", " +
      fallbackStack
    );
  }
  function decodeFontDataUrl(dataUrl: string): ArrayBuffer | null {
    if (!FONT_DATA_URL_PATTERN.test(dataUrl)) {
      return null;
    }
    try {
      let value = dataUrl.slice(dataUrl.indexOf(",") + 1),
        value2 = atob(value),
        value3 = new Uint8Array(value2.length);
      for (let index: number = 0; index < value2.length; index++) {
        value3[index] = value2.charCodeAt(index);
      }
      return value3.buffer;
    } catch {
      return null;
    }
  }
  function resolvedFontDataUrl(font: Model.ParsedFont): string {
    if (font.src === "") {
      return "";
    }
    if ((0, runtime.isDataUriUrl)(font.src)) {
      return font.src;
    } else {
      return (0, runtime.cachedBlobDataUrl)(font.src) ?? "";
    }
  }
  function useInlineFontFaces(
    fonts: Model.ParsedFont[],
    generation: number = 0,
  ): void {
    let fontsKey: string =
        fonts
          .map(
            (input): string =>
              input.path +
              ":" +
              String(resolvedFontDataUrl(input).length) +
              ":" +
              input.family +
              ":" +
              input.weight +
              ":" +
              input.style,
          )
          .join("|") +
        "#" +
        String(generation),
      fontsRef = (runtime.reactFontFaces as typeof React).useRef(fonts);
    fontsRef.current = fonts;
    (runtime.reactFontFaces as typeof React).useEffect(() => {
      let items: FontFace[] = [];
      for (let value of fontsRef.current) {
        let value2 = resolvedFontDataUrl(value);
        if (value2 === "") {
          continue;
        }
        let value3 = decodeFontDataUrl(value2);
        if (value3 === null) {
          continue;
        }
        try {
          let value4 = new FontFace(fontFileCssFamilyName(value.path), value3, {
            weight: value.weight,
            style: value.style,
          });
          document.fonts.add(value4);
          items.push(value4);
        } catch {}
      }
      return (): void => {
        for (let value of items) {
          document.fonts.delete(value);
        }
      };
    }, [fontsKey]);
    useAddressedFontFaces(fonts);
  }
  function useAddressedFontFaces(fonts: Model.ParsedFont[]): void {
    let [value, value2] = (runtime.reactFontFaces as typeof React).useReducer(
        (input: number) => input + 1,
        0,
      ),
      ref = (runtime.reactFontFaces as typeof React).useRef(
        new Map<string, Editor.AddressedFontFace>(),
      ),
      entries = new Map<string, Editor.AddressedFontSource>(
        fonts
          .filter(
            (input) =>
              input.store === "file" &&
              input.src !== "" &&
              !["image", "video", "audio"].includes(
                (0, runtime.assetKindForPath)(input.path),
              ) &&
              (0, runtime.mimeTypeForPath)(input.path) !== "application/pdf" &&
              !Object.hasOwn(
                runtime.HELD_BINARY_MIME_TYPES,
                (0, runtime.fileExtension)(input.path),
              ),
          )
          .map((input) => [
            input.path +
              `
` +
              input.weight +
              `
` +
              input.style,
            {
              path: input.path,
              of: (0, runtime.resolveFileVersion)(input.path) ?? "",
              at: fontFileUrl(input),
              weight: input.weight,
              style: input.style,
            },
          ]),
      ),
      ref2 = (runtime.reactFontFaces as typeof React).useRef(entries);
    ref2.current = entries;
    let value3: boolean = entries.size > 0;
    (runtime.reactFontFaces as typeof React).useEffect(
      () => (value3 ? (0, runtime.subscribeAddressedFiles)(value2) : undefined),
      [value3],
    );
    let value4 = [...entries]
      .map(
        ([input, input2]): string => input + ":" + input2.of + ":" + input2.at,
      )
      .join("|");
    (runtime.reactFontFaces as typeof React).useEffect((): void => {
      for (let [value5, value6] of ref.current) {
        let entry = ref2.current.get(value5);
        if (
          entry !== undefined &&
          entry.of === value6.of &&
          (entry.at === value6.at ||
            value6.face.status === "loaded" ||
            value6.face.status === "loading")
        ) {
          continue;
        }
        document.fonts.delete(value6.face);
        ref.current.delete(value5);
      }
      for (let [value5, value6] of ref2.current) {
        if (ref.current.has(value5) || value6.at === "") {
          continue;
        }
        try {
          let value7 = new FontFace(
            fontFileCssFamilyName(value6.path),
            'url("' + value6.at + '")',
            {
              weight: value6.weight,
              style: value6.style,
              display: "swap",
            },
          );
          document.fonts.add(value7);
          ref.current.set(value5, {
            face: value7,
            of: value6.of,
            at: value6.at,
          });
          value7.loaded.catch((): void => {
            if (ref.current.get(value5)?.face !== value7) {
              return;
            }
            if (ref2.current.get(value5)?.at !== value6.at) {
              document.fonts.delete(value7);
              ref.current.delete(value5);
              value2();
              return;
            }
            console.warn(
              "design-system: could not load the font " +
                value6.path +
                " from its address (" +
                value6.at +
                "), so text in it is shown in a fallback font. Reload the page; if that does not help, the file may not be a usable font.",
            );
          });
        } catch {}
      }
    }, [value4, value]);
    (runtime.reactFontFaces as typeof React).useEffect(
      () => (): void => {
        for (let value5 of ref.current.values()) {
          document.fonts.delete(value5.face);
        }
        ref.current.clear();
      },
      [],
    );
  }
  bindRuntimeValue(
    runtime,
    "CSS_GENERIC_FONT_FAMILIES",
    () => CSS_GENERIC_FONT_FAMILIES,
    (value) => {
      CSS_GENERIC_FONT_FAMILIES = value;
    },
  );
  bindRuntimeValue(runtime, "quoteCssFontFamily", () => quoteCssFontFamily);
  bindRuntimeValue(
    runtime,
    "fontFileCssFamilyName",
    () => fontFileCssFamilyName,
  );
  bindRuntimeValue(runtime, "fontFamilyStack", () => fontFamilyStack);
  bindRuntimeValue(
    runtime,
    "FONT_DATA_URL_PATTERN",
    () => FONT_DATA_URL_PATTERN,
    (value) => {
      FONT_DATA_URL_PATTERN = value;
    },
  );
  bindRuntimeValue(runtime, "decodeFontDataUrl", () => decodeFontDataUrl);
  bindRuntimeValue(runtime, "resolvedFontDataUrl", () => resolvedFontDataUrl);
  bindRuntimeValue(runtime, "useInlineFontFaces", () => useInlineFontFaces);
  bindRuntimeValue(
    runtime,
    "fontFileUrl",
    () => fontFileUrl,
    (value) => {
      fontFileUrl = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "useAddressedFontFaces",
    () => useAddressedFontFaces,
  );
  return () => {
    CSS_GENERIC_FONT_FAMILIES = new Set([
      "serif",
      "sans-serif",
      "monospace",
      "cursive",
      "fantasy",
      "system-ui",
      "math",
      "emoji",
      "fangsong",
      "ui-serif",
      "ui-sans-serif",
      "ui-monospace",
      "ui-rounded",
    ]);
    FONT_DATA_URL_PATTERN =
      /^data:(?:font\/(?:woff2|woff|ttf|otf|sfnt)|application\/(?:font-woff2?|x-font-(?:ttf|otf|woff))|application\/octet-stream);base64,[A-Za-z0-9+/=]+$/;
    fontFileUrl = (font: Model.ParsedFont) => {
      try {
        return new URL(
          (0, runtime.addressedProjectFileUrl)(font.path) ?? font.src,
          document.baseURI,
        ).href;
      } catch {
        return "";
      }
    };
  };
}
