/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
  type ReactNamespace,
} from "../bindings";
import type {
  DeckContent,
  DeckSection,
  FontFace,
  Slide,
  SlideId,
} from "../deck-contracts";

/** One section as stored in the legacy deck metadata record. */
export interface LegacySectionRecord {
  title?: string;
  description: string;
  start: SlideId | null;
  before: SlideId | null;
  seq?: number;
}
/** Deck metadata record (v3) written to the deck document. */
export interface LegacyDeckMetadata {
  v: 3;
  title: string;
  order: SlideId[];
  cover?: SlideId;
  sections?: Record<string, LegacySectionRecord>;
}
/** Stored form of a slide: its serialised HTML plus separately kept notes. */
export interface SerializedSlideRecord {
  html: string;
  notes?: string;
}
type FontStoreKey = (family: string) => string;
type UniqueDeckFontFaces = (deck: DeckContent) => FontFace[];
type LegacyDeckMetadataBuilder = (
  title: string,
  order: SlideId[],
  sections?: DeckSection[],
  cover?: SlideId,
) => LegacyDeckMetadata;
type CloneFontFaceRecord = (face: FontFace) => FontFace;
type SerializedSlideRecordBuilder = (
  assets: DeckContent,
  slide: Slide,
  includeNotes?: boolean,
) => SerializedSlideRecord;

declare module "../bindings" {
  interface RuntimeBindings {
    reactK_: ReactNamespace;
    DECK_STORE_COLLECTION: string;
    DECK_META_STORE_KEY: string;
    SLIDE_STORE_COLLECTION: string;
    FONT_STORE_COLLECTION: string;
    fontStoreKey: FontStoreKey;
    uniqueDeckFontFaces: UniqueDeckFontFaces;
    legacyDeckMetadata: LegacyDeckMetadataBuilder;
    cloneFontFaceRecord: CloneFontFaceRecord;
    serializedSlideRecord: SerializedSlideRecordBuilder;
  }
}

export function installModelArtifactStoreRecords(
  runtime: RuntimeBindings,
): () => void {
  var reactK_: ReactNamespace;
  var DECK_STORE_COLLECTION: string;
  var DECK_META_STORE_KEY: string;
  var SLIDE_STORE_COLLECTION: string;
  var FONT_STORE_COLLECTION: string;
  function fontStoreKey(family: string): string {
    return family.toLowerCase().replace(/ /g, "-");
  }
  function uniqueDeckFontFaces(deck: DeckContent): FontFace[] {
    let items: FontFace[] = [],
      values = new Set<string>();
    for (let value of [
      ...(deck.faces ?? []),
      deck.fonts?.sans,
      deck.fonts?.serif,
    ]) {
      if (value === undefined || values.has(fontStoreKey(value.family))) {
        continue;
      }
      values.add(fontStoreKey(value.family));
      items.push(value);
    }
    return items;
  }
  function legacyDeckMetadata(
    title: string,
    order: SlideId[],
    sections?: DeckSection[],
    cover?: SlideId,
  ): LegacyDeckMetadata {
    let state: LegacyDeckMetadata = {
      v: 3,
      title: title,
      order: [...order],
      ...(cover !== undefined
        ? {
            cover: cover,
          }
        : {}),
    };
    if (sections === undefined) {
      return state;
    }
    let state2: Record<string, LegacySectionRecord> = {};
    for (let value of sections) {
      let value2: { title?: string } =
        value.title !== undefined
          ? {
              title: value.title,
            }
          : {};
      state2[value.id] =
        value.start !== undefined
          ? {
              ...value2,
              description: value.description,
              start: value.start,
              before: null,
            }
          : {
              ...value2,
              description: value.description,
              start: null,
              before: value.before ?? null,
              ...(value.seq !== undefined
                ? {
                    seq: value.seq,
                  }
                : {}),
            };
    }
    return {
      ...state,
      sections: state2,
    };
  }
  function cloneFontFaceRecord(face: FontFace): FontFace {
    return {
      ...face,
    };
  }
  function serializedSlideRecord(
    assets: DeckContent,
    slide: Slide,
    includeNotes?: boolean,
  ): SerializedSlideRecord {
    if (includeNotes) {
      return {
        html: (0, runtime.serializeSlideHtml)(assets, slide),
      };
    }
    let { notes: notes, ...remainingProps }: Slide = slide;
    return {
      html: (0, runtime.serializeSlideHtml)(assets, remainingProps),
      ...(notes !== undefined
        ? {
            notes: notes,
          }
        : {}),
    };
  }
  bindRuntimeValue(
    runtime,
    "reactK_",
    () => reactK_,
    (value) => {
      reactK_ = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DECK_STORE_COLLECTION",
    () => DECK_STORE_COLLECTION,
    (value) => {
      DECK_STORE_COLLECTION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DECK_META_STORE_KEY",
    () => DECK_META_STORE_KEY,
    (value) => {
      DECK_META_STORE_KEY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SLIDE_STORE_COLLECTION",
    () => SLIDE_STORE_COLLECTION,
    (value) => {
      SLIDE_STORE_COLLECTION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FONT_STORE_COLLECTION",
    () => FONT_STORE_COLLECTION,
    (value) => {
      FONT_STORE_COLLECTION = value;
    },
  );
  bindRuntimeValue(runtime, "fontStoreKey", () => fontStoreKey);
  bindRuntimeValue(runtime, "uniqueDeckFontFaces", () => uniqueDeckFontFaces);
  bindRuntimeValue(runtime, "legacyDeckMetadata", () => legacyDeckMetadata);
  bindRuntimeValue(runtime, "cloneFontFaceRecord", () => cloneFontFaceRecord);
  bindRuntimeValue(
    runtime,
    "serializedSlideRecord",
    () => serializedSlideRecord,
  );
  return () => {
    (0, runtime.initializeUiInputs210)();
    reactK_ = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    (0, runtime.initializeFontCatalog)();
    (0, runtime.initializeStyleSchema)();
    (0, runtime.initializeHtmlCompiler)();
    (0, runtime.initializeHtmlWriter)();
    DECK_STORE_COLLECTION = "deck";
    DECK_META_STORE_KEY = "meta";
    SLIDE_STORE_COLLECTION = "slides";
    FONT_STORE_COLLECTION = "fonts";
  };
}
