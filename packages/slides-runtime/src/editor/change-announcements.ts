/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { DeckContent, Slide } from "../deck-contracts";

/** What a slide's last serialization depended on, so the cached HTML can be reused. */
interface SlideAnnouncementFingerprint {
  theme: DeckContent["theme"];
  fonts: unknown;
  assets: DeckContent["assets"];
  html: string;
}
/** Screen-reader phrases for remote presentation changes, keyed by the kind of change. */
export interface PresentationChangeAnnouncements {
  ready(slideCount: number): string;
  updated(slideCount: number): string;
  changed(slideCount: number): string;
}

declare module "../bindings" {
  interface RuntimeBindings {
    formatSlideCount: (count: number) => string;
    PRESENTATION_CHANGE_ANNOUNCEMENTS: PresentationChangeAnnouncements;
    slideAnnouncementFingerprintCache: WeakMap<
      Slide,
      SlideAnnouncementFingerprint
    >;
    createSlideAnnouncementFingerprints: (
      content: DeckContent,
    ) => Map<string, string>;
    slideAnnouncementFingerprint: (value: unknown) => string;
  }
}

export function installEditorChangeAnnouncements(
  runtime: RuntimeBindings,
): () => void {
  var formatSlideCount: RuntimeBindings["formatSlideCount"];
  var PRESENTATION_CHANGE_ANNOUNCEMENTS: RuntimeBindings["PRESENTATION_CHANGE_ANNOUNCEMENTS"];
  var slideAnnouncementFingerprintCache: RuntimeBindings["slideAnnouncementFingerprintCache"];
  function createSlideAnnouncementFingerprints(
    content: DeckContent,
  ): Map<string, string> {
    let fingerprints = new Map<string, string>();
    for (let value2 of content.order) {
      let value3 = content.slides[value2];
      if (value3 === undefined) {
        continue;
      }
      let entry = slideAnnouncementFingerprintCache.get(value3);
      if (
        entry === undefined ||
        entry.theme !== content.theme ||
        entry.fonts !== content.fonts ||
        entry.assets !== content.assets
      ) {
        slideAnnouncementFingerprintCache.set(
          value3,
          (entry = {
            theme: content.theme,
            fonts: content.fonts,
            assets: content.assets,
            html: (0, runtime.serializeSlideHtml)(content, value3),
          }),
        );
      }
      fingerprints.set(value2, entry.html);
    }
    let value = [...(content.sections ?? [])].sort(
      (input, options): number =>
        input.id < options.id ? -1 : input.id > options.id ? 1 : 0,
    );
    fingerprints.set(
      runtime.REMOTE_CHANGE_WORD_SEPARATOR + "deck",
      slideAnnouncementFingerprint([
        content.order,
        value,
        content.theme,
        content.fonts,
        content.faces,
        content.cover,
        content.format,
      ]),
    );
    return fingerprints;
  }
  function slideAnnouncementFingerprint(value: unknown): string {
    return JSON.stringify(
      value,
      (input: string, items: unknown): unknown => {
        if (typeof items === "string") {
          if (items.startsWith("data:")) {
            return items.length;
          } else {
            return items;
          }
        }
        if (
          typeof items !== "object" ||
          items === null ||
          Array.isArray(items)
        ) {
          return items;
        }
        let value2 = items as Record<string, unknown>;
        return Object.fromEntries(
          Object.keys(value2)
            .sort()
            .map((input2: string): [string, unknown] => [
              input2,
              value2[input2],
            ]),
        );
      },
    );
  }
  bindRuntimeValue(
    runtime,
    "formatSlideCount",
    () => formatSlideCount,
    (value) => {
      formatSlideCount = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PRESENTATION_CHANGE_ANNOUNCEMENTS",
    () => PRESENTATION_CHANGE_ANNOUNCEMENTS,
    (value) => {
      PRESENTATION_CHANGE_ANNOUNCEMENTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slideAnnouncementFingerprintCache",
    () => slideAnnouncementFingerprintCache,
    (value) => {
      slideAnnouncementFingerprintCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createSlideAnnouncementFingerprints",
    () => createSlideAnnouncementFingerprints,
  );
  bindRuntimeValue(
    runtime,
    "slideAnnouncementFingerprint",
    () => slideAnnouncementFingerprint,
  );
  return () => {
    (0, runtime.initializeHtmlWriter)();
    formatSlideCount = (count: number): string =>
      String(count) + (count === 1 ? " slide" : " slides");
    PRESENTATION_CHANGE_ANNOUNCEMENTS = {
      ready: (input: number): string =>
        "Presentation ready, " + formatSlideCount(input),
      updated: (input: number): string =>
        formatSlideCount(input) + " updated",
      changed: (input: number): string =>
        "Presentation updated, " +
        (input === 0 ? "no slides left" : formatSlideCount(input) + " in all"),
    };
    slideAnnouncementFingerprintCache = new WeakMap();
  };
}
