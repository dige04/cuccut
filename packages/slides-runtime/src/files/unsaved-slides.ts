/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type RuntimeBindings,
} from "../bindings";

/** Size limits of the slide stash (characters of serialized text). */
export interface SlideStashCaps {
  /** Entries kept for one artifact. */
  entries: number;
  /** One entry, key plus value. */
  entryChars: number;
  /** All entries of one artifact. */
  artifactChars: number;
  /** All entries of every artifact in the storage. */
  totalChars: number;
}

/** String storage the slide stash writes to (`localStorage`, `sessionStorage` or an adapter). */
export interface SlideStashStorage {
  readonly length: number;
  key(index: number): string | null;
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  /** Whether what is written survives closing the tab; storages without the method are taken as durable. */
  durable?(): boolean;
  /** Drops everything the storage holds for this artifact. */
  purge?(): void;
}

/** Why a slide version was kept aside instead of being discarded. */
export type KeptSlideReason = "theirs-chosen" | "mine-chosen" | "overwritten";

/** Edits to a slide that were not saved: its text and the sha the edit was based on. */
export interface UnsavedSlide {
  slideId: string;
  base: string | null;
  html: string;
  /** Last write, milliseconds since the epoch. */
  at: number;
  /** First write of this unsaved edit. */
  createdAt: number;
}

/** A slide version kept aside after a conflict was resolved or an overwrite happened. */
export interface KeptSlide {
  slideId: string;
  html: string;
  why: KeptSlideReason;
  at: number;
  createdAt: number;
}

/** Remembers unsaved and replaced slide versions so a crash or reload does not lose them. */
export interface UnsavedSlideStash {
  /** Human-readable name of where the entries live. */
  kind: string;
  /** False while the entries only exist in memory. */
  durable(): boolean;
  /** Stores the unsaved text of a slide; false when it was too big or the storage refused it. */
  write(slideId: string, base: string | null, html: string): boolean;
  read(slideId: string): UnsavedSlide | undefined;
  clear(slideId: string): void;
  /** Every unsaved slide, oldest first. */
  all(): UnsavedSlide[];
  keep(slideId: string, html: string, why: KeptSlideReason): boolean;
  readKept(slideId: string): KeptSlide | undefined;
  dropKept(slideId: string): void;
  /** Every kept slide version, oldest first. */
  kept(): KeptSlide[];
  /** Removes this artifact's entries; resolves to how many there were. */
  purge(): number;
}

export interface UnsavedSlideStashOptions {
  storage: SlideStashStorage;
  /** Identifies the artifact inside a shared storage (its path without frame scope). */
  artifactKey: string;
  kind?: string;
  now?: () => number;
  /** Entries older than this are dropped (defaults to the crash stash retention). */
  maxAgeMs?: number;
  caps?: Partial<SlideStashCaps>;
}

/** One unsaved file edit as the crash stash keeps it. */
export interface CrashStashEdit {
  path: string;
  /** New text, or `null` for a deletion. */
  text: string | null;
  /** Sha the edit was based on. */
  base: string | null;
}

/** What the slide stash needs from a crash-stash kit (IndexedDB backed, one per artifact and tab). */
export interface CrashStashKit {
  put(edits: CrashStashEdit[], version: string): Promise<boolean>;
  read(): Promise<{ edits: CrashStashEdit[] } | undefined>;
  clearOffered(): Promise<void>;
  clearArtifact(): Promise<void>;
}

/** Synchronous `SlideStashStorage` over a crash-stash kit; call `ready()` before use. */
export interface CrashStashStorageAdapter extends SlideStashStorage {
  ready(): Promise<void>;
}

/** The parsed JSON object of a stored entry. */
type StashRecord = Record<string, unknown>;

declare module "../bindings" {
  interface RuntimeBindings {
    UNSAVED_SLIDE_STASH_PREFIX: string;
    KEPT_SLIDE_STASH_PREFIX: string;
    MAX_SLIDE_STASH_ENTRIES: number;
    MAX_SLIDE_STASH_ENTRY_CHARS: number;
    MAX_SLIDE_STASH_ARTIFACT_CHARS: number;
    MAX_SLIDE_STASH_TOTAL_CHARS: number;
    isSlideStashStorageKey: (key: string) => boolean;
    createUnsavedSlideStash: (
      options: UnsavedSlideStashOptions,
    ) => UnsavedSlideStash;
    createCrashStashStorageAdapter: (
      kit: CrashStashKit,
      version: () => string,
    ) => CrashStashStorageAdapter;
    createPersistentUnsavedSlideStash: (options?: {
      kit?: CrashStashKit | null;
      version?: () => string;
      now?: () => number;
    }) => Promise<UnsavedSlideStash | undefined>;
  }
}

