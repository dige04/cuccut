/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { DeckIndex, FontFace, SlideId } from "../deck-contracts";

/** A plain (non-array) JSON object read from deck metadata. */
export type MetadataObject = Record<string, unknown>;
/** Anything that may carry a font family name (font-face table entries). */
interface FamilyHolder {
  family?: unknown;
}
type SlideIdFromFilePath = (path: string) => SlideId | undefined;
type SlideFilePath = (slideId: SlideId) => string;
type IsMetadataObject = (value: unknown) => value is MetadataObject;
type NormalizeDeckMetadata = (metadata?: unknown) => DeckIndex;
type ReplaceDeckMetadata = (target: DeckIndex, metadata: DeckIndex) => void;
type PatchDeckMetadata = (
  target: DeckIndex,
  before: DeckIndex | undefined,
  after: DeckIndex,
) => void;
type MergeSlideOrder = (
  order: SlideId[],
  slideIds: Iterable<SlideId>,
) => SlideId[];
type ConflictingUndoMessage = (command: string) => string;

declare module "../bindings" {
  interface RuntimeBindings {
    DECK_METADATA_PATH: string;
    DECK_METADATA_VERSION: number;
    SLIDE_FILE_DIRECTORY: string;
    SLIDE_FILE_ID_PATTERN: RegExp;
    slideFilePath: SlideFilePath;
    slideIdFromFilePath: SlideIdFromFilePath;
    isMetadataObject: IsMetadataObject;
    normalizeDeckMetadata: NormalizeDeckMetadata;
    replaceDeckMetadata: ReplaceDeckMetadata;
    patchDeckMetadata: PatchDeckMetadata;
    mergeSlideOrder: MergeSlideOrder;
    conflictingUndoMessage: ConflictingUndoMessage;
  }
}

