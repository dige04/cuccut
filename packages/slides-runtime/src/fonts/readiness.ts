/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";

/** Whether the text of a family that missed its deadline was measured or is drawn in a substitute font. */
export type FontWarningMode = "drawn" | "sized";

declare module "../bindings" {
  interface RuntimeBindings {
    loadingFontFaces: (fontFaces: Iterable<FontFace>) => FontFace[];
    uniqueFontFamilyNames: (fontFaces: readonly FontFace[]) => string[];
    fontTimeoutWarning: (
      families: readonly string[],
      mode?: FontWarningMode,
    ) => string;
    fontUnavailableWarning: (
      families: readonly string[],
      mode?: FontWarningMode,
    ) => string;
    formatFontFamilyList: (families: readonly string[]) => string;
    /** Waits for the font set to settle; resolves with the faces still loading when the timeout hits. */
    waitForDocumentFonts: (
      fontSet: FontFaceSet,
      timeoutMs?: number,
    ) => Promise<FontFace[]>;
    /** Resolves with the promise's value, or `undefined` once the timeout passes first. */
    promiseWithTimeout: <T>(
      promise: Promise<T>,
      timeoutMs: number,
    ) => Promise<T | undefined>;
    fontReadyTimeoutMs: number;
    unquoteFontFamilyName: (family: string) => string;
  }
}

export function installFontsReadiness(runtime: RuntimeBindings): () => void {
  var fontReadyTimeoutMs: RuntimeBindings["fontReadyTimeoutMs"];
  var unquoteFontFamilyName: RuntimeBindings["unquoteFontFamilyName"];
  function loadingFontFaces(fontFaces: Iterable<FontFace>): FontFace[] {
    return [...fontFaces].filter(
      (state: FontFace): boolean => state.status === "loading",
    );
  }
  function uniqueFontFamilyNames(fontFaces: readonly FontFace[]): string[] {
    return [
      ...new Set(
        fontFaces.map(
          (input: FontFace): string => unquoteFontFamilyName(input.family),
        ),
      ),
    ];
  }
  function fontTimeoutWarning(
    families: readonly string[],
    mode?: FontWarningMode,
  ): string {
    let textPossessive: string =
      "some of " + (families.length === 1 ? "its" : "their") + " text";
    return (
      formatFontFamilyList(families) +
      " did not load in time" +
      (mode === "drawn"
        ? ", so " +
          textPossessive +
          " may be drawn in a substitute font or not fit its box"
        : "; " +
          textPossessive +
          " was sized with a substitute font and may not fit its box exactly")
    );
  }
  function fontUnavailableWarning(
    families: readonly string[],
    mode?: FontWarningMode,
  ): string {
    let singleFamily: boolean = families.length === 1,
      textPossessive: string = (singleFamily ? "its" : "their") + " text";
    return (
      formatFontFamilyList(families) +
      (singleFamily ? " was" : " were") +
      " not available" +
      (mode === "drawn"
        ? ", so " +
          textPossessive +
          " is drawn in a substitute font and may not fit its box"
        : "; " +
          textPossessive +
          " was sized with a substitute font and may not fit its box exactly")
    );
  }
  function formatFontFamilyList(families: readonly string[]): string {
    if (families.length === 1) {
      return "the font " + String(families[0]);
    } else {
      return (
        "the fonts " +
        families.slice(0, -1).join(", ") +
        " and " +
        String(families[families.length - 1])
      );
    }
  }
  async function waitForDocumentFonts(
    fontSet: FontFaceSet,
    timeoutMs?: number,
  ): Promise<FontFace[]> {
    if (timeoutMs === undefined) {
      await fontSet.ready;
      return [];
    }
    if (
      (await promiseWithTimeout(
        fontSet.ready.then((): string => "ready"),
        timeoutMs,
      )) === "ready"
    ) {
      return [];
    }
    let loadingFaces: FontFace[] = loadingFontFaces(fontSet),
      fontDescription: string = loadingFaces
        .map(
          (input: FontFace): string =>
            unquoteFontFamilyName(input.family) +
            " " +
            input.weight +
            " " +
            input.style,
        )
        .join(", ");
    console.warn(
      "Slides export: stopped waiting for fonts after " +
        String(timeoutMs) +
        " ms" +
        (loadingFaces.length > 0
          ? ". Still loading: " +
            fontDescription +
            ". Text in those faces is measured and drawn with a fallback font, so the exported file may differ from the slides on screen."
          : "; no face reports itself still loading, so going on with the fonts available now."),
    );
    return loadingFaces;
  }
  function promiseWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
  ): Promise<T | undefined> {
    let timeout: ReturnType<typeof setTimeout> | undefined,
      timeoutPromise: Promise<undefined> = new Promise<undefined>(
        (input: (value: undefined) => void): void => {
          timeout = setTimeout((): void => input(undefined), timeoutMs);
        },
      );
    return Promise.race([promise, timeoutPromise]).finally(
      (): void => clearTimeout(timeout),
    );
  }
  bindRuntimeValue(runtime, "loadingFontFaces", () => loadingFontFaces);
  bindRuntimeValue(
    runtime,
    "uniqueFontFamilyNames",
    () => uniqueFontFamilyNames,
  );
  bindRuntimeValue(runtime, "fontTimeoutWarning", () => fontTimeoutWarning);
  bindRuntimeValue(
    runtime,
    "fontUnavailableWarning",
    () => fontUnavailableWarning,
  );
  bindRuntimeValue(runtime, "formatFontFamilyList", () => formatFontFamilyList);
  bindRuntimeValue(runtime, "waitForDocumentFonts", () => waitForDocumentFonts);
  bindRuntimeValue(runtime, "promiseWithTimeout", () => promiseWithTimeout);
  bindRuntimeValue(
    runtime,
    "fontReadyTimeoutMs",
    () => fontReadyTimeoutMs,
    (value) => {
      fontReadyTimeoutMs = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "unquoteFontFamilyName",
    () => unquoteFontFamilyName,
    (value) => {
      unquoteFontFamilyName = value;
    },
  );
  return () => {
    fontReadyTimeoutMs = 6000;
    unquoteFontFamilyName = (input: string): string =>
      input.replace(/["']/g, "");
  };
}
