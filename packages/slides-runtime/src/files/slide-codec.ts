/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
} from "../bindings";
import type {
  DeckContent,
  FontFace,
  SlideId,
} from "../deck-contracts";
import type { ArtifactComment, ArtifactState } from "../documents/artifact-document";
import type { InstalledDesignSystemTokens } from "./design-systems";

/** One stored document record (a slide, a font face, the deck record, the design systems ...). */
export type DocumentRecord = Record<string, unknown>;
/** Document records keyed by `<collection>/<id>`. */
export type DocumentRecords = Map<string, DocumentRecord>;

/** A slide the stored deck record lists but the document does not hold, with the slide it follows (`null` = first). */
export interface DanglingSlide {
  id: SlideId;
  after: SlideId | null;
}

/** Ordering state the record codec hands back from `compose` and needs again for the next `decompose`. */
export interface SlideCodecCarry {
  dangling: DanglingSlide[];
  /** Slides whose speaker notes are stored inside the slide record. */
  inlineNotes: SlideId[];
  cover?: SlideId;
}

/** Result of composing document records into an artifact. */
export interface RecordCodecComposed {
  title: string;
  /** Content as assembled from the records; the caller still runs it through its content parser. */
  content: unknown;
  comments: ArtifactComment[];
  carry: SlideCodecCarry;
  /** Record paths of slides listed by the deck record but missing from the records. */
  dangling: string[];
}

/** The record-level codec (`createSlideDocumentCodec().codec`) the file codec builds on. */
export interface RecordCodec {
  compose(
    records: DocumentRecords,
    carry: SlideCodecCarry | undefined,
  ): RecordCodecComposed;
  decompose(
    envelope: ArtifactState<DeckContent>,
    priorRecords: DocumentRecords | undefined,
    context: SlideCodecCarry | undefined,
  ): DocumentRecords;
}

/** The part of the deck index the file codec reads and writes. */
export interface FilesEnvelopeIndex {
  title: string;
  order: SlideId[];
  sections: Record<string, unknown>;
  faces: Record<string, FontFace>;
  cover?: SlideId;
  lists?: unknown;
}

/** Everything the deck stores in files, as read from the files port. */
export interface FilesEnvelope {
  /** Slide file path -> slide file text. */
  files: Map<string, string>;
  index: FilesEnvelopeIndex;
  /** Speaker notes by slide id, for decks that keep them outside the slide files. */
  notes?: Record<SlideId, string>;
  designSystems?: DocumentRecord | InstalledDesignSystemTokens;
}

/** `compose` result: the record codec's, with dangling paths turned into slide file paths. */
export interface ComposedFilesEnvelope extends RecordCodecComposed {}

/** The file layout a deck document decomposes into. */
export interface DecomposedFilesEnvelope {
  /** Slide file path -> slide file text. */
  files: Map<string, string>;
  /** Speaker notes by slide id. */
  notes: Record<SlideId, string>;
  records: DocumentRecords;
  index: FilesEnvelopeIndex;
}

/** Converts between an artifact and the deck's slide files plus index. */
export interface SlidesFileCodec {
  indexPath: string;
  slideFilePath: (id: SlideId) => string;
  slideIdOfPath: (path: string) => SlideId | undefined;
  compose(
    input: FilesEnvelope,
    carry: SlideCodecCarry | undefined,
  ): ComposedFilesEnvelope;
  decompose(
    envelope: ArtifactState<DeckContent>,
    prior: DecomposedFilesEnvelope | undefined,
    context: SlideCodecCarry | undefined,
  ): DecomposedFilesEnvelope;
}

declare module "../bindings" {
  interface RuntimeBindings {
    optionalFileRecordString: (input: unknown) => string | undefined;
    composeSlidesFilesEnvelope: (
      codec: RecordCodec,
      fileEnvelope: FilesEnvelope,
      carry: SlideCodecCarry | undefined,
    ) => ComposedFilesEnvelope;
    decomposeSlidesFilesEnvelope: (
      codec: RecordCodec,
      envelope: ArtifactState<DeckContent>,
      priorFileEnvelope: DecomposedFilesEnvelope | undefined,
      carry: SlideCodecCarry | undefined,
      notesInFiles: boolean,
    ) => DecomposedFilesEnvelope;
    createSlidesFileCodec: (
      codec: RecordCodec,
      options?: { notesInFiles?: boolean },
    ) => SlidesFileCodec;
    defaultSlidesFileCodec: SlidesFileCodec;
  }
}

