/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { StateFileContents } from "./state-file";

declare module "../bindings" {
  interface RuntimeBindings {
    LEGACY_SLIDES_HTML_PATH: string;
    LEGACY_SLIDES_DEMO_PATH: string;
    MAX_LEGACY_HTML_CHARS: number;
    /** Parses a whole-document slide HTML file into state, or returns why it cannot be used. */
    parseLegacySlidesHtml: (html: string) => string | StateFileContents;
  }
}

export function installBootLegacyHtml(runtime: RuntimeBindings): () => void {
  var LEGACY_SLIDES_HTML_PATH: string;
  var LEGACY_SLIDES_DEMO_PATH: string;
  var MAX_LEGACY_HTML_CHARS: number;
  var parseLegacySlidesHtml: (html: string) => string | StateFileContents;

  bindRuntimeValue(
    runtime,
    "LEGACY_SLIDES_HTML_PATH",
    () => LEGACY_SLIDES_HTML_PATH,
    (value) => {
      LEGACY_SLIDES_HTML_PATH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LEGACY_SLIDES_DEMO_PATH",
    () => LEGACY_SLIDES_DEMO_PATH,
    (value) => {
      LEGACY_SLIDES_DEMO_PATH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_LEGACY_HTML_CHARS",
    () => MAX_LEGACY_HTML_CHARS,
    (value) => {
      MAX_LEGACY_HTML_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parseLegacySlidesHtml",
    () => parseLegacySlidesHtml,
    (value) => {
      parseLegacySlidesHtml = value;
    },
  );
  return () => {
    (0, runtime.initializeHtmlCompiler)();
    (0, runtime.initializeSlideModel)();
    LEGACY_SLIDES_HTML_PATH = "slides.html";
    LEGACY_SLIDES_DEMO_PATH = "artifact-type/demo.html";
    MAX_LEGACY_HTML_CHARS = 33554432;
    parseLegacySlidesHtml = (html: string) => {
      if (html.length > MAX_LEGACY_HTML_CHARS) {
        return "too large";
      }
      if (!(0, runtime.looksLikeSlideHtml)(html)) {
        return "not a slide HTML document";
      }
      let parsed = (0, runtime.compileSlideHtml)(html);
      if ((0, runtime.normalizeDeck)(parsed.content).order.length === 0) {
        return "no slides";
      }
      let value = parsed.errors[0],
        value2 =
          value === undefined
            ? undefined
            : "Its HTML has " +
              String(parsed.errors.length) +
              " structural error" +
              (parsed.errors.length === 1 ? "" : "s") +
              " (first at " +
              String(value.line) +
              ":" +
              String(value.col) +
              "); what could be read is shown.";
      return {
        envelope:
          parsed.title === undefined
            ? {
                content: html,
              }
            : {
                title: parsed.title,
                content: html,
              },
        note: value2,
      };
    };
  };
}
