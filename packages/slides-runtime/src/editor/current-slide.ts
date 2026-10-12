/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { SlideId } from "../deck-contracts";

/** The slide a session last had open: its id and, when recorded, its position in the deck order. */
export interface CurrentSlidePreference {
  id: SlideId;
  at?: number;
}
/** Which slide to land on after resolving a remembered preference against the live deck order. */
export interface RememberedCurrentSlide {
  /** Slide to show, or null when the deck is empty. */
  id: SlideId | null;
  /** True when the remembered slide still exists. */
  exact: boolean;
  at: number;
  /** The remembered slide id when it no longer exists. */
  home: SlideId | null;
}
/** A page-level `#fragment` link to a slide place. */
export interface PagePlaceLink {
  place: string;
  why: "here" | "known" | "new";
}

declare module "../bindings" {
  interface RuntimeBindings {
    currentSlideStorageKey: (memoryScope?: string) => string;
    readCurrentSlidePreference: (
      memoryScope?: string,
    ) => CurrentSlidePreference | undefined;
    slideAtClampedIndex: (
      order: readonly SlideId[],
      index: number,
    ) => SlideId | undefined;
    resolveRememberedCurrentSlide: (
      order: readonly SlideId[],
      memoryScope?: string,
      rememberDeleted?: boolean,
    ) => RememberedCurrentSlide;
    rememberedCurrentSlideId: (
      order: readonly SlideId[],
      memoryScope?: string,
    ) => SlideId | null;
    writeCurrentSlidePreference: (
      slideId: SlideId,
      index: number,
      memoryScope?: string,
    ) => void;
    SLIDE_PLACE_FRAGMENT_PREFIX: string;
    slidePlaceFragment: (slideId: SlideId) => string;
    resolveSlidePlaceFragment: (
      fragment: string,
      order: readonly SlideId[],
    ) => SlideId | undefined;
    newLinkedSlideId: (
      order: readonly SlideId[],
      placeLink?: PagePlaceLink | null,
    ) => SlideId | undefined;
    initialCurrentSlideId: (
      order: readonly SlideId[],
      placeLink?: PagePlaceLink | null,
    ) => SlideId | null | undefined;
  }
}

