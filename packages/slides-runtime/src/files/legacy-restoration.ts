/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type { PublishResult } from "../deck-contracts";
import type {
  LegacyDatabaseDocument,
  LegacyDocData,
} from "./legacy-database";
import type { FileListing } from "./read-retries";

/** One record of the legacy document store: its path (`slides/<id>`, `fonts/<name>`) and a copy of its data. */
export type LegacyStoreRecord = LegacyDatabaseDocument;

/** The legacy store as the restore reads it. */
export interface LegacyRestoreStore {
  get(path: string): Promise<LegacyStoreRecord | null>;
  list(collection: string): Promise<LegacyStoreRecord[]>;
}

/** The files port as the restore uses it: list what exists, then create the missing files. */
export interface LegacyRestoreFilesPort {
  readonly canWrite?: boolean;
  list(): Promise<readonly { path: string }[]>;
  publish(
    files: Record<string, string>,
    options: { ifMatch: Record<string, null> },
  ): Promise<PublishResult>;
}

export interface LegacyStoreRestoreOptions {
  files: LegacyRestoreFilesPort;
  /** Opens the legacy store; resolves `null` when this view has none. */
  store: () => Promise<LegacyRestoreStore | null>;
  /** Waits for the given milliseconds (tests inject their own). */
  wait?: (ms: number) => Promise<unknown>;
}

/** Why the restore did nothing. */
export type LegacyRestoreIdleReason =
  | "files-present"
  | "cannot-publish"
  | "store-slow"
  | "store-unreadable"
  | "store-empty";

/** What the restore of an old store-backed deck into files came to. */
export type LegacyRestoreOutcome =
  | { did: "nothing"; why: LegacyRestoreIdleReason }
  | { did: "failed"; why: string; slidesInStore: boolean }
  | { did: "restored"; slides: number; kept: number }
  | { did: "lost-the-race" };

/**
 * The fields of an outcome the policy looks at. Any object naming what the restore did is
 * accepted (a hand-written outcome is `{did: string; why: string}` once inferred), so this is wider than the union.
 */
export interface LegacyRestoreOutcomeFields {
  did: string;
  why?: string;
  slidesInStore?: boolean;
  slides?: number;
  kept?: number;
}

/** What to do after a restore, and what to tell the console. */
export interface LegacyRestorePolicy {
  /** `seal` keeps the deck closed for editing; `open` goes on booting. */
  then: "seal" | "open";
  say?: { level: "warn" | "info"; text: string };
}

/** Slide files (`[path, html]`) and the index file (JSON text) rebuilt from the store. */
export interface LegacyStoreComposition {
  slideFiles: [string, string][];
  index: string;
}

/** What the restore learned about the store so far. */
export interface LegacyRestoreState {
  /** True once slides are known to exist in the store. */
  known: boolean;
}

declare module "../bindings" {
  interface RuntimeBindings {
    LEGACY_STORE_SLIDE_ID_PATTERN: RegExp;
    MAX_LEGACY_RESTORE_SLIDES: number;
    MAX_LEGACY_RESTORE_FILE_BYTES: number;
    LEGACY_RESTORE_FALLBACK_TIMESTAMP: string;
    optionalLegacyStoreString: (input: unknown) => string | undefined;
    isLegacyStoreRecord: (input: unknown) => input is Record<string, unknown>;
    escapeRestoredSpeakerNotesHtml: (input: string) => string;
    /** UTF-8 byte length of a file's text. */
    createdOnFilesIndexMarker: (input: string) => number;
    LEGACY_RESTORE_TIMEOUT_MS: number;
    noFileListingError: Error;
    mapMissingFileListingError: <T>(listing: Promise<T>) => Promise<T>;
    insertRestoredSpeakerNotes: (
      html: string,
      notes: string | undefined,
    ) => string;
    composeLegacyStoreSlides: (
      index: LegacyDocData,
      records: readonly LegacyStoreRecord[],
      notes: readonly LegacyStoreRecord[],
    ) => LegacyStoreComposition;
    retryMissingFileListing: <T>(
      list: () => Promise<T>,
      wait?: (ms: number) => Promise<unknown>,
    ) => () => Promise<T>;
    seedFilesPortListing: <Port extends object>(
      port: Port,
      initialListing: FileListing,
    ) => Port;
    legacyStoreRestorePolicy: (
      outcome: LegacyRestoreOutcomeFields,
    ) => LegacyRestorePolicy;
    restoreLegacyStoreToFiles: (
      options: LegacyStoreRestoreOptions,
    ) => Promise<LegacyRestoreOutcome>;
    performLegacyStoreRestore: (
      options: LegacyStoreRestoreOptions,
      state: LegacyRestoreState,
    ) => Promise<LegacyRestoreOutcome>;
  }
}

