/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { DeckIndex } from "../deck-contracts";

/** Reads one file of the deck as text; resolves to `null` when it is missing or unreadable. */
export type ReadFileText = (path: string) => Promise<string | null>;

/** The deck index plus the first few slide files, read before the full file listing is available. */
export interface EarlySlidesFilesEnvelope {
  index: DeckIndex;
  /** Slide file path -> file text. */
  files: Map<string, string>;
}

declare module "../bindings" {
  interface RuntimeBindings {
    MAX_EARLY_FILE_SLIDES: number;
    readEarlySlidesFilesEnvelope: (
      readText: ReadFileText,
    ) => Promise<EarlySlidesFilesEnvelope | null>;
  }
}

export function installFilesEarlySlides(runtime: RuntimeBindings): () => void {
  var MAX_EARLY_FILE_SLIDES: number;
  async function readEarlySlidesFilesEnvelope(
    readText: ReadFileText,
  ): Promise<EarlySlidesFilesEnvelope | null> {
    let indexText = await readText(runtime.DECK_METADATA_PATH),
      rawIndex: unknown;
    try {
      rawIndex = indexText === null ? null : JSON.parse(indexText);
    } catch {
      rawIndex = null;
    }
    if (
      typeof rawIndex !== "object" ||
      rawIndex === null ||
      Array.isArray(rawIndex)
    ) {
      return null;
    }
    let index: DeckIndex = (0, runtime.normalizeDeckMetadata)(rawIndex),
      order = [
        ...(index.cover !== undefined ? [index.cover] : []),
        ...index.order.filter((input) => input !== index.cover),
      ]
        .filter(
          (input) =>
            (0, runtime.slideIdFromFilePath)(
              (0, runtime.slideFilePath)(input),
            ) !== undefined,
        )
        .slice(0, MAX_EARLY_FILE_SLIDES),
      entries = new Map<string, string>();
    for (let value of order) {
      let value2 = await readText((0, runtime.slideFilePath)(value));
      if (value2 !== null) {
        entries.set((0, runtime.slideFilePath)(value), value2);
      }
    }
    return {
      index: {
        ...index,
        order: index.order.filter((input) =>
          entries.has((0, runtime.slideFilePath)(input)),
        ),
      },
      files: entries,
    };
  }
  bindRuntimeValue(
    runtime,
    "MAX_EARLY_FILE_SLIDES",
    () => MAX_EARLY_FILE_SLIDES,
    (value) => {
      MAX_EARLY_FILE_SLIDES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "readEarlySlidesFilesEnvelope",
    () => readEarlySlidesFilesEnvelope,
  );
  return () => {
    MAX_EARLY_FILE_SLIDES = 4;
  };
}