export function installModelDeckMetadata(runtime: RuntimeBindings): () => void {
  var DECK_METADATA_PATH: string;
  var DECK_METADATA_VERSION: number;
  var SLIDE_FILE_DIRECTORY: string;
  var SLIDE_FILE_ID_PATTERN: RegExp;
  var slideFilePath: SlideFilePath;
  var isMetadataObject: IsMetadataObject;
  var conflictingUndoMessage: ConflictingUndoMessage;
  function slideIdFromFilePath(path: string): SlideId | undefined {
    if (!path.startsWith("project/slides/") || !path.endsWith(".html")) {
      return;
    }
    let value = path.slice(15, -5);
    if (SLIDE_FILE_ID_PATTERN.test(value)) {
      return value;
    } else {
      return undefined;
    }
  }
  function normalizeDeckMetadata(metadata?: unknown): DeckIndex {
    let value: MetadataObject = isMetadataObject(metadata) ? metadata : {},
      state: Record<string, FontFace> = {};
    if (isMetadataObject(value.faces)) {
      for (let [value2, value3] of Object.entries(value.faces)) {
        if (!isMetadataObject(value3) || typeof value3.family !== "string") {
          continue;
        }
        let value4: string | undefined =
          typeof value3.src === "string" && !value3.src.startsWith("data:")
            ? value3.src
            : undefined;
        state[value2] = {
          family: value3.family,
          ...(typeof value3.href === "string"
            ? {
                href: value3.href,
              }
            : {}),
          ...(value4 !== undefined
            ? {
                src: value4,
              }
            : {}),
        };
      }
    }
    let items: SlideId[] = [];
    for (let value2 of (Array.isArray(value.order)
      ? value.order
      : []) as unknown[])
      if (typeof value2 === "string" && !items.includes(value2)) {
        items.push(value2);
      }
    return {
      ...value,
      v: typeof value.v === "number" ? value.v : 4,
      title: typeof value.title === "string" ? value.title : "",
      ...(typeof value.cover === "string"
        ? {
            cover: value.cover,
          }
        : {}),
      order: items,
      sections: isMetadataObject(value.sections) ? value.sections : {},
      faces: state,
      designSystems: (Array.isArray(value.designSystems)
        ? value.designSystems
        : isMetadataObject(value.designSystems)
          ? Object.values(value.designSystems)
          : []
      ).filter(isMetadataObject),
      attachments: isMetadataObject(value.attachments) ? value.attachments : {},
    };
  }
  function replaceDeckMetadata(target: DeckIndex, metadata: DeckIndex): void {
    target.v = 4;
    target.title = metadata.title;
    if (metadata.cover === undefined) {
      delete target.cover;
    } else {
      target.cover = metadata.cover;
    }
    target.order.splice(0, target.order.length, ...metadata.order);
    for (let value of ["sections", "faces"] as const) {
      let value2: MetadataObject = target[value],
        value3: MetadataObject = metadata[value];
      for (let value4 of Object.keys(value2))
        if (!Object.hasOwn(value3, value4)) {
          delete value2[value4];
        }
      for (let [value4, value5] of Object.entries(value3))
        if (JSON.stringify(value2[value4]) !== JSON.stringify(value5)) {
          value2[value4] = value5;
        }
    }
  }
  function patchDeckMetadata(
    target: DeckIndex,
    before: DeckIndex | undefined,
    after: DeckIndex,
  ): void {
    if (before === undefined) {
      return replaceDeckMetadata(target, after);
    }
    target.v = 4;
    if (before.title !== after.title) {
      target.title = after.title;
    }
    if (before.cover !== after.cover) {
      if (after.cover === undefined) {
        delete target.cover;
      } else {
        target.cover = after.cover;
      }
    }
    if (JSON.stringify(before.order) !== JSON.stringify(after.order)) {
      target.order.splice(0, target.order.length, ...after.order);
    }
    let callback = (input?: unknown): string | undefined =>
      typeof input === "object" &&
      input !== null &&
      typeof (input as FamilyHolder).family === "string"
        ? (input as { family: string }).family
            .toLowerCase()
            .replace(/ /g, "-")
        : undefined;
    for (let value of ["sections", "faces"] as const) {
      let value2: MetadataObject = target[value],
        value3: MetadataObject = before[value],
        value4: MetadataObject = after[value],
        callback2 = (input?: string, options?: string): void => {
          if (value !== "faces" || input === undefined) {
            return;
          }
          for (let value5 of Object.keys(value2))
            if (value5 !== options && callback(value2[value5]) === input) {
              delete value2[value5];
            }
        };
      for (let value5 of Object.keys(value3))
        if (!Object.hasOwn(value4, value5)) {
          delete value2[value5];
          callback2(callback(value3[value5]));
        }
      for (let [value5, value6] of Object.entries(value4))
        if (JSON.stringify(value3[value5]) !== JSON.stringify(value6)) {
          callback2(callback(value6), value5);
          callback2(callback(value3[value5]), value5);
          value2[value5] = value6;
        }
    }
  }
  function mergeSlideOrder(
    order: SlideId[],
    slideIds: Iterable<SlideId>,
  ): SlideId[] {
    let items: SlideId[] = [...order];
    for (let value of [...slideIds].sort())
      if (!items.includes(value)) {
        items.push(value);
      }
    return items;
  }
  bindRuntimeValue(
    runtime,
    "DECK_METADATA_PATH",
    () => DECK_METADATA_PATH,
    (value) => {
      DECK_METADATA_PATH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DECK_METADATA_VERSION",
    () => DECK_METADATA_VERSION,
    (value) => {
      DECK_METADATA_VERSION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SLIDE_FILE_DIRECTORY",
    () => SLIDE_FILE_DIRECTORY,
    (value) => {
      SLIDE_FILE_DIRECTORY = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SLIDE_FILE_ID_PATTERN",
    () => SLIDE_FILE_ID_PATTERN,
    (value) => {
      SLIDE_FILE_ID_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "slideFilePath",
    () => slideFilePath,
    (value) => {
      slideFilePath = value;
    },
  );
  bindRuntimeValue(runtime, "slideIdFromFilePath", () => slideIdFromFilePath);
  bindRuntimeValue(
    runtime,
    "isMetadataObject",
    () => isMetadataObject,
    (value) => {
      isMetadataObject = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeDeckMetadata",
    () => normalizeDeckMetadata,
  );
  bindRuntimeValue(runtime, "replaceDeckMetadata", () => replaceDeckMetadata);
  bindRuntimeValue(runtime, "patchDeckMetadata", () => patchDeckMetadata);
  bindRuntimeValue(runtime, "mergeSlideOrder", () => mergeSlideOrder);
  bindRuntimeValue(
    runtime,
    "conflictingUndoMessage",
    () => conflictingUndoMessage,
    (value) => {
      conflictingUndoMessage = value;
    },
  );
  return () => {
    DECK_METADATA_PATH = "project/deck.json";
    DECK_METADATA_VERSION = 4;
    SLIDE_FILE_DIRECTORY = "project/slides/";
    SLIDE_FILE_ID_PATTERN = /^[\w-]{1,64}$/;
    slideFilePath = (slideId: SlideId): string =>
      "project/slides/" + slideId + ".html";
    isMetadataObject = (value: unknown): value is MetadataObject =>
      typeof value === "object" && value !== null && !Array.isArray(value);
    conflictingUndoMessage = (command: string): string =>
      "Someone else has reordered, added, deleted or changed slides since you did that. Nothing was changed. Press " +
      command +
      " again to go ahead anyway: your change is " +
      (command === "undo" ? "undone" : "redone") +
      " around theirs.";
  };
}
