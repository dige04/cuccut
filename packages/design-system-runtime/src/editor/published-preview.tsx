import type * as React from "react";
import type * as Editor from "../contracts/editor-runtime";
import type * as Model from "../contracts";
import type * as Application from "../contracts/application";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installEditorPublishedPreview(
  runtime: RuntimeBindings,
): () => void {
  var reactPublishedPreview: typeof import("react");
  var FILES_LISTING_NAME: string;
  var FILES_LISTING_TIMEOUT_MS: number;
  var FILES_LISTING_RETRY_MS: number;
  var FILES_LISTING_EXHAUSTED_RETRY_MS: number;
  var FILES_LISTING_MAX_ATTEMPTS: number;
  var ADDRESSED_VERSION_PATH_PATTERN: RegExp;
  var FILE_SHA256_PATTERNEditorPublishedPreview: RegExp;
  var addressedVersionFromPage: () => string;
  var fetchProjectFilesListing: () => Promise<unknown>;
  var publishedFilesRegistry: Editor.PublishedFilesRegistry;
  var addressedFileEntry: (
    path: string,
  ) => Model.PublishedFileFacts | null | undefined;
  var subscribeAddressedFileEntries: (listener: () => void) => () => void;
  var PREVIEW_FILE_MIME_PREDICATES: Record<
    Editor.PublishedFileKind,
    (mime: string) => boolean
  >;
  var PUBLISHED_FILE_ADDRESS_ROOT_PATTERN: RegExp;
  var MAX_PUBLISHED_LISTING_FAILURES: number;
  var sha256Integrity: (hexDigest: string) => string;
  var publishedPreviewCache: Editor.PublishedPreviewCache;
  var publishedPreviewUrl: (
    path: string,
    contents: string,
    kind: Editor.PublishedFileKind,
  ) => Model.PublishedFileReference | undefined;
  var notePublishedPreviewFailure: (
    url: string,
    label: string | undefined,
    timeoutSeconds?: string | number,
  ) => void;
  var isPublishedPreviewStillOffered: (url: string) => boolean;
  var SAVE_STATES_WITH_CURRENT_ADDRESSES: Record<
    Application.ApplicationSaveState["status"],
    boolean
  >;
  var subscribePublishedPreviewCache: (listener: () => void) => () => void;
  var publishedPreviewGeneration: () => number;
  function createPublishedFilesRegistry(
    options: Editor.PublishedRegistryOptions = {},
  ): Editor.PublishedFilesRegistry {
    let fetchListing = options.fetchListing ?? fetchProjectFilesListing,
      addressedVersion = options.addressedVersion ?? addressedVersionFromPage,
      now = options.now ?? ((): number => Date.now()),
      heldListing: Editor.PublishedListing | undefined,
      fetching: boolean = false,
      retryStates = new Map<string, Editor.ListingRetryState>(),
      subscribers = new Set<() => void>(),
      notify = (): void => {
        for (let value of [...subscribers]) {
          try {
            value();
          } catch {}
        }
      };
    async function refreshListing(): Promise<void> {
      let value = addressedVersion(),
        callback = (input: boolean = false): void => {
          let value2 = (retryStates.get(value)?.tries ?? 0) + 1;
          retryStates.set(value, {
            tries: value2,
            narrowed: input,
            until: input
              ? Number.POSITIVE_INFINITY
              : now() +
                (value2 >= FILES_LISTING_MAX_ATTEMPTS
                  ? FILES_LISTING_EXHAUSTED_RETRY_MS
                  : FILES_LISTING_RETRY_MS),
          });
        },
        flag: boolean = false;
      try {
        let value2 = (await fetchListing()) as
            | Editor.PublishedListingWire
            | null
            | undefined,
          value3 = addressedVersion(),
          value4 = value2?.files;
        if (value3 !== value) {
        } else if (
          value3 === "" ||
          value2?.ver !== value3 ||
          value4 === null ||
          typeof value4 !== "object" ||
          Array.isArray(value4)
        ) {
          callback();
        } else if (value2!.narrowed === true) {
          heldListing = undefined;
          callback(true);
        } else {
          let entries = new Map<string, Model.PublishedFileFacts>(),
            flag2: boolean = true;
          for (let [value5, value6] of Object.entries(
            value4 as Record<
              string,
              Editor.PublishedFileWire | undefined | null
            >,
          )) {
            if (
              !value5.startsWith(runtime.PROJECT_FILE_PREFIXEditorFilesIndex)
            ) {
              continue;
            }
            if (
              typeof value6?.sha256 === "string" &&
              FILE_SHA256_PATTERNEditorPublishedPreview.test(value6.sha256) &&
              typeof value6.size === "number" &&
              value6.size >= 0 &&
              typeof value6.contentType === "string" &&
              value6.contentType !== ""
            ) {
              entries.set(value5, {
                sha256: value6.sha256,
                size: value6.size,
                contentType: value6.contentType,
              });
            } else {
              flag2 = false;
            }
          }
          heldListing = {
            version: value3,
            facts: entries,
            complete: flag2,
          };
          retryStates.delete(value3);
          flag = true;
        }
      } catch {
        callback();
      } finally {
        fetching = false;
      }
      if (flag || addressedVersion() !== value) {
        notify();
      }
    }
    return {
      addressedFile(input: string) {
        let value = addressedVersion();
        if (
          value === "" ||
          !input.startsWith(runtime.PROJECT_FILE_PREFIXEditorFilesIndex)
        ) {
          return;
        }
        if (heldListing?.version !== value) {
          if (!fetching && now() >= (retryStates.get(value)?.until ?? 0)) {
            fetching = true;
            queueMicrotask(() => void refreshListing());
          }
          return;
        }
        return (
          heldListing.facts.get(input) ??
          (heldListing.complete ? null : undefined)
        );
      },
      addressedSettled(): string | boolean {
        let value = addressedVersion();
        if (value === "") {
          return "no-version";
        }
        if (heldListing?.version === value) {
          return "held";
        }
        let entry = retryStates.get(value);
        if (entry === undefined) {
          return false;
        } else {
          if (entry.narrowed) {
            return "narrowed";
          } else {
            if (entry.tries >= FILES_LISTING_MAX_ATTEMPTS) {
              return "tries";
            } else {
              return false;
            }
          }
        }
      },
      onAddressedChange(input: () => void) {
        subscribers.add(input);
        return () => void subscribers.delete(input);
      },
    };
  }
  function hasAddressDependentPreviewCode(
    contents: string,
    kind: Editor.PublishedFileKind,
  ): boolean {
    if (kind === "script") {
      return /\bimport\s*(?:\(|\.\s*meta)|currentScript/.test(contents);
    }
    if (kind !== "style") {
      return false;
    }
    if (/@import|@charset|image-set\(|\bsrc\(/i.test(contents)) {
      return true;
    }
    for (let value of contents.matchAll(
      /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)"'\s]*))/gi,
    )) {
      let value2 = (value[1] ?? value[2] ?? value[3] ?? "").trim();
      if (value2 !== "" && !/^(?:data:|https?:|\/)/i.test(value2)) {
        return true;
      }
    }
    return false;
  }
  function publishedFileBytes(
    contents: string,
    kind: Editor.PublishedFileKind,
  ): string | Uint8Array | null {
    if (kind !== "font") {
      return contents;
    }
    let value = (0, runtime.parseDataUriHeader)(contents);
    if (value === null || !value.base64) {
      return null;
    }
    try {
      let value2 = atob(contents.slice(value.payloadOffset)),
        value3 = new Uint8Array(value2.length);
      for (let index: number = 0; index < value2.length; index++) {
        value3[index] = value2.charCodeAt(index);
      }
      return value3;
    } catch {
      return null;
    }
  }
  function createPublishedPreviewCache(
    options: Editor.PublishedPreviewCacheOptions = {},
  ): Editor.PublishedPreviewCache {
    let enabled =
        options.enabled ??
        (() => (0, runtime.isPreviewRunnerEnabled)(globalThis)),
      addressedFile = options.addressedFile ?? addressedFileEntry,
      baseURI = options.baseURI ?? (() => globalThis.document?.baseURI ?? ""),
      hash = options.hash ?? runtime.sha256,
      setTimer =
        options.setTimer ??
        ((input: () => void, options2: number) => setTimeout(input, options2)),
      warn = options.warn ?? ((input: string) => console.warn(input)),
      info = options.info ?? ((input: string) => console.info(input)),
      fileHashCache = new Map<string, Editor.PreviewHashEntry>(),
      failedAddressRoots = new Set<string>(),
      unusableAddressRoots = new Set<string>(),
      subscribers = new Set<() => void>(),
      urlCache = {
        base: "",
        urls: new Map<string, string | undefined>(),
      },
      pendingHashes = 0,
      generation = 0,
      listingFailures = 0,
      listingCooldown: boolean = false,
      lastAddressRoot = "",
      notify = (): void => {
        generation += 1;
        for (let value of [...subscribers]) {
          value();
        }
      };
    (options.onAddressedChange ?? subscribeAddressedFileEntries)((): void => {
      listingFailures = 0;
      unusableAddressRoots.clear();
      notify();
    });
    let addressRoot = (input: string) =>
        PUBLISHED_FILE_ADDRESS_ROOT_PATTERN.exec(input)?.[1] ?? "",
      currentAddressRoot = () => {
        try {
          return addressRoot(new URL(baseURI()).pathname);
        } catch {
          return "";
        }
      };
    function noteUnusableListing(input: string) {
      if (input !== lastAddressRoot) {
        lastAddressRoot = input;
        listingFailures = 0;
      }
      if (listingCooldown) {
        return;
      }
      if (listingFailures >= MAX_PUBLISHED_LISTING_FAILURES) {
        info(
          "design-system: the list of this version’s published files could not be used on this page, so previews use the page’s own copies of the system’s files. Nothing is lost.",
        );
        return void unusableAddressRoots.add(input);
      }
      listingCooldown = true;
      setTimer(
        (): void => {
          listingCooldown = false;
          notify();
        },
        (FILES_LISTING_RETRY_MS + 1000) * 2 ** listingFailures,
      );
      listingFailures += 1;
    }
    function hashContents(
      input: string,
      options2: string,
      context: Editor.PublishedFileKind,
    ) {
      let entry = fileHashCache.get(input);
      if (entry === undefined || entry.value !== options2) {
        let state: Editor.PreviewHashEntry = {
          value: options2,
          stays:
            (context === "font" &&
              (0, runtime.parseDataUriHeader)(options2)?.base64 !== true) ||
            hasAddressDependentPreviewCode(options2, context),
        };
        fileHashCache.set(input, (entry = state));
        if (!state.stays) {
          pendingHashes += 1;
          let callback = (input2?: string): void => {
            if (input2 !== undefined) {
              state.sha = input2;
            }
            pendingHashes -= 1;
            if (pendingHashes === 0) {
              notify();
            }
          };
          Promise.resolve()
            .then(() => publishedFileBytes(options2, context))
            .then((input2) => (input2 === null ? undefined : hash(input2)))
            .then(callback, () => callback());
        }
      }
      if (entry.stays) {
        return undefined;
      } else {
        return entry.sha;
      }
    }
    function publishedFileAddress(input: string) {
      let value = baseURI();
      if (urlCache.base !== value) {
        urlCache = {
          base: value,
          urls: new Map<string, string | undefined>(),
        };
      }
      if (!urlCache.urls.has(input)) {
        let value2: string | undefined;
        try {
          value2 = /^https?:/i.test(value)
            ? new URL(
                (0, runtime.encodeRelativeUrlPath)(
                  (0, runtime.projectFilePath)(input),
                ),
                value,
              ).pathname
            : undefined;
        } catch {
          value2 = undefined;
        }
        urlCache.urls.set(
          input,
          value2 !== undefined && runtime.SWATCH_LOCAL_URL_PATTERN.test(value2)
            ? value2
            : undefined,
        );
      }
      return urlCache.urls.get(input);
    }
    return {
      publishedUrl(
        input: string,
        items: string,
        context: Editor.PublishedFileKind,
      ) {
        let value = currentAddressRoot();
        if (
          value === "" ||
          failedAddressRoots.has(value) ||
          unusableAddressRoots.has(value) ||
          !enabled()
        ) {
          return;
        }
        let value2 = addressedFile((0, runtime.projectFilePath)(input));
        if (value2 === undefined) {
          noteUnusableListing(value);
        }
        if (
          value2 === undefined ||
          value2 === null ||
          !PREVIEW_FILE_MIME_PREDICATES[context](
            (value2.contentType.split(";")[0] ?? "").trim().toLowerCase(),
          )
        ) {
          return;
        }
        let value3 = publishedFileAddress(input);
        if (value3 === undefined || addressRoot(value3) !== value) {
          return;
        }
        if (
          context === "font"
            ? (0, runtime.estimateDataUriBytes)(items) !== value2.size
            : value2.size < items.length || value2.size > items.length * 3
        ) {
          return;
        }
        let value4 = hashContents(input, items, context);
        if (value4 !== undefined && value4 === value2.sha256) {
          return {
            url: value3,
            integrity: sha256Integrity(value4),
          };
        } else {
          return undefined;
        }
      },
      noteFailed(
        input: string,
        options2: string | undefined,
        context?: string | number,
      ): void {
        let value = addressRoot(input);
        if (value === "" || failedAddressRoots.has(value)) {
          return;
        }
        failedAddressRoots.add(value);
        let value2: string =
          context === undefined
            ? "could not load " + options2 + " from its URL"
            : options2 +
              " did not finish loading from its URL in " +
              context +
              " s";
        warn(
          "design-system: " +
            value2 +
            " (" +
            input +
            "), so previews on this page use the page’s own copies of the system’s files. Nothing is lost. Reload the page to load them by URL again.",
        );
        notify();
      },
      noteAddressBehind(): void {
        let value = currentAddressRoot();
        if (value === "" || failedAddressRoots.has(value) || !enabled()) {
          return;
        }
        failedAddressRoots.add(value);
        notify();
      },
      stillOffered: (input: string): boolean =>
        !failedAddressRoots.has(addressRoot(input)),
      generation: () => generation,
      subscribe(input: () => void) {
        subscribers.add(input);
        return () => void subscribers.delete(input);
      },
    };
  }
  function subscribePublishedPreviewToSaveState(
    document2: Pick<
      Application.ApplicationDocument,
      "saveState" | "subscribeSave"
    >,
    cache: Editor.PublishedPreviewCache = publishedPreviewCache,
  ): () => void {
    let update = (): void => {
      if (!SAVE_STATES_WITH_CURRENT_ADDRESSES[document2.saveState().status]) {
        cache.noteAddressBehind();
      }
    };
    update();
    return document2.subscribeSave(update);
  }
  function usePublishedPreviewGeneration(
    document2: Pick<
      Application.ApplicationDocument,
      "saveState" | "subscribeSave"
    >,
  ): number {
    reactPublishedPreview.useEffect(
      () => subscribePublishedPreviewToSaveState(document2),
      [document2],
    );
    return reactPublishedPreview.useSyncExternalStore(
      subscribePublishedPreviewCache,
      publishedPreviewGeneration,
      publishedPreviewGeneration,
    );
  }
  bindRuntimeValue(
    runtime,
    "reactPublishedPreview",
    () => reactPublishedPreview,
    (value) => {
      reactPublishedPreview = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILES_LISTING_NAME",
    () => FILES_LISTING_NAME,
    (value) => {
      FILES_LISTING_NAME = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILES_LISTING_TIMEOUT_MS",
    () => FILES_LISTING_TIMEOUT_MS,
    (value) => {
      FILES_LISTING_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILES_LISTING_RETRY_MS",
    () => FILES_LISTING_RETRY_MS,
    (value) => {
      FILES_LISTING_RETRY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILES_LISTING_EXHAUSTED_RETRY_MS",
    () => FILES_LISTING_EXHAUSTED_RETRY_MS,
    (value) => {
      FILES_LISTING_EXHAUSTED_RETRY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILES_LISTING_MAX_ATTEMPTS",
    () => FILES_LISTING_MAX_ATTEMPTS,
    (value) => {
      FILES_LISTING_MAX_ATTEMPTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ADDRESSED_VERSION_PATH_PATTERN",
    () => ADDRESSED_VERSION_PATH_PATTERN,
    (value) => {
      ADDRESSED_VERSION_PATH_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_SHA256_PATTERNEditorPublishedPreview",
    () => FILE_SHA256_PATTERNEditorPublishedPreview,
    (value) => {
      FILE_SHA256_PATTERNEditorPublishedPreview = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "addressedVersionFromPage",
    () => addressedVersionFromPage,
    (value) => {
      addressedVersionFromPage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fetchProjectFilesListing",
    () => fetchProjectFilesListing,
    (value) => {
      fetchProjectFilesListing = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createPublishedFilesRegistry",
    () => createPublishedFilesRegistry,
  );
  bindRuntimeValue(
    runtime,
    "publishedFilesRegistry",
    () => publishedFilesRegistry,
    (value) => {
      publishedFilesRegistry = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "addressedFileEntry",
    () => addressedFileEntry,
    (value) => {
      addressedFileEntry = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "subscribeAddressedFileEntries",
    () => subscribeAddressedFileEntries,
    (value) => {
      subscribeAddressedFileEntries = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PREVIEW_FILE_MIME_PREDICATES",
    () => PREVIEW_FILE_MIME_PREDICATES,
    (value) => {
      PREVIEW_FILE_MIME_PREDICATES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PUBLISHED_FILE_ADDRESS_ROOT_PATTERN",
    () => PUBLISHED_FILE_ADDRESS_ROOT_PATTERN,
    (value) => {
      PUBLISHED_FILE_ADDRESS_ROOT_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "MAX_PUBLISHED_LISTING_FAILURES",
    () => MAX_PUBLISHED_LISTING_FAILURES,
    (value) => {
      MAX_PUBLISHED_LISTING_FAILURES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "hasAddressDependentPreviewCode",
    () => hasAddressDependentPreviewCode,
  );
  bindRuntimeValue(runtime, "publishedFileBytes", () => publishedFileBytes);
  bindRuntimeValue(
    runtime,
    "sha256Integrity",
    () => sha256Integrity,
    (value) => {
      sha256Integrity = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createPublishedPreviewCache",
    () => createPublishedPreviewCache,
  );
  bindRuntimeValue(
    runtime,
    "publishedPreviewCache",
    () => publishedPreviewCache,
    (value) => {
      publishedPreviewCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "publishedPreviewUrl",
    () => publishedPreviewUrl,
    (value) => {
      publishedPreviewUrl = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "notePublishedPreviewFailure",
    () => notePublishedPreviewFailure,
    (value) => {
      notePublishedPreviewFailure = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "isPublishedPreviewStillOffered",
    () => isPublishedPreviewStillOffered,
    (value) => {
      isPublishedPreviewStillOffered = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SAVE_STATES_WITH_CURRENT_ADDRESSES",
    () => SAVE_STATES_WITH_CURRENT_ADDRESSES,
    (value) => {
      SAVE_STATES_WITH_CURRENT_ADDRESSES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "subscribePublishedPreviewToSaveState",
    () => subscribePublishedPreviewToSaveState,
  );
  bindRuntimeValue(
    runtime,
    "subscribePublishedPreviewCache",
    () => subscribePublishedPreviewCache,
    (value) => {
      subscribePublishedPreviewCache = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "publishedPreviewGeneration",
    () => publishedPreviewGeneration,
    (value) => {
      publishedPreviewGeneration = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "usePublishedPreviewGeneration",
    () => usePublishedPreviewGeneration,
  );
  return () => {
    reactPublishedPreview = (0, runtime.toModuleNamespace)(
      (0, runtime.loadReactNamespace)(),
      1,
    );
    FILES_LISTING_NAME = "_files.json";
    FILES_LISTING_TIMEOUT_MS = 30000;
    FILES_LISTING_RETRY_MS = 5000;
    FILES_LISTING_EXHAUSTED_RETRY_MS = 60000;
    FILES_LISTING_MAX_ATTEMPTS = 6;
    ADDRESSED_VERSION_PATH_PATTERN = /\/_f\/([^/]+)\//;
    FILE_SHA256_PATTERNEditorPublishedPreview = /^[0-9a-f]{64}$/;
    addressedVersionFromPage = () => {
      try {
        let value = globalThis,
          value2 =
            value.document?.baseURI !== undefined
              ? new URL(value.document.baseURI).pathname
              : (value.location?.pathname ?? "");
        return ADDRESSED_VERSION_PATH_PATTERN.exec(value2)?.[1] ?? "";
      } catch {
        return "";
      }
    };
    fetchProjectFilesListing = async (): Promise<unknown> => {
      let value = await globalThis.fetch(FILES_LISTING_NAME, {
        credentials: "same-origin",
        signal: AbortSignal.timeout(FILES_LISTING_TIMEOUT_MS),
      });
      if (!value.ok) {
        throw Error(FILES_LISTING_NAME + ": HTTP " + String(value.status));
      }
      return await value.json();
    };
    publishedFilesRegistry = createPublishedFilesRegistry();
    addressedFileEntry = (path: string) =>
      publishedFilesRegistry.addressedFile(path);
    subscribeAddressedFileEntries = (listener: () => void) =>
      publishedFilesRegistry.onAddressedChange(listener);
    PREVIEW_FILE_MIME_PREDICATES = {
      style: (input: string): boolean => input === "text/css",
      script: (input: string) =>
        input === "text/javascript" || input === "application/javascript",
      font: (input: string) => input.startsWith("font/"),
    };
    PUBLISHED_FILE_ADDRESS_ROOT_PATTERN = /^(.*?\/_f\/[^/]+\/)/;
    MAX_PUBLISHED_LISTING_FAILURES = 4;
    sha256Integrity = (hexDigest: string): string =>
      "sha256-" +
      btoa(
        String.fromCharCode(
          ...(hexDigest.match(/../g) ?? []).map((input) => parseInt(input, 16)),
        ),
      );
    publishedPreviewCache = createPublishedPreviewCache();
    publishedPreviewUrl = (
      path: string,
      contents: string,
      kind: Editor.PublishedFileKind,
    ) => publishedPreviewCache.publishedUrl(path, contents, kind);
    notePublishedPreviewFailure = (
      url: string,
      label: string | undefined,
      timeoutSeconds?: string | number,
    ) => publishedPreviewCache.noteFailed(url, label, timeoutSeconds);
    isPublishedPreviewStillOffered = (url: string) =>
      publishedPreviewCache.stillOffered(url);
    SAVE_STATES_WITH_CURRENT_ADDRESSES = {
      loading: true,
      ready: true,
      readonly: true,
      dirty: false,
      saving: false,
      saved: false,
      cached: false,
      error: false,
    };
    subscribePublishedPreviewCache = (listener: () => void) =>
      publishedPreviewCache.subscribe(listener);
    publishedPreviewGeneration = () => publishedPreviewCache.generation();
  };
}