export function installFilesUnsavedSlides(
  runtime: RuntimeBindings,
): () => void {
  var UNSAVED_SLIDE_STASH_PREFIX: RuntimeBindings["UNSAVED_SLIDE_STASH_PREFIX"];
  var KEPT_SLIDE_STASH_PREFIX: RuntimeBindings["KEPT_SLIDE_STASH_PREFIX"];
  var MAX_SLIDE_STASH_ENTRIES: RuntimeBindings["MAX_SLIDE_STASH_ENTRIES"];
  var MAX_SLIDE_STASH_ENTRY_CHARS: RuntimeBindings["MAX_SLIDE_STASH_ENTRY_CHARS"];
  var MAX_SLIDE_STASH_ARTIFACT_CHARS: RuntimeBindings["MAX_SLIDE_STASH_ARTIFACT_CHARS"];
  var MAX_SLIDE_STASH_TOTAL_CHARS: RuntimeBindings["MAX_SLIDE_STASH_TOTAL_CHARS"];
  var isSlideStashStorageKey: RuntimeBindings["isSlideStashStorageKey"];
  function createUnsavedSlideStash(
    options: UnsavedSlideStashOptions,
  ): UnsavedSlideStash {
    let now = options.now ?? (() => Date.now()),
      unsavedPrefix = UNSAVED_SLIDE_STASH_PREFIX + options.artifactKey + "/",
      keptPrefix = KEPT_SLIDE_STASH_PREFIX + options.artifactKey + "/",
      caps: SlideStashCaps = {
        entries: MAX_SLIDE_STASH_ENTRIES,
        entryChars: MAX_SLIDE_STASH_ENTRY_CHARS,
        artifactChars: MAX_SLIDE_STASH_ARTIFACT_CHARS,
        totalChars: MAX_SLIDE_STASH_TOTAL_CHARS,
        ...options.caps,
      },
      value: number = options.maxAgeMs ?? runtime.CRASH_STASH_MAX_AGE_MS,
      callback = (input: string): string | null => {
        try {
          return options.storage.getItem(input);
        } catch {
          return null;
        }
      },
      callback2 = (input: string): void => {
        try {
          options.storage.removeItem(input);
        } catch {}
      },
      callback3 = (): string[] => {
        let items: string[] = [];
        try {
          for (let index = 0; index < options.storage.length; index++) {
            let value5 = options.storage.key(index);
            if (value5 !== null) {
              items.push(value5);
            }
          }
        } catch {}
        return items;
      },
      callback4 = (input: string): boolean =>
        input.startsWith(unsavedPrefix) || input.startsWith(keptPrefix),
      callback5 = (input: string | null): StashRecord | undefined => {
        if (input === null) {
          return;
        }
        try {
          let value5: unknown = JSON.parse(input);
          if (
            typeof value5 === "object" &&
            value5 !== null &&
            !Array.isArray(value5)
          ) {
            return value5 as StashRecord;
          } else {
            return undefined;
          }
        } catch {
          return;
        }
      },
      callback6 = (
        input: StashRecord,
      ): { at: number; createdAt: number } | undefined => {
        if (typeof input.at !== "number") {
          return;
        }
        return {
          at: input.at,
          createdAt:
            typeof input.createdAt === "number" ? input.createdAt : input.at,
        };
      },
      callback7 = (
        input: string,
        options2: string | null,
      ): UnsavedSlide | undefined => {
        let value5 = callback5(options2),
          value6 = value5 === undefined ? undefined : callback6(value5);
        if (
          value5 === undefined ||
          value6 === undefined ||
          typeof value5.html !== "string"
        ) {
          return;
        }
        return {
          slideId: input,
          base: typeof value5.base === "string" ? value5.base : null,
          html: value5.html,
          ...value6,
        };
      },
      callback8 = (
        input: string,
        options2: string | null,
      ): KeptSlide | undefined => {
        let value5 = callback5(options2),
          value6 = value5 === undefined ? undefined : callback6(value5);
        if (
          value5 === undefined ||
          value6 === undefined ||
          typeof value5.html !== "string"
        ) {
          return;
        }
        if (
          value5.why !== "theirs-chosen" &&
          value5.why !== "mine-chosen" &&
          value5.why !== "overwritten"
        ) {
          return;
        }
        return {
          slideId: input,
          html: value5.html,
          why: value5.why,
          ...value6,
        };
      },
      callback9 = (input: { createdAt: number }): boolean =>
        now() - input.createdAt > value;
    function value2(items: string, items2: string): boolean {
      let value5 = items.length + items2.length;
      if (value5 > caps.entryChars) {
        return false;
      }
      let items3: { k: string; chars: number; at: number; own: boolean }[] = [],
        index = 0,
        index2 = 0,
        index3 = 0;
      for (let value6 of callback3()) {
        if (!isSlideStashStorageKey(value6) || value6 === items) {
          continue;
        }
        let value7 = callback(value6);
        if (value7 === null) {
          continue;
        }
        let value8 = value6.length + value7.length,
          value9 = callback5(value7),
          value10 =
            value9 !== undefined && typeof value9.at === "number"
              ? value9.at
              : 0,
          value11 = callback4(value6);
        items3.push({
          k: value6,
          chars: value8,
          at: value10,
          own: value11,
        });
        index += value8;
        if (value11) {
          index2 += value8;
          index3 += 1;
        }
      }
      items3.sort((input, options2) => input.at - options2.at);
      for (let value6 of items3) {
        let value7 =
            value6.own &&
            (index3 + 1 > caps.entries || index2 + value5 > caps.artifactChars),
          value8 = index + value5 > caps.totalChars;
        if (!value7 && !value8) {
          continue;
        }
        callback2(value6.k);
        index -= value6.chars;
        if (value6.own) {
          index2 -= value6.chars;
          index3 -= 1;
        }
      }
      return (
        index3 + 1 <= caps.entries &&
        index2 + value5 <= caps.artifactChars &&
        index + value5 <= caps.totalChars
      );
    }
    function value3(input: string, options2: object): boolean {
      let value5 = JSON.stringify(options2);
      if (!value2(input, value5)) {
        return false;
      }
      try {
        options.storage.setItem(input, value5);
        return true;
      } catch {
        return false;
      }
    }
    function value4<Entry extends { createdAt: number }>(
      items: string,
      options2: (id: string, raw: string | null) => Entry | undefined,
    ): Entry[] {
      let items2: Entry[] = [];
      for (let value5 of callback3()) {
        if (!value5.startsWith(items)) {
          continue;
        }
        let value6 = options2(value5.slice(items.length), callback(value5));
        if (value6 === undefined || callback9(value6)) {
          callback2(value5);
        } else {
          items2.push(value6);
        }
      }
      return items2;
    }
    return {
      kind: options.kind ?? "storage",
      durable: () => options.storage.durable?.() ?? true,
      write(input, options2, context) {
        let value5 = unsavedPrefix + input,
          value6 = now(),
          value7 = callback7(input, callback(value5));
        return value3(value5, {
          v: 2,
          base: options2,
          html: context,
          at: value6,
          createdAt:
            value7 !== undefined && !callback9(value7)
              ? value7.createdAt
              : value6,
        });
      },
      read(input) {
        let value5 = unsavedPrefix + input,
          value6 = callback7(input, callback(value5));
        if (value6 !== undefined && callback9(value6)) {
          callback2(value5);
          return;
        }
        return value6;
      },
      clear: (input) => callback2(unsavedPrefix + input),
      all: () =>
        value4(unsavedPrefix, callback7).sort(
          (input, options2) => input.at - options2.at,
        ),
      keep(input, options2, context) {
        let value5 = now();
        return value3(keptPrefix + input, {
          v: 2,
          html: options2,
          why: context,
          at: value5,
          createdAt: value5,
        });
      },
      readKept(input) {
        let value5 = keptPrefix + input,
          value6 = callback8(input, callback(value5));
        if (value6 !== undefined && callback9(value6)) {
          callback2(value5);
          return;
        }
        return value6;
      },
      dropKept: (input) => callback2(keptPrefix + input),
      kept: () =>
        value4(keptPrefix, callback8).sort(
          (input, options2) => input.at - options2.at,
        ),
      purge() {
        let value5 = callback3().filter(callback4);
        for (let value6 of value5) callback2(value6);
        try {
          options.storage.purge?.();
        } catch {}
        return value5.length;
      },
    };
  }
  function createCrashStashStorageAdapter(
    kit: CrashStashKit,
    version: () => string,
  ): CrashStashStorageAdapter {
    let entries = new Map<string, string>(),
      entries2 = new Map<string, string>(),
      flag = false,
      value: Promise<unknown> = Promise.resolve(),
      flag2 = false,
      flag3 = true,
      callback = async (): Promise<boolean> => {
        flag3 = await kit.put(
          [...entries].map(([input, input2]) => ({
            path: input,
            text: input2,
            base: null,
          })),
          version(),
        );
        return flag3;
      },
      callback2 = (): void => {
        if (flag2) {
          return;
        }
        flag2 = true;
        queueMicrotask(() => {
          flag2 = false;
          value = value.then(callback);
        });
      },
      callback3 = (input: string): void => {
        if (!entries2.delete(input) || flag) {
          return;
        }
        flag = true;
        for (let [value2, value3] of entries2)
          if (!entries.has(value2)) {
            entries.set(value2, value3);
          }
        entries2.clear();
        value = value
          .then(callback)
          .then((input2) => (input2 ? kit.clearOffered() : undefined));
      },
      callback4 = (): string[] => [
        ...new Set([...entries.keys(), ...entries2.keys()]),
      ];
    return {
      async ready() {
        let value2 = await kit.read();
        for (let value3 of value2?.edits ?? [])
          if (value3.text !== null && !entries.has(value3.path)) {
            entries2.set(value3.path, value3.text);
          }
      },
      get length() {
        return callback4().length;
      },
      key: (input) => callback4()[input] ?? null,
      getItem: (input) => entries.get(input) ?? entries2.get(input) ?? null,
      setItem(input, options) {
        callback3(input);
        entries.set(input, options);
        callback2();
      },
      removeItem(input) {
        callback3(input);
        if (entries.delete(input)) {
          callback2();
        }
      },
      purge() {
        entries.clear();
        entries2.clear();
        value = value.then(() => kit.clearArtifact());
      },
      durable: () => flag3,
    };
  }
  async function createPersistentUnsavedSlideStash(
    options: {
      kit?: CrashStashKit | null;
      version?: () => string;
      now?: () => number;
    } = {},
  ): Promise<UnsavedSlideStash | undefined> {
    let kit: CrashStashKit | null =
      options.kit === undefined
        ? await (0, runtime.createCurrentArtifactCrashStash)("slides")
        : options.kit;
    if (kit === null) {
      return;
    }
    let storage = createCrashStashStorageAdapter(
      kit,
      options.version ?? (() => ""),
    );
    await storage.ready();
    return createUnsavedSlideStash({
      storage: storage,
      artifactKey: (0, runtime.artifactPathWithoutFrameScope)(),
      kind: "this browser (IndexedDB)",
      ...(options.now !== undefined
        ? {
            now: options.now,
          }
        : {}),
    });
  }
  bindRuntimeValue(
    runtime,
    "UNSAVED_SLIDE_STASH_PREFIX",
    () => UNSAVED_SLIDE_STASH_PREFIX,
    (value) => {
      UNSAVED_SLIDE_STASH_PREFIX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "KEPT_SLIDE_STASH_PREFIX",
    () => KEPT_SLIDE_STASH_PREFIX,
    (value) => {
      KEPT_SLIDE_STASH_PREFIX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_SLIDE_STASH_ENTRIES",
    () => MAX_SLIDE_STASH_ENTRIES,
    (value) => {
      MAX_SLIDE_STASH_ENTRIES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_SLIDE_STASH_ENTRY_CHARS",
    () => MAX_SLIDE_STASH_ENTRY_CHARS,
    (value) => {
      MAX_SLIDE_STASH_ENTRY_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_SLIDE_STASH_ARTIFACT_CHARS",
    () => MAX_SLIDE_STASH_ARTIFACT_CHARS,
    (value) => {
      MAX_SLIDE_STASH_ARTIFACT_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_SLIDE_STASH_TOTAL_CHARS",
    () => MAX_SLIDE_STASH_TOTAL_CHARS,
    (value) => {
      MAX_SLIDE_STASH_TOTAL_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isSlideStashStorageKey",
    () => isSlideStashStorageKey,
    (value) => {
      isSlideStashStorageKey = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createUnsavedSlideStash",
    () => createUnsavedSlideStash,
  );
  bindRuntimeValue(
    runtime,
    "createCrashStashStorageAdapter",
    () => createCrashStashStorageAdapter,
  );
  bindRuntimeValue(
    runtime,
    "createPersistentUnsavedSlideStash",
    () => createPersistentUnsavedSlideStash,
  );
  return () => {
    UNSAVED_SLIDE_STASH_PREFIX = "slides-unsaved/";
    KEPT_SLIDE_STASH_PREFIX = "slides-kept/";
    MAX_SLIDE_STASH_ENTRIES = runtime.CRASH_STASH_MAX_ENTRIES;
    MAX_SLIDE_STASH_ENTRY_CHARS = 262144;
    MAX_SLIDE_STASH_ARTIFACT_CHARS = runtime.CRASH_STASH_MAX_ARTIFACT_CHARS;
    MAX_SLIDE_STASH_TOTAL_CHARS = runtime.CRASH_STASH_MAX_TOTAL_CHARS;
    isSlideStashStorageKey = (key) =>
      key.startsWith(UNSAVED_SLIDE_STASH_PREFIX) ||
      key.startsWith(KEPT_SLIDE_STASH_PREFIX);
  };
}