export function installEditorCurrentSlide(
  runtime: RuntimeBindings,
): () => void {
  var SLIDE_PLACE_FRAGMENT_PREFIX: RuntimeBindings["SLIDE_PLACE_FRAGMENT_PREFIX"];
  var slidePlaceFragment: RuntimeBindings["slidePlaceFragment"];
  function currentSlideStorageKey(memoryScope = ""): string {
    let path =
      typeof location === "undefined" ? "/" : location.pathname;
    return (
      "slides-current/" +
      (0, runtime.artifactStashKey)(path).slice(
        (0, runtime.artifactStashKey)("").length,
      ) +
      (memoryScope ? "/" + memoryScope : "")
    );
  }
  function readCurrentSlidePreference(
    memoryScope?: string,
  ): CurrentSlidePreference | undefined {
    try {
      let value = sessionStorage.getItem(
        currentSlideStorageKey(memoryScope),
      );
      if (value === null) {
        return;
      }
      let value2 = /^([\w-]*)@(\d{1,4})$/.exec(value);
      if (value2 !== null) {
        return {
          id: value2[1]!,
          at: Number(value2[2]),
        };
      } else {
        return {
          id: value,
        };
      }
    } catch {
      return;
    }
  }
  function slideAtClampedIndex(
    order: readonly SlideId[],
    index: number,
  ): SlideId | undefined {
    return order[Math.min(index, order.length - 1)];
  }
  function resolveRememberedCurrentSlide(
    order: readonly SlideId[],
    memoryScope?: string,
    rememberDeleted = true,
  ): RememberedCurrentSlide {
    let storedPreference = readCurrentSlidePreference(memoryScope);
    if (storedPreference === undefined) {
      return {
        id: order[0] ?? null,
        exact: false,
        at: 0,
        home: null,
      };
    }
    if (order.includes(storedPreference.id)) {
      return {
        id: storedPreference.id,
        exact: true,
        at: order.indexOf(storedPreference.id),
        home: null,
      };
    }
    let value = rememberDeleted
      ? ((storedPreference.at !== undefined
          ? slideAtClampedIndex(order, storedPreference.at)
          : undefined) ??
        order[0] ??
        null)
      : null;
    return {
      id: value,
      exact: false,
      at: value !== null ? order.indexOf(value) : (storedPreference.at ?? 0),
      home: storedPreference.id,
    };
  }
  function rememberedCurrentSlideId(
    order: readonly SlideId[],
    memoryScope?: string,
  ): SlideId | null {
    let remembered = resolveRememberedCurrentSlide(order, memoryScope);
    if (remembered.exact || remembered.home === null) {
      return remembered.id;
    } else {
      return null;
    }
  }
  function writeCurrentSlidePreference(
    slideId: SlideId,
    index: number,
    memoryScope?: string,
  ): void {
    try {
      sessionStorage.setItem(
        currentSlideStorageKey(memoryScope),
        slideId + "@" + String(index),
      );
    } catch {}
  }
  function resolveSlidePlaceFragment(
    fragment: string,
    order: readonly SlideId[],
  ): SlideId | undefined {
    if (!fragment.startsWith(SLIDE_PLACE_FRAGMENT_PREFIX)) {
      return;
    }
    let hash = fragment
      .slice(SLIDE_PLACE_FRAGMENT_PREFIX.length)
      .split(".", 1)[0];
    return order.find(
      (input: SlideId): boolean =>
        (0, runtime.hashScopedSlideId)(input) === hash,
    );
  }
  function newLinkedSlideId(
    order: readonly SlideId[],
    placeLink?: PagePlaceLink | null,
  ): SlideId | undefined {
    if (placeLink?.why === "new") {
      return resolveSlidePlaceFragment(placeLink.place, order);
    } else {
      return undefined;
    }
  }
  function initialCurrentSlideId(
    order: readonly SlideId[],
    placeLink?: PagePlaceLink | null,
  ): SlideId | null | undefined {
    return (
      newLinkedSlideId(order, placeLink) ?? rememberedCurrentSlideId(order)
    );
  }
  bindRuntimeValue(
    runtime,
    "currentSlideStorageKey",
    () => currentSlideStorageKey,
  );
  bindRuntimeValue(
    runtime,
    "readCurrentSlidePreference",
    () => readCurrentSlidePreference,
  );
  bindRuntimeValue(runtime, "slideAtClampedIndex", () => slideAtClampedIndex);
  bindRuntimeValue(
    runtime,
    "resolveRememberedCurrentSlide",
    () => resolveRememberedCurrentSlide,
  );
  bindRuntimeValue(
    runtime,
    "rememberedCurrentSlideId",
    () => rememberedCurrentSlideId,
  );
  bindRuntimeValue(
    runtime,
    "writeCurrentSlidePreference",
    () => writeCurrentSlidePreference,
  );
  bindRuntimeValue(
    runtime,
    "SLIDE_PLACE_FRAGMENT_PREFIX",
    () => SLIDE_PLACE_FRAGMENT_PREFIX,
    (value) => {
      SLIDE_PLACE_FRAGMENT_PREFIX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slidePlaceFragment",
    () => slidePlaceFragment,
    (value) => {
      slidePlaceFragment = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "resolveSlidePlaceFragment",
    () => resolveSlidePlaceFragment,
  );
  bindRuntimeValue(runtime, "newLinkedSlideId", () => newLinkedSlideId);
  bindRuntimeValue(
    runtime,
    "initialCurrentSlideId",
    () => initialCurrentSlideId,
  );
  return () => {
    SLIDE_PLACE_FRAGMENT_PREFIX = "slide-";
    slidePlaceFragment = (input: SlideId): string =>
      SLIDE_PLACE_FRAGMENT_PREFIX + (0, runtime.hashScopedSlideId)(input);
  };
}
