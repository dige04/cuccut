/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type {
  PortListingMetadata,
  PortListingCache,
  PublishedFileOverride,
  PortRawListingValue,
  PortRawListing,
  PublishErrorWire,
  FilesPublishCapability,
  BrowserFilesPortOptions,
  BrowserFilesPortExtended,
  PublishCapabilityEntry,
  NormalizedFilePublishInput,
  FileRetryError,
} from "../contracts/files-core";
import type * as Files from "../contracts";
export function installFilesBrowserPort(runtime: RuntimeBindings): () => void {
  var FILE_LISTING_PATH: string;
  var supportsFilesPublish: (value: unknown) => value is FilesPublishCapability;
  var FILE_PUBLISH_WRITE_REVOKED_CODES: Set<Files.FilePublishFailureCode>;
  var FILE_PUBLISH_ERROR_CODE_MAP: Record<string, Files.FilePublishFailureCode>;
  var FILE_SHA256_PATTERN: RegExp;
  var normalizeFileSha256: (value: unknown) => string | null | undefined;
  var FILE_SCOPE_PATH_PATTERN: RegExp;
  var FILE_FETCH_TIMEOUT_MS: number;
  var fileTextDecoder: TextDecoder;
  async function getFilesPublishCapability(): Promise<FilesPublishCapability | null> {
    return (
      (await (0, runtime.getOrLoadClaudeCapability)(
        "artifact",
        supportsFilesPublish,
      )) ??
      (await (0, runtime.getOrLoadClaudeCapability)(
        "self",
        supportsFilesPublish,
      ))
    );
  }
  function parseFileShaListing(value: unknown) {
    if (!Array.isArray(value)) {
      return;
    }
    let entries: Files.ChangedFileRow[] = [];
    for (let value2 of value as (PortRawListingValue | null)[]) {
      let value3 = normalizeFileSha256(value2?.sha256);
      if (typeof value2?.path !== "string" || value3 === undefined) {
        return;
      }
      entries.push({
        path: value2!.path as string,
        sha256: value3,
      });
    }
    return entries;
  }
  function parseFilePublishConflicts(value: unknown) {
    if (!Array.isArray(value)) {
      return;
    }
    let conflicts: NonNullable<Files.FilePublishFailure["paths"]> = [];
    for (let value2 of value as (PortRawListingValue | null)[]) {
      let value3 = normalizeFileSha256(
        "actual" in (value2 ?? {}) ? value2!.actual : value2?.liveSha,
      );
      if (typeof value2?.path !== "string" || value3 === undefined) {
        return;
      }
      let value4 = normalizeFileSha256(value2!.expected);
      conflicts.push({
        path: value2!.path as string,
        liveSha: value3,
        ...(value4 !== undefined
          ? {
              expected: value4,
            }
          : {}),
      });
    }
    return conflicts;
  }
  function normalizeFilesPublishError(
    error: unknown,
  ): Files.FilePublishFailure {
    let record =
        typeof error === "object" && error !== null
          ? (error as PublishErrorWire)
          : {},
      code =
        (typeof record.code === "string"
          ? FILE_PUBLISH_ERROR_CODE_MAP[record.code]
          : undefined) ?? "upstream_error",
      retryAfterMs =
        typeof record.retryAfterMs === "number"
          ? record.retryAfterMs
          : typeof record.retry_after_ms === "number"
            ? record.retry_after_ms
            : undefined,
      value = parseFilePublishConflicts(record.paths),
      value2 = parseFileShaListing(record.changed);
    return {
      ok: false,
      code: code,
      ...(typeof record.live === "string"
        ? {
            live: record.live,
          }
        : {}),
      ...(retryAfterMs !== undefined
        ? {
            retryAfterMs: retryAfterMs,
          }
        : {}),
      ...(value !== undefined
        ? {
            paths: value,
          }
        : {}),
      ...(value2 !== undefined
        ? {
            changed: value2,
          }
        : {}),
    };
  }
  function createBrowserFilesPort(options: BrowserFilesPortOptions = {}) {
    let fetchFile =
        options.fetch ?? ((input: string) => globalThis.fetch(input)),
      fetchFresh = options.fetchFresh ?? fetchFile,
      freshReads: boolean = false,
      now = () => globalThis.performance?.now() ?? Date.now(),
      fetchWithReadTelemetry = async (input: string): Promise<Response> => {
        let value: boolean = freshReads,
          value2 = now();
        try {
          let value3 = await (value ? fetchFresh : fetchFile)(input);
          try {
            options.onRead?.(input, now() - value2, value3.status, value);
          } catch {}
          return value3;
        } catch (value3: unknown) {
          try {
            options.onRead?.(input, now() - value2, 0, value);
          } catch {}
          throw value3;
        }
      },
      resolvePublishCapability = options.resolveNs ?? getFilesPublishCapability,
      pageLocation = options.location ?? globalThis.location,
      version = options.bootVersion ?? {
        version:
          FILE_SCOPE_PATH_PATTERN.exec(pageLocation?.pathname ?? "")?.[1] ?? "",
      },
      canWrite = options.canWrite ?? true,
      bootFiles = options.bootFiles,
      bootNarrowed: boolean = options.bootNarrowed === true,
      listingNarrowed = false,
      listingCache: PortListingCache | undefined,
      heldFileShas: Map<string, string | null> = new Map(),
      publishedFileOverrides: Map<string, PublishedFileOverride | null> =
        new Map(),
      ownPublishedVersions: Set<string> = new Set(),
      publishGeneration = 0,
      maxRetainedVersions: number = 64,
      publishGenerationByVersion: Map<string, number> = new Map(),
      lastPublishedGenerationByPath: Map<string, number> = new Map(),
      fileReadCache: Map<string, Files.FileBytesRead> = new Map(),
      remoteChangeSubscribers: Set<(change: Files.FileRemoteChange) => void> =
        new Set(),
      listingEntryDiffers = (input: Files.ChangedFileRow) => {
        let entry = publishedFileOverrides.get(input.path);
        return (
          entry !== undefined &&
          !provisionalFileShas.has(input.path) &&
          (entry === null ? null : entry.sha256) !== input.sha256
        );
      },
      parseListingEntry = (
        input: string,
        options2: PortRawListingValue | null | undefined,
      ) =>
        typeof options2?.sha256 === "string"
          ? {
              sha256: options2.sha256,
              size: typeof options2.size === "number" ? options2.size : 0,
              contentType:
                typeof options2.contentType === "string"
                  ? options2.contentType
                  : ((0, runtime.fileMimeTypeFromPath)(input) ??
                    "application/octet-stream"),
            }
          : undefined;
    async function fetchListing(): Promise<{
      files: PortListingCache;
      narrowed: boolean;
    }> {
      let entries: PortListingCache = new Map();
      if (bootFiles !== undefined) {
        let value3: boolean = bootNarrowed,
          value4 = Array.isArray(bootFiles)
            ? bootFiles.map(
                (
                  input: { path: string } & PortRawListingValue,
                ): [string, PortRawListingValue] => [input.path, input],
              )
            : Object.entries(bootFiles);
        for (let [value5, value6] of value4) {
          let value7 = parseListingEntry(value5, value6);
          if (value7) {
            entries.set(value5, value7);
          }
        }
        return {
          files: entries,
          narrowed: value3,
        };
      }
      let value = await fetchWithReadTelemetry(FILE_LISTING_PATH);
      if (!value.ok) {
        throw {
          code: value.status === 404 ? "not_found" : "http",
          status: value.status,
          message: FILE_LISTING_PATH + ": HTTP " + String(value.status),
        };
      }
      let value2: PortRawListing | null = await value.json();
      if (
        value2 === null ||
        typeof value2 !== "object" ||
        value2.files === null ||
        typeof value2.files !== "object" ||
        Array.isArray(value2.files)
      ) {
        throw {
          code: "http",
          status: value.status,
          malformed: true,
          message: FILE_LISTING_PATH + ": no files object",
        };
      }
      if (typeof value2.ver === "string" && version.version === "") {
        version = {
          version: value2.ver,
        };
      }
      let files = value2.files;
      for (let [value3, value4] of Object.entries(files)) {
        let value5 = parseListingEntry(value3, value4);
        if (value5) {
          entries.set(value3, value5);
        }
      }
      return {
        files: entries,
        narrowed: value2.narrowed === true,
      };
    }
    function overlayPublishedFiles(input: PortListingCache): void {
      for (let [value, value2] of publishedFileOverrides) {
        if (value2 === null) {
          input.delete(value);
        } else {
          input.set(value, {
            sha256: value2.sha256,
            size: value2.bytes.length,
            contentType: value2.contentType,
          });
        }
      }
    }
    async function readListing(
      input: boolean = false,
    ): Promise<PortListingCache> {
      let value = listingGeneration;
      if (input && canWrite && bootNarrowed) {
        bootFiles = undefined;
        bootNarrowed = false;
      }
      let value2 = await fetchListing();
      if (input && canWrite && value2.narrowed) {
        throw {
          code: "http",
          status: 403,
          narrowed: true,
          message: FILE_LISTING_PATH + ": marked as narrowed",
        };
      }
      let value3 = Object.defineProperty(value2.files, "narrowed", {
        value: value2.narrowed,
      });
      overlayPublishedFiles(value3);
      if (
        value === listingGeneration &&
        !(
          canWrite &&
          value2.narrowed &&
          listingCache !== undefined &&
          !listingNarrowed
        )
      ) {
        listingCache = value3;
        listingNarrowed = value2.narrowed;
        listingCacheGeneration = listingGeneration;
      }
      return value3;
    }
    let listingReadPromise:
        | { at: number; p: Promise<PortListingCache | void> }
        | undefined,
      lastUnavailableListingGeneration = -1;
    function ensureListing() {
      let value = listingGeneration;
      if (!canWrite && lastUnavailableListingGeneration === value) {
        return Promise.resolve(undefined);
      }
      if (listingReadPromise?.at === value) {
        return listingReadPromise.p;
      }
      let state = {
        at: value,
        p: readListing()
          .catch((input: unknown): void => {
            let value2: unknown = (input as FileRetryError | null)?.status;
            if (!canWrite && (value2 === 401 || value2 === 403)) {
              lastUnavailableListingGeneration = value;
            }
            return;
          })
          .finally((): void => {
            if (listingReadPromise === state) {
              listingReadPromise = undefined;
            }
          }),
      };
      listingReadPromise = state;
      return state.p;
    }
    let currentFrameVersion = () =>
      FILE_SCOPE_PATH_PATTERN.exec(pageLocation?.pathname ?? "")?.[1];
    function checkReadRedirect(
      input: Response,
      options2: string,
      context: string | undefined,
    ): void {
      if (
        input.redirected !== true ||
        !freshReads ||
        !canWrite ||
        context === undefined
      ) {
        return;
      }
      let value: string | undefined;
      try {
        value = FILE_SCOPE_PATH_PATTERN.exec(
          new URL(input.url ?? "", "https://page.invalid").pathname,
        )?.[1];
      } catch {
        value = undefined;
      }
      if (value !== undefined && value !== context) {
        throw {
          code: "redirected",
          status: 403,
          redirectedTo: input.url,
          message:
            options2 +
            ": answered by a redirect to /_f/" +
            value +
            "/, not the version this page addresses (/_f/" +
            context +
            "/); asked for again",
        };
      }
    }
    async function readFileBytes(
      input: string,
      options2: boolean = false,
    ): Promise<Files.FileBytesRead & { raw: boolean }> {
      let entry = publishedFileOverrides.get(input);
      if (entry === null) {
        throw {
          code: "not_found",
          status: 404,
          message: input + ": deleted by this tab",
        };
      }
      if (entry !== undefined) {
        heldFileShas.set(input, entry.sha256);
        return {
          bytes: entry.bytes,
          sha256: entry.sha256,
          contentType: entry.contentType,
          raw: false,
        };
      }
      let entry2 = fileReadCache.get(input);
      if (
        entry2 !== undefined &&
        (listingCache?.get(input)?.sha256 ?? entry2.sha256) === entry2.sha256
      ) {
        return {
          ...entry2,
          raw: true,
        };
      }
      let value = currentFrameVersion(),
        [value2, value3] = await Promise.all([
          fetchWithReadTelemetry((0, runtime.encodeFileUrlPath)(input)),
          listingCache !== undefined
            ? Promise.resolve(listingCache)
            : ensureListing(),
        ]);
      if (!options2) {
        checkReadRedirect(value2, input, value);
      }
      if (!value2.ok) {
        throw {
          code: value2.status === 404 ? "not_found" : "http",
          status: value2.status,
          message: input + ": HTTP " + String(value2.status),
        };
      }
      let value4 = new Uint8Array(await value2.arrayBuffer()),
        value5 = value3?.get(input),
        value6 = value5?.sha256 ?? "",
        value7 =
          value5?.contentType ??
          value2.headers?.get("content-type")?.split(";")[0]?.trim() ??
          (0, runtime.fileMimeTypeFromPath)(input) ??
          "application/octet-stream";
      return {
        bytes: value4,
        sha256: value6,
        contentType: value7,
        raw: true,
      };
    }
    let publishSupportsDelete: boolean = false,
      provisionalFileShas = new Set(),
      publishChain: Promise<unknown> = Promise.resolve(),
      listingGeneration = 0,
      listingCacheGeneration = 0,
      remoteVersionGeneration = 0,
      hotChangeGeneration = 0;
    function enqueuePublish(
      input: Files.FilePublishEntries,
      options2?: Files.FilePublishPreconditions,
    ) {
      let value = remoteVersionGeneration,
        value2 = publishChain.then(() => publish(input, options2, value));
      publishChain = value2.catch((): void => {
        return;
      });
      return value2;
    }
    async function publish(
      input: Files.FilePublishEntries,
      options2: Files.FilePublishPreconditions | undefined,
      context: number,
    ): Promise<Files.FilePublishResult> {
      if (canWrite && (listingCache === undefined || listingNarrowed)) {
        await Promise.race([
          readListing().catch((): void => {
            return;
          }),
          new Promise<void>(
            (input2: () => void) =>
              void setTimeout(input2, FILE_FETCH_TIMEOUT_MS),
          ),
        ]);
      }
      if (!canWrite || listingNarrowed) {
        return {
          ok: false,
          code: "not_writer",
        };
      }
      let value = (0, runtime.validateFilePublishBatch)(input);
      if (value) {
        return value;
      }
      if (
        context !== remoteVersionGeneration &&
        options2?.ifMatch !== undefined
      ) {
        return {
          ok: false,
          code: "conflict",
          live: version.version,
        };
      }
      let value2 = await resolvePublishCapability();
      if (value2 === null) {
        canWrite = false;
        return {
          ok: false,
          code: "capability_disabled",
        };
      }
      let value3 = Object.keys(input).flatMap((input2: string) => {
        let entry = publishedFileOverrides.get(input2),
          value12 =
            options2?.ifMatch !== undefined &&
            Object.hasOwn(options2.ifMatch, input2)
              ? options2.ifMatch[input2]
              : undefined,
          value13 =
            entry === undefined
              ? undefined
              : entry === null
                ? null
                : entry.sha256;
        if (
          value12 === undefined ||
          value13 === undefined ||
          provisionalFileShas.has(input2) ||
          value12 === value13
        ) {
          return [];
        } else {
          return [
            {
              path: input2,
              liveSha: value13,
              expected: value12,
            },
          ];
        }
      });
      if (value3.length > 0) {
        return {
          ok: false,
          code: "conflict",
          live: version.version,
          paths: value3,
        };
      }
      let state: Record<string, NormalizedFilePublishInput | null> = {};
      for (let [value12, value13] of Object.entries(input)) {
        state[value12] = (0, runtime.normalizeFilePublishInput)(
          value12,
          value13,
        ) as NormalizedFilePublishInput | null;
      }
      let state2: Record<string, PublishCapabilityEntry> = {},
        items: string[] = [],
        value4 =
          options.preconditions === undefined
            ? {
                writes: true,
                deletes: true,
              }
            : options.preconditions === false
              ? {}
              : options.preconditions,
        value5: boolean = value4.writes === true,
        value6 = value5 && value4.deletes === true;
      for (let [value12, value13] of Object.entries(state)) {
        let value14 =
            options2?.ifMatch !== undefined &&
            Object.hasOwn(options2.ifMatch, value12)
              ? options2.ifMatch[value12]
              : undefined,
          value15 = value14;
        if (
          typeof value15 === "string" &&
          provisionalFileShas.has(value12) &&
          publishedFileOverrides.get(value12)?.sha256 === value15
        ) {
          value15 = undefined;
        }
        if (typeof value15 === "string" && !FILE_SHA256_PATTERN.test(value15)) {
          value15 = undefined;
        }
        if (value13 !== null) {
          state2[value12] =
            value5 && value15 !== undefined
              ? {
                  ...value13,
                  ifMatch: value15,
                }
              : value13;
        } else {
          state2[value12] =
            value6 && publishSupportsDelete && typeof value15 === "string"
              ? {
                  delete: true,
                  ifMatch: value15,
                }
              : null;
        }
        let value16 = state2[value12];
        if (
          value14 !== undefined &&
          (value16 === null || value16 === undefined || !("ifMatch" in value16))
        ) {
          items.push(value12);
        }
      }
      let entries: Map<
        string,
        { bytes: Uint8Array<ArrayBufferLike>; hash: string }
      > = new Map();
      for (let [value12, value13] of Object.entries(state)) {
        if (value13 !== null) {
          let value14 = await (0, runtime.fileContentBytes)(value13.content);
          entries.set(value12, {
            bytes: value14,
            hash: await (0, runtime.sha256)(value14),
          });
        }
      }
      if (
        context !== remoteVersionGeneration &&
        options2?.ifMatch !== undefined
      ) {
        return {
          ok: false,
          code: "conflict",
          live: version.version,
        };
      }
      let version2 = version.version,
        value7 = hotChangeGeneration,
        value8: import("../contracts/files-core").FilePublishReply;
      try {
        value8 = await value2.publish(state2);
      } catch (value12: unknown) {
        try {
          options.onPublishError?.(value12);
        } catch {}
        let value13 = normalizeFilesPublishError(value12);
        if (FILE_PUBLISH_WRITE_REVOKED_CODES.has(value13.code)) {
          canWrite = false;
        }
        return value13;
      }
      let state3: Record<string, string> = {},
        value9: boolean = hotChangeGeneration !== value7,
        items2: string[] = [];
      for (let [value12, value13] of Object.entries(state)) {
        if (value13 === null) {
          heldFileShas.set(value12, null);
          if (!value9) {
            publishedFileOverrides.set(value12, null);
            listingCache?.delete(value12);
            provisionalFileShas.delete(value12);
          }
          continue;
        }
        let { bytes: entry, hash: entry2 } = entries.get(value12)!,
          value14 = value8.shas?.[value12],
          value15 = value14 ?? entry2;
        if (value14 === undefined) {
          items2.push(value12);
        }
        state3[value12] = value15;
        heldFileShas.set(value12, value15);
        if (value9) {
          continue;
        }
        if (
          value14 === undefined &&
          (0, runtime.fileContentContainsRuntimeMarkers)(value13)
        ) {
          provisionalFileShas.add(value12);
        } else {
          provisionalFileShas.delete(value12);
        }
        publishedFileOverrides.set(value12, {
          sha256: value15,
          bytes: entry,
          contentType: value13.contentType,
        });
        listingCache?.set(value12, {
          sha256: value15,
          size: entry.length,
          contentType: value13.contentType,
        });
      }
      bootFiles = undefined;
      if (!value9) {
        version = {
          version: value8.version,
          ...(typeof value8.seq === "number"
            ? {
                seq: value8.seq,
              }
            : {}),
        };
      }
      let value10 =
        value8.shas !== undefined &&
        value8.shas !== null &&
        typeof value8.shas === "object" &&
        !Array.isArray(value8.shas);
      if (value10) {
        publishSupportsDelete = true;
      }
      let value11 = parseFileShaListing(value8.changed);
      if (
        !(value11 !== undefined
          ? value11.length > 0
          : value10 && items.length === 0) &&
        !value9 &&
        value8.unchanged !== true &&
        value8.version !== version2
      ) {
        ownPublishedVersions.add(value8.version);
      }
      publishGeneration += 1;
      if (value8.unchanged !== true && value8.version !== version2) {
        publishGenerationByVersion.set(value8.version, publishGeneration);
        if (publishGenerationByVersion.size > maxRetainedVersions) {
          publishGenerationByVersion.delete(
            publishGenerationByVersion.keys().next().value!,
          );
        }
      }
      for (let value12 of Object.keys(state)) {
        lastPublishedGenerationByPath.set(value12, publishGeneration);
      }
      return {
        ok: true,
        version: value8.version,
        ...(typeof value8.seq === "number"
          ? {
              seq: value8.seq,
            }
          : {}),
        shas: state3,
        ...(items2.length > 0
          ? {
              computed: items2,
            }
          : {}),
        ...(value8.unchanged === true
          ? {
              unchanged: true,
            }
          : {}),
        ...(value10 && items.length === 0
          ? {
              preconditionsChecked: true,
            }
          : {}),
        ...(value10 && items.length > 0
          ? {
              unguarded: items,
            }
          : {}),
        ...(value11 !== undefined
          ? {
              changed: value11,
            }
          : {}),
      };
    }
    async function readFileText(
      input: string,
      options2?: boolean,
    ): Promise<Files.FileTextRead> {
      let value = await readFileBytes(input, options2),
        value2 = fileTextDecoder.decode(value.bytes);
      if (value.raw && (0, runtime.isHtmlFilePath)(input)) {
        value2 = (0, runtime.stripFrameRuntimeBlock)(value2);
      }
      let value3 =
        value.sha256 !== "" ? value.sha256 : await (0, runtime.sha256)(value2);
      heldFileShas.set(input, value3);
      return {
        text: value2,
        sha256: value3,
      };
    }
    let listingToFiles = (input: PortListingCache) => {
      let value = [...input]
        .sort(
          (
            [input2]: [string, PortListingMetadata],
            [options2]: [string, PortListingMetadata],
          ): number => (input2 < options2 ? -1 : 1),
        )
        .map(([input2, input3]: [string, PortListingMetadata]) => ({
          path: input2,
          ...input3,
          ...(provisionalFileShas.has(input2) &&
          publishedFileOverrides.get(input2)?.sha256 === input3.sha256
            ? {
                provisional: true,
              }
            : {}),
        }));
      return Object.defineProperty(value, "narrowed", {
        value: input.narrowed === true,
      });
    };
    return {
      get canWrite() {
        return canWrite && !listingNarrowed;
      },
      get narrowed() {
        return listingNarrowed;
      },
      get mayWrite() {
        return canWrite;
      },
      forgetBootListing(): void {
        bootFiles = undefined;
        bootNarrowed = false;
      },
      async listUnlessNarrowed(): Promise<Files.FileListing> {
        return listingToFiles(await readListing(true));
      },
      version: () => version,
      async list(): Promise<Files.FileListing> {
        return listingToFiles(await readListing());
      },
      async readBytes(input: string): Promise<Files.FileBytesRead> {
        let value = await readFileBytes(input),
          value2 =
            value.sha256 !== ""
              ? value.sha256
              : await (0, runtime.sha256)(value.bytes);
        heldFileShas.set(input, value2);
        return {
          bytes: value.bytes,
          sha256: value2,
          contentType: value.contentType,
        };
      },
      async peekBytes(input: string): Promise<{
        bytes: Uint8Array<ArrayBufferLike>;
        sha256?: string;
        contentType: string;
      }> {
        let callback = () => {
            let entry2 = publishedFileOverrides.get(input);
            if (entry2 === null) {
              throw {
                code: "not_found",
                status: 404,
                message: input + ": deleted by this tab",
              };
            }
            if (entry2 === undefined) {
              return undefined;
            } else {
              return {
                bytes: entry2.bytes.slice(),
                ...(provisionalFileShas.has(input)
                  ? {}
                  : {
                      sha256: entry2.sha256,
                    }),
                contentType: entry2.contentType,
              };
            }
          },
          value = callback();
        if (value !== undefined) {
          return value;
        }
        let entry = fileReadCache.get(input);
        if (
          entry !== undefined &&
          (listingCache?.get(input)?.sha256 ?? entry.sha256) === entry.sha256
        ) {
          return {
            bytes: entry.bytes.slice(),
            sha256: entry.sha256,
            contentType: entry.contentType,
          };
        }
        let value2 = listingGeneration,
          value3 = listingCache?.get(input)?.sha256,
          value4 = currentFrameVersion(),
          value5 = await fetchWithReadTelemetry(
            (0, runtime.encodeFileUrlPath)(input),
          );
        checkReadRedirect(value5, input, value4);
        if (!value5.ok) {
          throw {
            code: value5.status === 404 ? "not_found" : "http",
            status: value5.status,
            message: input + ": HTTP " + String(value5.status),
          };
        }
        let value6 = new Uint8Array(await value5.arrayBuffer()),
          value7 = callback();
        if (value7 !== undefined) {
          return value7;
        }
        let value8 = listingCache?.get(input),
          value9 =
            value2 === listingGeneration &&
            listingCacheGeneration === listingGeneration &&
            value8?.sha256 === value3 &&
            value3 !== ""
              ? value3
              : undefined;
        return {
          bytes: value6,
          ...(value9 !== undefined
            ? {
                sha256: value9,
              }
            : {}),
          contentType:
            value8?.contentType ??
            value5.headers?.get("content-type")?.split(";")[0]?.trim() ??
            (0, runtime.fileMimeTypeFromPath)(input) ??
            "application/octet-stream",
        };
      },
      peekRows: () =>
        listingCache === undefined ? undefined : listingToFiles(listingCache),
      readText: (input: string) => readFileText(input, false),
      readTextUnchecked: (input: string) => readFileText(input, true),
      publish: enqueuePublish,
      onRemoteChange(input: (change: Files.FileRemoteChange) => void) {
        remoteChangeSubscribers.add(input);
        return () => void remoteChangeSubscribers.delete(input);
      },
      liveSha: (input: string) => {
        if (listingCache === undefined) {
          return publishedFileOverrides.get(input)?.sha256;
        }
        let value = listingCache.get(input)?.sha256;
        if (value === "") {
          return undefined;
        } else {
          return value ?? (listingNarrowed ? undefined : null);
        }
      },
      heldSha: (input: string) => heldFileShas.get(input),
      olderThanMyWrite: (input: string, options2: string) => {
        let entry = publishGenerationByVersion.get(input),
          entry2 = lastPublishedGenerationByPath.get(options2);
        return entry !== undefined && entry2 !== undefined && entry2 > entry;
      },
      wroteSinceAdopt: (input: string) =>
        publishedFileOverrides.get(input) !== undefined &&
        publishedFileOverrides.get(input) !== null,
      knownListing: () =>
        new Map(
          [...(listingCache ?? [])].map(
            ([input, input2]: [string, PortListingMetadata]) => [
              input,
              input2.sha256,
            ],
          ),
        ),
      primeRead(input: string, options2: Files.FileBytesRead): void {
        if (publishedFileOverrides.has(input)) {
          return;
        }
        fileReadCache.set(input, options2);
        if (listingCache !== undefined && options2.sha256 !== "") {
          listingCache.set(input, {
            sha256: options2.sha256,
            size: options2.bytes.length,
            contentType: options2.contentType,
          });
        }
      },
      noteIncoming(input: Files.ChangedFileRow[]): void {
        for (let value of input) {
          if (listingEntryDiffers(value)) {
            continue;
          }
          if (value.sha256 === null) {
            heldFileShas.delete(value.path);
            fileReadCache.delete(value.path);
            listingCache?.delete(value.path);
            continue;
          }
          if (listingCache !== undefined) {
            let entry = listingCache.get(value.path);
            if (entry?.sha256 !== value.sha256) {
              listingCache.set(value.path, {
                sha256: value.sha256,
                size: 0,
                contentType:
                  entry?.contentType ??
                  (0, runtime.fileMimeTypeFromPath)(value.path) ??
                  "application/octet-stream",
              });
            }
          }
        }
        listingCacheGeneration = listingGeneration;
      },
      noteAdopted(input: Files.FileVersion): void {
        freshReads = true;
        listingGeneration += 1;
        if (
          ownPublishedVersions.has(input.version) &&
          listingCacheGeneration === listingGeneration - 1
        ) {
          listingCacheGeneration = listingGeneration;
        }
        fileReadCache.clear();
        bootFiles = undefined;
        if (!ownPublishedVersions.has(input.version)) {
          let entry = publishGenerationByVersion.get(input.version);
          for (let [value, value2] of [...publishedFileOverrides]) {
            if (
              entry !== undefined &&
              (lastPublishedGenerationByPath.get(value) ?? 0) > entry
            ) {
              continue;
            }
            if (listingCache !== undefined && value2 !== null) {
              listingCache.set(value, {
                sha256: "",
                size: listingCache.get(value)?.size ?? 0,
                contentType:
                  listingCache.get(value)?.contentType ??
                  (0, runtime.fileMimeTypeFromPath)(value) ??
                  "application/octet-stream",
              });
            }
            publishedFileOverrides.delete(value);
            provisionalFileShas.delete(value);
          }
          if (entry !== undefined && listingCache !== undefined) {
            for (let [value, value2] of lastPublishedGenerationByPath) {
              if (
                value2 >= entry &&
                !publishedFileOverrides.has(value) &&
                listingCache.has(value)
              ) {
                listingCache.set(value, {
                  sha256: "",
                  size: listingCache.get(value)?.size ?? 0,
                  contentType:
                    listingCache.get(value)?.contentType ??
                    (0, runtime.fileMimeTypeFromPath)(value) ??
                    "application/octet-stream",
                });
              }
            }
          }
          for (let value of [...ownPublishedVersions]) {
            if (
              entry === undefined ||
              (publishGenerationByVersion.get(value) ?? 0) <= entry
            ) {
              ownPublishedVersions.delete(value);
            }
          }
          remoteVersionGeneration += 1;
          if (entry === undefined) {
            hotChangeGeneration += 1;
          }
        }
        version = input;
      },
      noteRemote(input: Files.FileRemoteChange): void {
        let value = input.changed.filter(
          (input2: Files.ChangedFileRow): boolean =>
            listingEntryDiffers(input2) === false,
        );
        for (let value3 of value) {
          if (listingCache !== undefined) {
            if (value3.sha256 === null) {
              listingCache.delete(value3.path);
            } else {
              let entry = listingCache.get(value3.path);
              listingCache.set(value3.path, {
                sha256: value3.sha256,
                size: entry?.sha256 === value3.sha256 ? entry.size : 0,
                contentType:
                  entry?.contentType ??
                  (0, runtime.fileMimeTypeFromPath)(value3.path) ??
                  "application/octet-stream",
              });
            }
          }
        }
        let value2 =
          value.length === input.changed.length
            ? input
            : {
                ...input,
                changed: value,
              };
        for (let value3 of [...remoteChangeSubscribers]) {
          try {
            value3(value2);
          } catch {}
        }
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "FILE_LISTING_PATH",
    () => FILE_LISTING_PATH,
    (value) => {
      FILE_LISTING_PATH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "supportsFilesPublish",
    () => supportsFilesPublish,
    (value) => {
      supportsFilesPublish = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getFilesPublishCapability",
    () => getFilesPublishCapability,
  );
  bindRuntimeValue(
    runtime,
    "FILE_PUBLISH_WRITE_REVOKED_CODES",
    () => FILE_PUBLISH_WRITE_REVOKED_CODES,
    (value) => {
      FILE_PUBLISH_WRITE_REVOKED_CODES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_PUBLISH_ERROR_CODE_MAP",
    () => FILE_PUBLISH_ERROR_CODE_MAP,
    (value) => {
      FILE_PUBLISH_ERROR_CODE_MAP = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_SHA256_PATTERN",
    () => FILE_SHA256_PATTERN,
    (value) => {
      FILE_SHA256_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeFileSha256",
    () => normalizeFileSha256,
    (value) => {
      normalizeFileSha256 = value;
    },
  );
  bindRuntimeValue(runtime, "parseFileShaListing", () => parseFileShaListing);
  bindRuntimeValue(
    runtime,
    "parseFilePublishConflicts",
    () => parseFilePublishConflicts,
  );
  bindRuntimeValue(
    runtime,
    "normalizeFilesPublishError",
    () => normalizeFilesPublishError,
  );
  bindRuntimeValue(
    runtime,
    "FILE_SCOPE_PATH_PATTERN",
    () => FILE_SCOPE_PATH_PATTERN,
    (value) => {
      FILE_SCOPE_PATH_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_FETCH_TIMEOUT_MS",
    () => FILE_FETCH_TIMEOUT_MS,
    (value) => {
      FILE_FETCH_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fileTextDecoder",
    () => fileTextDecoder,
    (value) => {
      fileTextDecoder = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createBrowserFilesPort",
    () => createBrowserFilesPort,
  );
  return () => {
    FILE_LISTING_PATH = "_files.json";
    supportsFilesPublish = (0, runtime.capabilityHasMethod)("publish") as (
      value: unknown,
    ) => value is FilesPublishCapability;
    FILE_PUBLISH_WRITE_REVOKED_CODES = new Set([
      "not_writer",
      "not_declared",
      "capability_disabled",
    ]);
    FILE_PUBLISH_ERROR_CODE_MAP = {
      conflict: "conflict",
      rate_limited: "rate_limited",
      too_large: "too_large",
      not_writer: "not_writer",
      not_declared: "not_declared",
      invalid_content: "invalid_content",
      read_only_path: "read_only_path",
      capability_disabled: "capability_disabled",
      upstream_error: "upstream_error",
      not_granted: "capability_disabled",
      consent_required: "capability_disabled",
      capability_removed: "capability_disabled",
      transform_error: "invalid_content",
    };
    FILE_SHA256_PATTERN = /^[0-9a-f]{64}$/;
    normalizeFileSha256 = (input: unknown) =>
      input === null
        ? null
        : typeof input === "string" && FILE_SHA256_PATTERN.test(input)
          ? input
          : undefined;
    FILE_SCOPE_PATH_PATTERN = /\/_f\/([^/]+)\//;
    FILE_FETCH_TIMEOUT_MS = 1e4;
    fileTextDecoder = new TextDecoder();
  };
}