export function installFilesSlideCodec(runtime: RuntimeBindings): () => void {
  var optionalFileRecordString: RuntimeBindings["optionalFileRecordString"];
  var defaultSlidesFileCodec: RuntimeBindings["defaultSlidesFileCodec"];
  function composeSlidesFilesEnvelope(
    codec: RecordCodec,
    fileEnvelope: FilesEnvelope,
    carry: SlideCodecCarry | undefined,
  ): ComposedFilesEnvelope {
    let records: DocumentRecords = new Map(),
      order: SlideId[] = [];
    for (let [value2, value3] of fileEnvelope.files) {
      let value4 = (0, runtime.slideIdFromFilePath)(value2);
      if (value4 === undefined) {
        continue;
      }
      order.push(value4);
      let value5 = fileEnvelope.notes?.[value4];
      records.set(runtime.SLIDE_STORE_COLLECTION + "/" + value4, {
        html: value3,
        ...(value5 !== undefined
          ? {
              notes: value5,
            }
          : {}),
      });
    }
    for (let [value2, value3] of Object.entries(fileEnvelope.index.faces))
      records.set(runtime.FONT_STORE_COLLECTION + "/" + value2, {
        ...value3,
      });
    let index = fileEnvelope.index;
    records.set(runtime.DECK_HTML_DOCUMENT_PATH, {
      v: 3,
      title: index.title,
      order: (0, runtime.mergeSlideOrder)(index.order, order),
      ...(Object.keys(index.sections).length > 0
        ? {
            sections: index.sections,
          }
        : {}),
      ...(index.cover !== undefined
        ? {
            cover: index.cover,
          }
        : {}),
      ...((0, runtime.normalizeListRenderingMode)(index.lists) !== undefined
        ? {
            lists: (0, runtime.normalizeListRenderingMode)(index.lists),
          }
        : {}),
    });
    if (fileEnvelope.designSystems !== undefined) {
      records.set(
        runtime.DECK_ASSETS_DOCUMENT_PATH,
        fileEnvelope.designSystems as DocumentRecord,
      );
    }
    let value = codec.compose(records, carry);
    return {
      ...value,
      dangling: value.dangling.map((input) =>
        (0, runtime.slideFilePath)(
          input.slice(runtime.SLIDE_STORE_COLLECTION.length + 1),
        ),
      ),
    };
  }
  function decomposeSlidesFilesEnvelope(
    codec: RecordCodec,
    envelope: ArtifactState<DeckContent>,
    priorFileEnvelope: DecomposedFilesEnvelope | undefined,
    carry: SlideCodecCarry | undefined,
    notesInFiles: boolean,
  ): DecomposedFilesEnvelope {
    let value = codec.decompose(
        envelope,
        priorFileEnvelope?.records,
        notesInFiles
          ? {
              dangling: [],
              ...carry,
              inlineNotes: [...envelope.content.order],
            }
          : carry !== undefined
            ? {
                ...carry,
                inlineNotes: [],
              }
            : undefined,
      ),
      entries = new Map<string, string>(),
      state: Record<SlideId, string> = {},
      state2: Record<string, FontFace> = {};
    for (let [value5, value6] of value)
      if (value5.startsWith(runtime.SLIDE_STORE_COLLECTION + "/")) {
        let value7: string = value5.slice(
          runtime.SLIDE_STORE_COLLECTION.length + 1,
        );
        entries.set(
          (0, runtime.slideFilePath)(value7),
          optionalFileRecordString(value6.html) ?? "",
        );
        let value8 = optionalFileRecordString(value6.notes);
        if (value8 !== undefined) {
          state[value7] = value8;
        }
      } else if (value5.startsWith(runtime.FONT_STORE_COLLECTION + "/")) {
        let value7 = optionalFileRecordString(value6.family);
        if (value7 === undefined) {
          continue;
        }
        let value8 = optionalFileRecordString(value6.src),
          value9 = optionalFileRecordString(value6.href);
        state2[(0, runtime.fontStoreKey)(value7)] = {
          family: value7,
          ...(value9 !== undefined
            ? {
                href: value9,
              }
            : {}),
          ...(value8 !== undefined && !value8.startsWith("data:")
            ? {
                src: value8,
              }
            : {}),
        };
      }
    let value2 = value.get(runtime.DECK_HTML_DOCUMENT_PATH) ?? {},
      value3 = optionalFileRecordString(value2.cover),
      value4: Record<string, unknown> =
        typeof value2.sections === "object" &&
        value2.sections !== null &&
        !Array.isArray(value2.sections)
          ? (value2.sections as Record<string, unknown>)
          : {};
    return {
      files: entries,
      notes: state,
      records: value,
      index: {
        title: optionalFileRecordString(value2.title) ?? envelope.title,
        ...(value3 !== undefined
          ? {
              cover: value3,
            }
          : {}),
        order: Array.isArray(value2.order)
          ? value2.order.filter(
              (input): input is string => typeof input === "string",
            )
          : [],
        sections: value4,
        faces: state2,
      },
    };
  }
  function createSlidesFileCodec(
    codec: RecordCodec,
    options: { notesInFiles?: boolean } = {},
  ): SlidesFileCodec {
    return {
      indexPath: runtime.DECK_METADATA_PATH,
      slideFilePath: runtime.slideFilePath,
      slideIdOfPath: runtime.slideIdFromFilePath,
      compose: (input, options2) =>
        composeSlidesFilesEnvelope(codec, input, options2),
      decompose: (input, options2, context) =>
        decomposeSlidesFilesEnvelope(
          codec,
          input,
          options2,
          context,
          options.notesInFiles === true,
        ),
    };
  }
  bindRuntimeValue(
    runtime,
    "optionalFileRecordString",
    () => optionalFileRecordString,
    (value) => {
      optionalFileRecordString = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "composeSlidesFilesEnvelope",
    () => composeSlidesFilesEnvelope,
  );
  bindRuntimeValue(
    runtime,
    "decomposeSlidesFilesEnvelope",
    () => decomposeSlidesFilesEnvelope,
  );
  bindRuntimeValue(
    runtime,
    "createSlidesFileCodec",
    () => createSlidesFileCodec,
  );
  bindRuntimeValue(
    runtime,
    "defaultSlidesFileCodec",
    () => defaultSlidesFileCodec,
    (value) => {
      defaultSlidesFileCodec = value;
    },
  );
  return () => {
    (0, runtime.initializeSlideModel)();
    optionalFileRecordString = (input) =>
      typeof input === "string" ? input : undefined;
    defaultSlidesFileCodec = createSlidesFileCodec(runtime.slideDocumentCodec);
  };
}
