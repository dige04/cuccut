/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformDesignFilesPort(
  runtime: RuntimeBindings,
): () => void {
  var ARTIFACT_FILE_LIST_PATH: Dynamic;
  var publishCapabilityName: Dynamic;
  var PUBLISH_ACCESS_ERROR_CODES: Dynamic;
  var PUBLISH_ERROR_CODE_ALIASES: Dynamic;
  var SHA256_PATTERN: Dynamic;
  var normalizeSha256: Dynamic;
  var VERSIONED_ARTIFACT_PATH_PATTERN: Dynamic;
  var FILE_PORT_REQUEST_TIMEOUT_MS: Dynamic;
  var filePortTextDecoder: Dynamic;
  async function resolvePublishCapability(): Promise<Dynamic> {
    return (
      (await (0, runtime.resolveHostCapability)(
        "artifact",
        publishCapabilityName,
      )) ??
      (await (0, runtime.resolveHostCapability)("self", publishCapabilityName))
    );
  }
  function parsePublishedFileHashes(value?: Dynamic): Dynamic {
    if (!Array.isArray(value)) return;
    let entries: Dynamic = [];
    for (let value2 of value as Dynamic) {
      let value3: Dynamic = normalizeSha256(value2?.sha256);
      if (typeof value2?.path != "string" || value3 === undefined) return;
      entries.push({
        path: value2.path,
        sha256: value3,
      });
    }
    return entries;
  }
  function parsePublishConflictHashes(value?: Dynamic): Dynamic {
    if (!Array.isArray(value)) return;
    let entries: Dynamic = [];
    for (let value2 of value as Dynamic) {
      let value3: Dynamic = normalizeSha256(
        "actual" in (value2 ?? {}) ? value2.actual : value2?.liveSha,
      );
      if (typeof value2?.path != "string" || value3 === undefined) return;
      let value4: Dynamic = normalizeSha256(value2.expected);
      entries.push({
        path: value2.path,
        liveSha: value3,
        ...(value4 !== undefined
          ? {
              expected: value4,
            }
          : {}),
      });
    }
    return entries;
  }
  function normalizePublishError_2(error?: Dynamic): Dynamic {
    let record: Dynamic =
        typeof error == "object" && error !== null ? error : {},
      code: Dynamic =
        (typeof record.code == "string"
          ? PUBLISH_ERROR_CODE_ALIASES[record.code]
          : undefined) ?? "upstream_error",
      value: Dynamic =
        typeof record.retryAfterMs == "number"
          ? record.retryAfterMs
          : typeof record.retry_after_ms == "number"
            ? record.retry_after_ms
            : undefined,
      value2: Dynamic = parsePublishConflictHashes(record.paths),
      value3: Dynamic = parsePublishedFileHashes(record.changed);
    return {
      ok: false,
      code: code,
      ...(typeof record.live == "string"
        ? {
            live: record.live,
          }
        : {}),
      ...(value !== undefined
        ? {
            retryAfterMs: value,
          }
        : {}),
      ...(value2 !== undefined
        ? {
            paths: value2,
          }
        : {}),
      ...(value3 !== undefined
        ? {
            changed: value3,
          }
        : {}),
    };
  }
  function createDesignFilesPort(options: Dynamic = {}): Dynamic {
    let fetchFile: Dynamic =
        options.fetch ??
        ((input?: Dynamic): Dynamic => (globalThis as Dynamic).fetch(input)),
      fetchFresh: Dynamic = options.fetchFresh ?? fetchFile,
      useFreshReads: Dynamic = false,
      now: Dynamic = (): Dynamic =>
        (globalThis as Dynamic).performance?.now() ?? Date.now(),
      readResponse: Dynamic = async (input?: Dynamic): Promise<Dynamic> => {
        let value: Dynamic = useFreshReads,
          value2: Dynamic = now();
        try {
          let value3: Dynamic = await (value ? fetchFresh : fetchFile)(input);
          try {
            options.onRead?.(input, now() - value2, value3.status, value);
          } catch {}
          return value3;
        } catch (value3: Dynamic) {
          try {
            options.onRead?.(input, now() - value2, 0, value);
          } catch {}
          throw value3;
        }
      },
      resolvePublisher: Dynamic = options.resolveNs ?? resolvePublishCapability,
      location2: Dynamic = options.location ?? (globalThis as Dynamic).location,
      version: Dynamic = options.bootVersion ?? {
        version:
          VERSIONED_ARTIFACT_PATH_PATTERN.exec(
            location2?.pathname ?? "",
          )?.[1] ?? "",
      },
      canWrite: Dynamic = options.canWrite ?? true,
      bootFiles: Dynamic = options.bootFiles,
      bootNarrowed: Dynamic = options.bootNarrowed === true,
      listingNarrowed: Dynamic = false,
      listing: Dynamic,
      readHashes: Dynamic = new Map(),
      localFiles: Dynamic = new Map(),
      changeListeners: Dynamic = new Set(),
      listenerSequence: Dynamic = 0,
      maxReadCacheEntries: Dynamic = 64,
      readCache: Dynamic = new Map(),
      pendingReads: Dynamic = new Map(),
      publishedBytes: Dynamic = new Map(),
      dirtyPaths: Dynamic = new Set(),
      isChangedLocalFile: Dynamic = (input?: Dynamic): Dynamic => {
        let entry: Dynamic = localFiles.get(input.path);
        return (
          entry !== undefined &&
          !publishingPaths.has(input.path) &&
          (entry === null ? null : entry.sha256) !== input.sha256
        );
      },
      normalizeFileMetadata: Dynamic = (
        input?: Dynamic,
        options2?: Dynamic,
      ): Dynamic =>
        typeof options2?.sha256 == "string"
          ? {
              sha256: options2.sha256,
              size: typeof options2.size == "number" ? options2.size : 0,
              contentType:
                typeof options2.contentType == "string"
                  ? options2.contentType
                  : ((0, runtime.getMimeTypeForPath)(input) ??
                    "application/octet-stream"),
            }
          : undefined;
    async function readListing(): Promise<Dynamic> {
      let entries: Dynamic = new Map();
      if (bootFiles !== undefined) {
        let value3: Dynamic = bootNarrowed,
          value4: Dynamic = Array.isArray(bootFiles)
            ? bootFiles.map((input?: Dynamic): Dynamic => [input.path, input])
            : Object.entries(bootFiles);
        for (let [value5, value6] of value4 as Dynamic) {
          let value7: Dynamic = normalizeFileMetadata(value5, value6);
          value7 && entries.set(value5, value7);
        }
        return {
          files: entries,
          narrowed: value3,
        };
      }
      let value: Dynamic = await readResponse(ARTIFACT_FILE_LIST_PATH);
      if (!value.ok)
        throw {
          code: value.status === 404 ? "not_found" : "http",
          status: value.status,
          message: ARTIFACT_FILE_LIST_PATH + ": HTTP " + String(value.status),
        };
      let value2: Dynamic = await value.json();
      if (
        value2 === null ||
        typeof value2 != "object" ||
        value2.files === null ||
        typeof value2.files != "object" ||
        Array.isArray(value2.files)
      )
        throw {
          code: "http",
          status: value.status,
          malformed: true,
          message: ARTIFACT_FILE_LIST_PATH + ": no files object",
        };
      typeof value2.ver == "string" &&
        version.version === "" &&
        (version = {
          version: value2.ver,
        });
      let files: Dynamic = value2.files;
      for (let [value3, value4] of Object.entries(files) as Dynamic) {
        let value5: Dynamic = normalizeFileMetadata(value3, value4);
        value5 && entries.set(value3, value5);
      }
      return {
        files: entries,
        narrowed: value2.narrowed === true,
      };
    }
    function overlayLocalFileMetadata(input?: Dynamic): Dynamic {
      for (let [value, value2] of localFiles as Dynamic)
        value2 === null
          ? input.delete(value)
          : input.set(value, {
              sha256: value2.sha256,
              size: value2.bytes.length,
              contentType: value2.contentType,
            });
    }
    async function refreshListing(input: Dynamic = false): Promise<Dynamic> {
      let value: Dynamic = listingGeneration;
      input &&
        canWrite &&
        bootNarrowed &&
        ((bootFiles = undefined), (bootNarrowed = false));
      let value2: Dynamic = await readListing();
      if (input && canWrite && value2.narrowed)
        throw {
          code: "http",
          status: 403,
          narrowed: true,
          message: ARTIFACT_FILE_LIST_PATH + ": marked as narrowed",
        };
      let value3: Dynamic = Object.defineProperty(value2.files, "narrowed", {
        value: value2.narrowed,
      });
      overlayLocalFileMetadata(value3);
      value === listingGeneration &&
        !(
          canWrite &&
          value2.narrowed &&
          listing !== undefined &&
          !listingNarrowed
        ) &&
        ((listing = value3),
        (listingNarrowed = value2.narrowed),
        (cachedListingGeneration = listingGeneration));
      return value3;
    }
    let listingRequest: Dynamic,
      deniedListingGeneration: Dynamic = -1;
    function getListing(): Dynamic {
      let value: Dynamic = listingGeneration;
      if (!canWrite && deniedListingGeneration === value)
        return Promise.resolve(undefined);
      if (listingRequest?.at === value) return listingRequest.p;
      let state: Dynamic = {
        at: value,
        p: refreshListing()
          .catch((input?: Dynamic): Dynamic => {
            let value2: Dynamic = input?.status;
            !canWrite &&
              (value2 === 401 || value2 === 403) &&
              (deniedListingGeneration = value);
          })
          .finally((): Dynamic => {
            listingRequest === state && (listingRequest = undefined);
          }),
      };
      listingRequest = state;
      return state.p;
    }
    let addressedVersion: Dynamic = (): Dynamic =>
      VERSIONED_ARTIFACT_PATH_PATTERN.exec(location2?.pathname ?? "")?.[1];
    function rejectWrongVersionRedirect(
      input?: Dynamic,
      options2?: Dynamic,
      context?: Dynamic,
    ): Dynamic {
      if (
        input.redirected !== true ||
        !useFreshReads ||
        !canWrite ||
        context === undefined
      )
        return;
      let value: Dynamic;
      try {
        value = VERSIONED_ARTIFACT_PATH_PATTERN.exec(
          new URL(input.url ?? "", "https://page.invalid").pathname,
        )?.[1];
      } catch {
        value = undefined;
      }
      if (value !== undefined && value !== context)
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
    async function readFileBytes(
      input?: Dynamic,
      options2: Dynamic = false,
    ): Promise<Dynamic> {
      let entry: Dynamic = localFiles.get(input);
      if (entry === null)
        throw {
          code: "not_found",
          status: 404,
          message: input + ": deleted by this tab",
        };
      if (entry !== undefined) {
        readHashes.set(input, entry.sha256);
        return {
          bytes: entry.bytes,
          sha256: entry.sha256,
          contentType: entry.contentType,
          raw: false,
        };
      }
      let entry2: Dynamic = publishedBytes.get(input);
      if (
        entry2 !== undefined &&
        (listing?.get(input)?.sha256 ?? entry2.sha256) === entry2.sha256
      )
        return {
          ...entry2,
          raw: true,
        };
      let value: Dynamic = addressedVersion(),
        [value2, value3]: Dynamic = await Promise.all([
          readResponse((0, runtime.encodePathSegments)(input)),
          listing !== undefined ? Promise.resolve(listing) : getListing(),
        ]);
      options2 || rejectWrongVersionRedirect(value2, input, value);
      if (!value2.ok)
        throw {
          code: value2.status === 404 ? "not_found" : "http",
          status: value2.status,
          message: input + ": HTTP " + String(value2.status),
        };
      let value4: Dynamic = new Uint8Array(await value2.arrayBuffer()),
        value5: Dynamic = value3?.get(input),
        value6: Dynamic = value5?.sha256 ?? "",
        value7: Dynamic =
          value5?.contentType ??
          value2.headers?.get("content-type")?.split(";")[0]?.trim() ??
          (0, runtime.getMimeTypeForPath)(input) ??
          "application/octet-stream";
      return {
        bytes: value4,
        sha256: value6,
        contentType: value7,
        raw: true,
      };
    }
    let closed: Dynamic = false,
      publishingPaths: Dynamic = new Set(),
      publishQueue: Dynamic = Promise.resolve(),
      listingGeneration: Dynamic = 0,
      cachedListingGeneration: Dynamic = 0,
      publishGeneration: Dynamic = 0,
      index: Dynamic = 0;
    function enqueuePublish(input?: Dynamic, options2?: Dynamic): Dynamic {
      let value: Dynamic = publishGeneration,
        value2: Dynamic = publishQueue.then(
          (): Dynamic => publishFiles(input, options2, value),
        );
      publishQueue = value2.catch((): Dynamic => {});
      return value2;
    }
    async function publishFiles(
      input?: Dynamic,
      options2?: Dynamic,
      context?: Dynamic,
    ): Promise<Dynamic> {
      canWrite &&
        (listing === undefined || listingNarrowed) &&
        (await Promise.race([
          refreshListing().catch((): Dynamic => {}),
          new Promise((input2?: Dynamic): Dynamic => {
            setTimeout(input2, FILE_PORT_REQUEST_TIMEOUT_MS);
          }),
        ]));
      if (!canWrite || listingNarrowed)
        return {
          ok: false,
          code: "not_writer",
        };
      let value: Dynamic = (0, runtime.validatePublishFileMap)(input);
      if (value) return value;
      if (context !== publishGeneration && options2?.ifMatch !== undefined)
        return {
          ok: false,
          code: "conflict",
          live: version.version,
        };
      let value2: Dynamic = await resolvePublisher();
      if (value2 === null) {
        canWrite = false;
        return {
          ok: false,
          code: "capability_disabled",
        };
      }
      let value3: Dynamic = Object.keys(input).flatMap(
        (input2?: Dynamic): Dynamic => {
          let entry: Dynamic = localFiles.get(input2),
            value12: Dynamic =
              options2?.ifMatch !== undefined &&
              Object.hasOwn(options2.ifMatch, input2)
                ? options2.ifMatch[input2]
                : undefined,
            value13: Dynamic =
              entry === undefined
                ? undefined
                : entry === null
                  ? null
                  : entry.sha256;
          return value12 === undefined ||
            value13 === undefined ||
            publishingPaths.has(input2) ||
            value12 === value13
            ? []
            : [
                {
                  path: input2,
                  liveSha: value13,
                  expected: value12,
                },
              ];
        },
      );
      if (value3.length > 0)
        return {
          ok: false,
          code: "conflict",
          live: version.version,
          paths: value3,
        };
      let state: Dynamic = {};
      for (let [value12, value13] of Object.entries(input) as Dynamic)
        state[value12] = (0, runtime.normalizeFileEntry)(value12, value13);
      let state2: Dynamic = {},
        items: Dynamic = [],
        value4: Dynamic =
          options.preconditions === undefined
            ? {
                writes: true,
                deletes: true,
              }
            : options.preconditions === false
              ? {}
              : options.preconditions,
        value5: Dynamic = value4.writes === true,
        value6: Dynamic = value5 && value4.deletes === true;
      for (let [value12, value13] of Object.entries(state) as Dynamic) {
        let value14: Dynamic =
            options2?.ifMatch !== undefined &&
            Object.hasOwn(options2.ifMatch, value12)
              ? options2.ifMatch[value12]
              : undefined,
          value15: Dynamic = value14;
        typeof value15 == "string" &&
          publishingPaths.has(value12) &&
          localFiles.get(value12)?.sha256 === value15 &&
          (value15 = undefined);
        typeof value15 == "string" &&
          !SHA256_PATTERN.test(value15) &&
          (value15 = undefined);
        value13 !== null
          ? (state2[value12] =
              value5 && value15 !== undefined
                ? {
                    ...value13,
                    ifMatch: value15,
                  }
                : value13)
          : (state2[value12] =
              value6 && closed && typeof value15 == "string"
                ? {
                    delete: true,
                    ifMatch: value15,
                  }
                : null);
        let value16: Dynamic = state2[value12];
        value14 !== undefined &&
          (value16 == null || !("ifMatch" in value16)) &&
          items.push(value12);
      }
      let entries: Dynamic = new Map();
      for (let [value12, value13] of Object.entries(state) as Dynamic)
        if (value13 !== null) {
          let value14: Dynamic = await (0, runtime.fileContentToBytes)(
            value13.content,
          );
          entries.set(value12, {
            bytes: value14,
            hash: await (0, runtime.sha256)(value14),
          });
        }
      if (context !== publishGeneration && options2?.ifMatch !== undefined)
        return {
          ok: false,
          code: "conflict",
          live: version.version,
        };
      let version2: Dynamic = version.version,
        value7: Dynamic = index,
        value8: Dynamic;
      try {
        value8 = await value2.publish(state2);
      } catch (value12: Dynamic) {
        try {
          options.onPublishError?.(value12);
        } catch {}
        let value13: Dynamic = normalizePublishError_2(value12);
        PUBLISH_ACCESS_ERROR_CODES.has(value13.code) && (canWrite = false);
        return value13;
      }
      let state3: Dynamic = {},
        value9: Dynamic = index !== value7,
        items2: Dynamic = [];
      for (let [value12, value13] of Object.entries(state) as Dynamic) {
        if (value13 === null) {
          readHashes.set(value12, null);
          value9 ||
            (localFiles.set(value12, null),
            listing?.delete(value12),
            publishingPaths.delete(value12));
          continue;
        }
        let { bytes: entry, hash: entry2 }: Dynamic = entries.get(value12),
          value14: Dynamic = value8.shas?.[value12],
          value15: Dynamic = value14 ?? entry2;
        value14 === undefined && items2.push(value12);
        state3[value12] = value15;
        readHashes.set(value12, value15);
        !value9 &&
          (value14 === undefined && (0, runtime.hasInjectedRuntime)(value13)
            ? publishingPaths.add(value12)
            : publishingPaths.delete(value12),
          localFiles.set(value12, {
            sha256: value15,
            bytes: entry,
            contentType: value13.contentType,
          }),
          listing?.set(value12, {
            sha256: value15,
            size: entry.length,
            contentType: value13.contentType,
          }));
      }
      bootFiles = undefined;
      value9 ||
        (version = {
          version: value8.version,
          ...(typeof value8.seq == "number"
            ? {
                seq: value8.seq,
              }
            : {}),
        });
      let value10: Dynamic =
        value8.shas !== undefined &&
        value8.shas !== null &&
        typeof value8.shas == "object" &&
        !Array.isArray(value8.shas);
      value10 && (closed = true);
      let value11: Dynamic = parsePublishedFileHashes(value8.changed);
      !(value11 !== undefined
        ? value11.length > 0
        : value10 && items.length === 0) &&
        !value9 &&
        value8.unchanged !== true &&
        value8.version !== version2 &&
        changeListeners.add(value8.version);
      listenerSequence += 1;
      value8.unchanged !== true &&
        value8.version !== version2 &&
        (readCache.set(value8.version, listenerSequence),
        readCache.size > maxReadCacheEntries &&
          readCache.delete(readCache.keys().next().value));
      for (let value12 of Object.keys(state) as Dynamic)
        pendingReads.set(value12, listenerSequence);
      return {
        ok: true,
        version: value8.version,
        ...(typeof value8.seq == "number"
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
      input?: Dynamic,
      options2?: Dynamic,
    ): Promise<Dynamic> {
      let value: Dynamic = await readFileBytes(input, options2),
        value2: Dynamic = filePortTextDecoder.decode(value.bytes);
      value.raw &&
        (0, runtime.isHtmlPath)(input) &&
        (value2 = (0, runtime.stripFrameRuntime)(value2));
      let value3: Dynamic =
        value.sha256 !== "" ? value.sha256 : await (0, runtime.sha256)(value2);
      readHashes.set(input, value3);
      return {
        text: value2,
        sha256: value3,
      };
    }
    let callback: Dynamic = (input?: Dynamic): Dynamic => {
      let value: Dynamic = [...input]
        .sort(
          ([input2]: Dynamic, [options2]: Dynamic): Dynamic =>
            input2 < options2 ? -1 : 1,
        )
        .map(
          ([input2, input3]: Dynamic): Dynamic => ({
            path: input2,
            ...input3,
            ...(publishingPaths.has(input2) &&
            localFiles.get(input2)?.sha256 === input3.sha256
              ? {
                  provisional: true,
                }
              : {}),
          }),
        );
      return Object.defineProperty(value, "narrowed", {
        value: input.narrowed === true,
      });
    };
    return {
      get canWrite(): Dynamic {
        return canWrite && !listingNarrowed;
      },
      get narrowed(): Dynamic {
        return listingNarrowed;
      },
      get mayWrite(): Dynamic {
        return canWrite;
      },
      forgetBootListing(): Dynamic {
        bootFiles = undefined;
        bootNarrowed = false;
      },
      async listUnlessNarrowed(): Promise<Dynamic> {
        return callback(await refreshListing(true));
      },
      version: (): Dynamic => version,
      async list(): Promise<Dynamic> {
        return callback(await refreshListing());
      },
      async readBytes(input: Dynamic): Promise<Dynamic> {
        let value: Dynamic = await readFileBytes(input),
          value2: Dynamic =
            value.sha256 !== ""
              ? value.sha256
              : await (0, runtime.sha256)(value.bytes);
        readHashes.set(input, value2);
        return {
          bytes: value.bytes,
          sha256: value2,
          contentType: value.contentType,
        };
      },
      async peekBytes(input: Dynamic): Promise<Dynamic> {
        let callback2: Dynamic = (): Dynamic => {
            let entry2: Dynamic = localFiles.get(input);
            if (entry2 === null)
              throw {
                code: "not_found",
                status: 404,
                message: input + ": deleted by this tab",
              };
            return entry2 === undefined
              ? undefined
              : {
                  bytes: entry2.bytes.slice(),
                  ...(publishingPaths.has(input)
                    ? {}
                    : {
                        sha256: entry2.sha256,
                      }),
                  contentType: entry2.contentType,
                };
          },
          value: Dynamic = callback2();
        if (value !== undefined) return value;
        let entry: Dynamic = publishedBytes.get(input);
        if (
          entry !== undefined &&
          (listing?.get(input)?.sha256 ?? entry.sha256) === entry.sha256
        )
          return {
            bytes: entry.bytes.slice(),
            sha256: entry.sha256,
            contentType: entry.contentType,
          };
        let value2: Dynamic = listingGeneration,
          value3: Dynamic = listing?.get(input)?.sha256,
          value4: Dynamic = addressedVersion(),
          value5: Dynamic = await readResponse(
            (0, runtime.encodePathSegments)(input),
          );
        rejectWrongVersionRedirect(value5, input, value4);
        if (!value5.ok)
          throw {
            code: value5.status === 404 ? "not_found" : "http",
            status: value5.status,
            message: input + ": HTTP " + String(value5.status),
          };
        let value6: Dynamic = new Uint8Array(await value5.arrayBuffer()),
          value7: Dynamic = callback2();
        if (value7 !== undefined) return value7;
        let value8: Dynamic = listing?.get(input),
          value9: Dynamic =
            value2 === listingGeneration &&
            cachedListingGeneration === listingGeneration &&
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
            (0, runtime.getMimeTypeForPath)(input) ??
            "application/octet-stream",
        };
      },
      peekRows: (): Dynamic =>
        listing === undefined ? undefined : callback(listing),
      readText: (input?: Dynamic): Dynamic => readFileText(input, false),
      readTextUnchecked: (input?: Dynamic): Dynamic =>
        readFileText(input, true),
      publish: enqueuePublish,
      onRemoteChange(input: Dynamic): Dynamic {
        dirtyPaths.add(input);
        return (): Dynamic => {
          dirtyPaths.delete(input);
        };
      },
      liveSha: (input?: Dynamic): Dynamic => {
        if (listing === undefined) return localFiles.get(input)?.sha256;
        let value: Dynamic = listing.get(input)?.sha256;
        return value === ""
          ? undefined
          : (value ?? (listingNarrowed ? undefined : null));
      },
      heldSha: (input?: Dynamic): Dynamic => readHashes.get(input),
      olderThanMyWrite: (input?: Dynamic, options2?: Dynamic): Dynamic => {
        let entry: Dynamic = readCache.get(input),
          entry2: Dynamic = pendingReads.get(options2);
        return entry !== undefined && entry2 !== undefined && entry2 > entry;
      },
      wroteSinceAdopt: (input?: Dynamic): Dynamic =>
        localFiles.get(input) !== undefined && localFiles.get(input) !== null,
      knownListing: (): Dynamic =>
        new Map(
          [...(listing ?? [])].map(
            ([input, input2]: Dynamic): Dynamic => [input, input2.sha256],
          ),
        ),
      primeRead(input: Dynamic, options2: Dynamic): Dynamic {
        localFiles.has(input) ||
          (publishedBytes.set(input, options2),
          listing !== undefined &&
            options2.sha256 !== "" &&
            listing.set(input, {
              sha256: options2.sha256,
              size: options2.bytes.length,
              contentType: options2.contentType,
            }));
      },
      noteIncoming(input: Dynamic): Dynamic {
        for (let value of input as Dynamic)
          if (!isChangedLocalFile(value)) {
            if (value.sha256 === null) {
              readHashes.delete(value.path);
              publishedBytes.delete(value.path);
              listing?.delete(value.path);
              continue;
            }
            if (listing !== undefined) {
              let entry: Dynamic = listing.get(value.path);
              entry?.sha256 !== value.sha256 &&
                listing.set(value.path, {
                  sha256: value.sha256,
                  size: 0,
                  contentType:
                    entry?.contentType ??
                    (0, runtime.getMimeTypeForPath)(value.path) ??
                    "application/octet-stream",
                });
            }
          }
        cachedListingGeneration = listingGeneration;
      },
      noteAdopted(input: Dynamic): Dynamic {
        useFreshReads = true;
        listingGeneration += 1;
        changeListeners.has(input.version) &&
          cachedListingGeneration === listingGeneration - 1 &&
          (cachedListingGeneration = listingGeneration);
        publishedBytes.clear();
        bootFiles = undefined;
        if (!changeListeners.has(input.version)) {
          let entry: Dynamic = readCache.get(input.version);
          for (let [value, value2] of [...localFiles] as Dynamic)
            (entry !== undefined && (pendingReads.get(value) ?? 0) > entry) ||
              (listing !== undefined &&
                value2 !== null &&
                listing.set(value, {
                  sha256: "",
                  size: listing.get(value)?.size ?? 0,
                  contentType:
                    listing.get(value)?.contentType ??
                    (0, runtime.getMimeTypeForPath)(value) ??
                    "application/octet-stream",
                }),
              localFiles.delete(value),
              publishingPaths.delete(value));
          if (entry !== undefined && listing !== undefined)
            for (let [value, value2] of pendingReads as Dynamic)
              value2 >= entry &&
                !localFiles.has(value) &&
                listing.has(value) &&
                listing.set(value, {
                  sha256: "",
                  size: listing.get(value)?.size ?? 0,
                  contentType:
                    listing.get(value)?.contentType ??
                    (0, runtime.getMimeTypeForPath)(value) ??
                    "application/octet-stream",
                });
          for (let value of [...changeListeners] as Dynamic)
            (entry === undefined || (readCache.get(value) ?? 0) <= entry) &&
              changeListeners.delete(value);
          publishGeneration += 1;
          entry === undefined && (index += 1);
        }
        version = input;
      },
      noteRemote(input: Dynamic): Dynamic {
        let value: Dynamic = input.changed.filter(
          (input2?: Dynamic): Dynamic => isChangedLocalFile(input2) === false,
        );
        for (let value3 of value as Dynamic)
          if (listing !== undefined)
            if (value3.sha256 === null) listing.delete(value3.path);
            else {
              let entry: Dynamic = listing.get(value3.path);
              listing.set(value3.path, {
                sha256: value3.sha256,
                size: entry?.sha256 === value3.sha256 ? entry.size : 0,
                contentType:
                  entry?.contentType ??
                  (0, runtime.getMimeTypeForPath)(value3.path) ??
                  "application/octet-stream",
              });
            }
        let value2: Dynamic =
          value.length === input.changed.length
            ? input
            : {
                ...input,
                changed: value,
              };
        for (let value3 of [...dirtyPaths] as Dynamic)
          try {
            value3(value2);
          } catch {}
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "ARTIFACT_FILE_LIST_PATH",
    () => ARTIFACT_FILE_LIST_PATH,
    (value) => {
      ARTIFACT_FILE_LIST_PATH = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "publishCapabilityName",
    () => publishCapabilityName,
    (value) => {
      publishCapabilityName = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "resolvePublishCapability",
    () => resolvePublishCapability,
  );
  bindRuntimeValue(
    runtime,
    "PUBLISH_ACCESS_ERROR_CODES",
    () => PUBLISH_ACCESS_ERROR_CODES,
    (value) => {
      PUBLISH_ACCESS_ERROR_CODES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "PUBLISH_ERROR_CODE_ALIASES",
    () => PUBLISH_ERROR_CODE_ALIASES,
    (value) => {
      PUBLISH_ERROR_CODE_ALIASES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "SHA256_PATTERN",
    () => SHA256_PATTERN,
    (value) => {
      SHA256_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeSha256",
    () => normalizeSha256,
    (value) => {
      normalizeSha256 = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "parsePublishedFileHashes",
    () => parsePublishedFileHashes,
  );
  bindRuntimeValue(
    runtime,
    "parsePublishConflictHashes",
    () => parsePublishConflictHashes,
  );
  bindRuntimeValue(
    runtime,
    "normalizePublishError_2",
    () => normalizePublishError_2,
  );
  bindRuntimeValue(
    runtime,
    "VERSIONED_ARTIFACT_PATH_PATTERN",
    () => VERSIONED_ARTIFACT_PATH_PATTERN,
    (value) => {
      VERSIONED_ARTIFACT_PATH_PATTERN = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_PORT_REQUEST_TIMEOUT_MS",
    () => FILE_PORT_REQUEST_TIMEOUT_MS,
    (value) => {
      FILE_PORT_REQUEST_TIMEOUT_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "filePortTextDecoder",
    () => filePortTextDecoder,
    (value) => {
      filePortTextDecoder = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "createDesignFilesPort",
    () => createDesignFilesPort,
  );
  return () => {
    ARTIFACT_FILE_LIST_PATH = "_files.json";
    publishCapabilityName = (0, runtime.hasCapabilityMethod)("publish");
    PUBLISH_ACCESS_ERROR_CODES = new Set([
      "not_writer",
      "not_declared",
      "capability_disabled",
    ]);
    PUBLISH_ERROR_CODE_ALIASES = {
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
    SHA256_PATTERN = /^[0-9a-f]{64}$/;
    normalizeSha256 = (input?: Dynamic): Dynamic =>
      input === null
        ? null
        : typeof input == "string" && SHA256_PATTERN.test(input)
          ? input
          : undefined;
    VERSIONED_ARTIFACT_PATH_PATTERN = /\/_f\/([^/]+)\//;
    FILE_PORT_REQUEST_TIMEOUT_MS = 1e4;
    filePortTextDecoder = new TextDecoder();
  };
}