export function installFilesLegacyRestoration(
  runtime: RuntimeBindings,
): () => void {
  var LEGACY_STORE_SLIDE_ID_PATTERN: RuntimeBindings["LEGACY_STORE_SLIDE_ID_PATTERN"];
  var MAX_LEGACY_RESTORE_SLIDES: RuntimeBindings["MAX_LEGACY_RESTORE_SLIDES"];
  var MAX_LEGACY_RESTORE_FILE_BYTES: RuntimeBindings["MAX_LEGACY_RESTORE_FILE_BYTES"];
  var LEGACY_RESTORE_FALLBACK_TIMESTAMP: RuntimeBindings["LEGACY_RESTORE_FALLBACK_TIMESTAMP"];
  var optionalLegacyStoreString: RuntimeBindings["optionalLegacyStoreString"];
  var isLegacyStoreRecord: RuntimeBindings["isLegacyStoreRecord"];
  var escapeRestoredSpeakerNotesHtml: RuntimeBindings["escapeRestoredSpeakerNotesHtml"];
  var createdOnFilesIndexMarker: RuntimeBindings["createdOnFilesIndexMarker"];
  var LEGACY_RESTORE_TIMEOUT_MS: RuntimeBindings["LEGACY_RESTORE_TIMEOUT_MS"];
  var noFileListingError: RuntimeBindings["noFileListingError"];
  var mapMissingFileListingError: RuntimeBindings["mapMissingFileListingError"];
  function insertRestoredSpeakerNotes(
    html: string,
    notes: string | undefined,
  ): string {
    if (notes === undefined) {
      return html;
    }
    let sectionClose =
      [...html.matchAll(/<\/section\s*>/gi)].pop()?.index ?? -1;
    if (sectionClose < 0) {
      return html;
    }
    let beforeClose = html.slice(0, sectionClose),
      asideStart =
        [...beforeClose.matchAll(/<aside\b/gi)].pop()?.index ?? -1;
    if (
      asideStart >= 0 &&
      /^<aside\b[^>]*>[\s\S]*<\/aside>\s*$/i.test(beforeClose.slice(asideStart))
    ) {
      beforeClose = beforeClose.slice(0, asideStart).replace(/\s+$/, "");
    }
    return (
      beforeClose +
      (notes === ""
        ? ""
        : "<aside>" + escapeRestoredSpeakerNotesHtml(notes) + "</aside>") +
      html.slice(sectionClose)
    );
  }
  function composeLegacyStoreSlides(
    index: LegacyDocData,
    records: readonly LegacyStoreRecord[],
    notes: readonly LegacyStoreRecord[],
  ): LegacyStoreComposition {
    let byId = new Map<string, LegacyDocData>(
        records.map((input): [string, LegacyDocData] => [
          input.path.slice(input.path.indexOf("/") + 1),
          input.data,
        ]),
      ),
      order: string[] = [],
      missingIds: [string, string][] = [];
    for (let value2 of (Array.isArray(index.order)
      ? index.order
      : []) as unknown[]) {
      if (
        typeof value2 !== "string" ||
        !LEGACY_STORE_SLIDE_ID_PATTERN.test(value2) ||
        order.includes(value2)
      ) {
        continue;
      }
      let entry = byId.get(value2);
      if (entry === undefined) {
        continue;
      }
      let value3 =
        optionalLegacyStoreString(entry.html) ??
        '<section id="' + value2 + '"></section>';
      order.push(value2);
      let value4 = insertRestoredSpeakerNotes(
        value3,
        optionalLegacyStoreString(entry.notes),
      );
      if (
        (optionalLegacyStoreString(entry.notes) ?? "") !== "" &&
        value4 === value3
      ) {
        console.warn(
          'slides: restore from the store: the notes of slide "' +
            value2 +
            '" could not be placed (its html has no closing </section>); they stay in the store',
        );
      }
      missingIds.push([(0, runtime.slideFilePath)(value2), value4]);
    }
    let state: Record<string, { family: string; href?: unknown; src?: string }> =
      {};
    for (let value2 of [...notes].sort((input, options) =>
      input.path < options.path ? -1 : 1,
    )) {
      let value3 = optionalLegacyStoreString(value2.data.family),
        value4 = optionalLegacyStoreString(value2.data.src);
      if (value3 === undefined) {
        continue;
      }
      if (optionalLegacyStoreString(value2.data.href) !== undefined) {
        state[value2.path.slice(value2.path.indexOf("/") + 1)] = {
          family: value3,
          href: value2.data.href,
        };
      } else if (value4 !== undefined && !value4.startsWith("data:")) {
        state[value2.path.slice(value2.path.indexOf("/") + 1)] = {
          family: value3,
          src: value4,
        };
      }
    }
    let value = optionalLegacyStoreString(index.cover),
      state2 = {
        v: runtime.DECK_METADATA_VERSION,
        createdOnFiles: (0, runtime.createdOnFilesMarker)({
          at: LEGACY_RESTORE_FALLBACK_TIMESTAMP,
        }),
        title: optionalLegacyStoreString(index.title) ?? "",
        ...(value !== undefined && order.includes(value)
          ? {
              cover: value,
            }
          : {}),
        order: order,
        sections: isLegacyStoreRecord(index.sections) ? index.sections : {},
        faces: state,
        designSystems: [],
        attachments: {},
      };
    return {
      slideFiles: missingIds,
      index:
        JSON.stringify(state2, null, 2) +
        `
`,
    };
  }
  function retryMissingFileListing<T>(
    list: () => Promise<T>,
    wait: (ms: number) => Promise<unknown> = (input: number): Promise<void> =>
      new Promise((input2): unknown => setTimeout(input2, input)),
  ): () => Promise<T> {
    return (): Promise<T> =>
      list().catch(async (input: unknown): Promise<T> => {
        if (input !== noFileListingError) {
          throw input;
        }
        await wait(1500);
        return list();
      });
  }
  function seedFilesPortListing<Port extends object>(
    port: Port,
    initialListing: FileListing,
  ): Port {
    let usedInitial = false;
    return new Proxy(port, {
      get: (input: Port, options: string | symbol, context: unknown): unknown =>
        options === "list" && !usedInitial
          ? (): Promise<FileListing> => {
              usedInitial = true;
              return Promise.resolve(initialListing);
            }
          : Reflect.get(input, options, context),
    });
  }
  function legacyStoreRestorePolicy(
    outcome: LegacyRestoreOutcomeFields,
  ): LegacyRestorePolicy {
    if (outcome.did === "failed") {
      if (outcome.slidesInStore) {
        return {
          then: "seal",
          say: {
            level: "warn",
            text:
              "slides: restore from the store failed: " +
              outcome.why +
              "; slides may still be in the store; the deck was not opened for editing so nothing is overwritten; the store was not changed; reload to try again",
          },
        };
      }
      if (outcome.why!.endsWith("no file listing")) {
        return {
          then: "open",
          say: {
            level: "info",
            text: "slides: restore from the store: not tried: this page has no file listing",
          },
        };
      }
      return {
        then: "open",
        say: {
          level: "warn",
          text:
            "slides: restore from the store failed: " +
            outcome.why +
            ". The store was not changed. Reload to try again.",
        },
      };
    }
    if (outcome.did === "nothing") {
      if (outcome.why === "cannot-publish") {
        return {
          then: "open",
          say: {
            level: "info",
            text: "slides: restore from the store: not tried: this viewer cannot publish",
          },
        };
      }
      if (outcome.why === "store-unreadable") {
        return {
          then: "open",
          say: {
            level: "info",
            text: "slides: restore from the store: not tried: this view has no store",
          },
        };
      }
      return {
        then: "open",
      };
    }
    return {
      then: "open",
      say: {
        level: "info",
        text: "slides: restore from the store: " + JSON.stringify(outcome),
      },
    };
  }
  async function restoreLegacyStoreToFiles(
    options: LegacyStoreRestoreOptions,
  ): Promise<LegacyRestoreOutcome> {
    let state: LegacyRestoreState = {
      known: false,
    };
    try {
      return await performLegacyStoreRestore(options, state);
    } catch (value: unknown) {
      return {
        did: "failed",
        why:
          "stopped by an error: " +
          ((value as { message?: string } | null | undefined)?.message ??
            String(value)),
        slidesInStore: state.known,
      };
    }
  }
  async function performLegacyStoreRestore(
    options: LegacyStoreRestoreOptions,
    state: LegacyRestoreState,
  ): Promise<LegacyRestoreOutcome> {
    let listing = await options.files.list();
    if (listing.some((input) => input.path === runtime.DECK_METADATA_PATH)) {
      return {
        did: "nothing",
        why: "files-present",
      };
    }
    if (!options.files.canWrite) {
      return {
        did: "nothing",
        why: "cannot-publish",
      };
    }
    state.known = listing.some(
      (input) => (0, runtime.slideIdFromFilePath)(input.path) !== undefined,
    );
    let items: LegacyStoreRecord[] = [],
      items2: LegacyStoreRecord[] = [],
      value: (ms: number) => Promise<unknown> =
        options.wait ??
        ((input: number): Promise<void> =>
          new Promise((input2): unknown => setTimeout(input2, input))),
      value2 = await Promise.race([
        (async (): Promise<{
          store: LegacyRestoreStore;
          meta: LegacyDocData | undefined;
        } | null> => {
          let value5 = await options.store();
          if (value5 === null) {
            return null;
          } else {
            return {
              store: value5,
              meta: (await value5.get("deck/meta"))?.data,
            };
          }
        })(),
        value(LEGACY_RESTORE_TIMEOUT_MS).then((): "late" => "late"),
      ]);
    if (value2 === "late") {
      if (state.known) {
        return {
          did: "failed",
          why: "the store did not answer in time",
          slidesInStore: true,
        };
      } else {
        return {
          did: "nothing",
          why: "store-slow",
        };
      }
    }
    if (value2 === null) {
      if (state.known) {
        return {
          did: "failed",
          why: "this view has no store right now",
          slidesInStore: true,
        };
      } else {
        return {
          did: "nothing",
          why: "store-unreadable",
        };
      }
    }
    let meta = value2.meta;
    if (
      meta === undefined ||
      !Array.isArray(meta.order) ||
      meta.order.length === 0
    ) {
      return {
        did: "nothing",
        why: "store-empty",
      };
    }
    state.known = true;
    items = await value2.store.list("slides");
    let values = new Set(items.map((input) => input.path));
    for (let value5 of meta.order as unknown[]) {
      if (
        typeof value5 !== "string" ||
        !LEGACY_STORE_SLIDE_ID_PATTERN.test(value5) ||
        values.has("slides/" + value5)
      ) {
        continue;
      }
      values.add("slides/" + value5);
      let value6 = await value2.store.get("slides/" + value5);
      if (value6 !== null) {
        items.push({
          path: "slides/" + value5,
          data: value6.data,
        });
      }
    }
    items2 = await value2.store
      .list("fonts")
      .catch((): LegacyStoreRecord[] => []);
    let { slideFiles: slideFiles, index: index } = composeLegacyStoreSlides(
      meta,
      items,
      items2,
    );
    if (slideFiles.length === 0) {
      return {
        did: "nothing",
        why: "store-empty",
      };
    }
    let values2 = new Set(listing.map((input) => input.path)),
      value3 = slideFiles.filter(([input]) => !values2.has(input)),
      value4 = slideFiles.length - value3.length,
      callback = (input: [string, string][]): Record<string, string>[] => {
        let items3: Record<string, string>[] = [{}],
          index2 = 0;
        for (let [value5, value6] of input) {
          let value7 = items3[items3.length - 1]!;
          if (
            Object.keys(value7).length >= MAX_LEGACY_RESTORE_SLIDES ||
            (index2 + createdOnFilesIndexMarker(value6) >
              MAX_LEGACY_RESTORE_FILE_BYTES &&
              Object.keys(value7).length > 0)
          ) {
            items3.push({});
            index2 = 0;
          }
          items3[items3.length - 1]![value5] = value6;
          index2 += createdOnFilesIndexMarker(value6);
        }
        return [
          ...items3.filter((input2) => Object.keys(input2).length > 0),
          {
            [runtime.DECK_METADATA_PATH]: index,
          },
        ];
      };
    for (let index2 = 0; index2 < 2; index2++) {
      let value5: Set<string> | undefined;
      for (let value7 of callback(value3)) {
        let value8 = await options.files.publish(value7, {
          ifMatch: Object.fromEntries(
            Object.keys(value7).map((input): [string, null] => [input, null]),
          ),
        });
        if (value8.ok) {
          if (value8.preconditionsChecked !== true) {
            if (runtime.DECK_METADATA_PATH in value7) {
              return {
                did: "restored",
                slides: slideFiles.length - value4,
                kept: value4,
              };
            }
            return {
              did: "failed",
              why: 'the host did not say it compared "must not exist yet"; stopped before the index',
              slidesInStore: state.known,
            };
          }
          value3 = value3.filter(([input]) => !(input in value7));
          continue;
        }
        if (value8.code !== "conflict") {
          return {
            did: "failed",
            why: "a save was refused: " + value8.code,
            slidesInStore: state.known,
          };
        }
        value5 = new Set(
          value8.paths !== undefined && value8.paths.length > 0
            ? value8.paths.map((input) => input.path)
            : (await options.files.list()).map((input) => input.path),
        );
        break;
      }
      if (value5 === undefined) {
        return {
          did: "restored",
          slides: slideFiles.length - value4,
          kept: value4,
        };
      }
      if (value5.has(runtime.DECK_METADATA_PATH)) {
        return {
          did: "lost-the-race",
        };
      }
      if (index2 === 1) {
        return {
          did: "failed",
          why: "after one second pass some slide files still could not be created (others keep appearing)",
          slidesInStore: state.known,
        };
      }
      let value6 = value5;
      value4 += value3.filter(([input]) => value6.has(input)).length;
      value3 = value3.filter(([input]) => !value6.has(input));
    }
    return {
      did: "failed",
      why: "not reached",
      slidesInStore: state.known,
    };
  }
  bindRuntimeValue(
    runtime,
    "LEGACY_STORE_SLIDE_ID_PATTERN",
    () => LEGACY_STORE_SLIDE_ID_PATTERN,
    (value) => {
      LEGACY_STORE_SLIDE_ID_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_LEGACY_RESTORE_SLIDES",
    () => MAX_LEGACY_RESTORE_SLIDES,
    (value) => {
      MAX_LEGACY_RESTORE_SLIDES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_LEGACY_RESTORE_FILE_BYTES",
    () => MAX_LEGACY_RESTORE_FILE_BYTES,
    (value) => {
      MAX_LEGACY_RESTORE_FILE_BYTES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LEGACY_RESTORE_FALLBACK_TIMESTAMP",
    () => LEGACY_RESTORE_FALLBACK_TIMESTAMP,
    (value) => {
      LEGACY_RESTORE_FALLBACK_TIMESTAMP = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "optionalLegacyStoreString",
    () => optionalLegacyStoreString,
    (value) => {
      optionalLegacyStoreString = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isLegacyStoreRecord",
    () => isLegacyStoreRecord,
    (value) => {
      isLegacyStoreRecord = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "escapeRestoredSpeakerNotesHtml",
    () => escapeRestoredSpeakerNotesHtml,
    (value) => {
      escapeRestoredSpeakerNotesHtml = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createdOnFilesIndexMarker",
    () => createdOnFilesIndexMarker,
    (value) => {
      createdOnFilesIndexMarker = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "insertRestoredSpeakerNotes",
    () => insertRestoredSpeakerNotes,
  );
  bindRuntimeValue(
    runtime,
    "composeLegacyStoreSlides",
    () => composeLegacyStoreSlides,
  );
  bindRuntimeValue(
    runtime,
    "LEGACY_RESTORE_TIMEOUT_MS",
    () => LEGACY_RESTORE_TIMEOUT_MS,
    (value) => {
      LEGACY_RESTORE_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "noFileListingError",
    () => noFileListingError,
    (value) => {
      noFileListingError = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "mapMissingFileListingError",
    () => mapMissingFileListingError,
    (value) => {
      mapMissingFileListingError = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "retryMissingFileListing",
    () => retryMissingFileListing,
  );
  bindRuntimeValue(runtime, "seedFilesPortListing", () => seedFilesPortListing);
  bindRuntimeValue(
    runtime,
    "legacyStoreRestorePolicy",
    () => legacyStoreRestorePolicy,
  );
  bindRuntimeValue(
    runtime,
    "restoreLegacyStoreToFiles",
    () => restoreLegacyStoreToFiles,
  );
  bindRuntimeValue(
    runtime,
    "performLegacyStoreRestore",
    () => performLegacyStoreRestore,
  );
  return () => {
    LEGACY_STORE_SLIDE_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
    MAX_LEGACY_RESTORE_SLIDES = 255;
    MAX_LEGACY_RESTORE_FILE_BYTES = 12582912;
    LEGACY_RESTORE_FALLBACK_TIMESTAMP = "2026-09-15T00:00:00Z";
    optionalLegacyStoreString = (input: unknown): string | undefined =>
      typeof input === "string" ? input : undefined;
    isLegacyStoreRecord = (
      input: unknown,
    ): input is Record<string, unknown> =>
      typeof input === "object" && input !== null && !Array.isArray(input);
    escapeRestoredSpeakerNotesHtml = (input: string): string =>
      input
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\t/g, " ")
        .replace(/ {2}/g, " &nbsp;")
        .replace(/\r?\n/g, "<br>");
    createdOnFilesIndexMarker = (input: string): number =>
      new TextEncoder().encode(input).length;
    LEGACY_RESTORE_TIMEOUT_MS = 8000;
    noFileListingError = Error("no file listing");
    mapMissingFileListingError = <T>(input: Promise<T>): Promise<T> =>
      input.catch((input2: unknown): never => {
        throw (input2 as { status?: unknown } | null | undefined)?.status ===
          404
          ? noFileListingError
          : input2;
      });
  };
}
