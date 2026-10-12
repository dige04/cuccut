/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { Slide, SlideId } from "../deck-contracts";

/** A slide that disappeared from the order while slides were still loading; kept for a while in case it comes back. */
export interface LimboSlide {
  slide: Slide;
  /** When it was parked, milliseconds since the epoch. */
  at: number;
}

export interface RecentlyRemovedSlidesOptions {
  /** When each slide was added in this session, milliseconds since the epoch. */
  added: ReadonlyMap<SlideId, number>;
  now: number;
  /** The order and slides before the change. */
  before: { order: SlideId[]; slides: Slide[] };
  /** The order after the change. */
  order: SlideId[];
  /** Slides are still arriving. */
  awaiting: boolean;
  wasAwaiting: boolean;
  limbo: LimboSlide[];
}

export interface PreservedRemovedSlides {
  /** Slides to put back at the end of the order. */
  back: Slide[];
  limbo: LimboSlide[];
}

declare module "../bindings" {
  interface RuntimeBindings {
    preserveRecentlyRemovedSlides: (
      options: RecentlyRemovedSlidesOptions,
    ) => PreservedRemovedSlides;
  }
}

export function installDocumentsRemovedSlides(
  runtime: RuntimeBindings,
): () => void {
  function preserveRecentlyRemovedSlides(
    options: RecentlyRemovedSlidesOptions,
  ): PreservedRemovedSlides {
    let isRecentlyAdded = (input: SlideId) =>
        options.now - (options.added.get(input) ?? -1 / 0) <= 300000,
      recentlyRemoved = options.before.order.every(isRecentlyAdded)
        ? options.before.slides.filter(
            (input) => !options.order.includes(input.id),
          )
        : [],
      limbo = options.limbo.filter(
        (input) =>
          options.now - input.at <= 180000 &&
          !recentlyRemoved.some((input2) => input2.id === input.slide.id),
      );
    if (options.order.some((input) => !options.before.order.includes(input))) {
      return {
        back: [...limbo.map((input) => input.slide), ...recentlyRemoved].filter(
          (input) => !options.order.includes(input.id),
        ),
        limbo: [],
      };
    }
    if (!options.awaiting) {
      return {
        back: [],
        limbo: [],
      };
    }
    return {
      back: [],
      limbo: [
        ...limbo,
        ...(options.wasAwaiting
          ? []
          : recentlyRemoved.map((input) => ({
              slide: input,
              at: options.now,
            }))),
      ],
    };
  }
  bindRuntimeValue(
    runtime,
    "preserveRecentlyRemovedSlides",
    () => preserveRecentlyRemovedSlides,
  );
  return () => {
    (0, runtime.initializeSlideModel)();
    (0, runtime.initializeSections)();
  };
}
