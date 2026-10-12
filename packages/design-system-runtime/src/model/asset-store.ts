import type * as Storage from "../contracts/model-storage";
import type * as Model from "../contracts";
import type * as Host from "../contracts/platform-host";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installModelAssetStore(runtime: RuntimeBindings): () => void {
  var assetsCapabilityPromise: Promise<Storage.AssetsCapability | null> | null;
  var assetsTierState: Storage.AssetsTierState | null;
  var assetsStateSubscribers: Set<() => void>;
  var assetsCatalogState: Storage.AssetsCatalogueState;
  var assetDeletionUnavailable: boolean;
  var ASSET_RECLAIM_GRACE_PERIOD_MS: number;
  var ASSET_RATE_LIMIT_RETRY_MS: number;
  var ASSET_STORE_RETRY_MS: number;
  var waitAssetRetry: (delay: number) => Promise<void>;
  var recentOrphanedAssets: Storage.OrphanedAsset[];
  var INLINE_STORAGE_UNAVAILABLE_DESCRIPTION: string;
  var RECLAIM_SAVE_FIRST_MESSAGE: string;
  var RECLAIM_SAVING_MESSAGE: string;
  var RECLAIM_NOTHING_UNUSED_MESSAGE: string;
  var RECLAIM_LIST_FAILED_MESSAGE: string;
  var RECLAIM_RECONNECTING_MESSAGE: string;
  var RECLAIM_WINDOWED_COLLECTION_MESSAGE: string;
  function assetCapabilityRuntime(): Storage.AssetSdk | undefined {
    // CucCut: the host is globalThis.designSystemHost (packages/design-system/src/editor/design-system-host.ts), not globalThis.claude.
    let runtime2 = globalThis as typeof globalThis & {
      designSystemHost?: Storage.AssetSdk;
      window?: Window & { designSystemHost?: Storage.AssetSdk };
    };
    return runtime2.designSystemHost ?? runtime2.window?.designSystemHost;
  }
  function eagerAssetsCapability(): Storage.AssetsCapability | null {
    let assets = assetCapabilityRuntime()?.assets;
    if (
      typeof assets === "object" &&
      assets !== null &&
      typeof assets.upload === "function"
    ) {
      return assets as Storage.AssetsCapability;
    } else {
      return null;
    }
  }
  function assetCapabilityRequester():
    | ((name: string) => Promise<unknown>)
    | null {
    let runtime2 = assetCapabilityRuntime(),
      use = runtime2?.use;
    if (typeof use === "function") {
      return (input: string) => Promise.resolve(use.call(runtime2, input));
    } else {
      return null;
    }
  }
  function resolveAssetsCapability(): Promise<Storage.AssetsCapability | null> {
    let assets = eagerAssetsCapability();
    if (assets !== null) {
      return Promise.resolve(assets);
    }
    if (assetsCapabilityPromise !== null) {
      return assetsCapabilityPromise!;
    }
    let use = assetCapabilityRequester();
    if (use === null) {
      return Promise.resolve(null);
    }
    assetsCapabilityPromise = use("assets").then(
      (input: unknown) => {
        let value =
          typeof input === "object" &&
          input !== null &&
          (input as Storage.DatabaseRecord).available !== false &&
          typeof (input as Storage.DatabaseRecord).upload === "function"
            ? (input as Storage.AssetsCapability)
            : null;
        if (value === null) {
          setAssetsTierState("off", "absent");
        }
        return value;
      },
      (): null => {
        setAssetsTierState("off", "absent");
        return null;
      },
    );
    return assetsCapabilityPromise!;
  }
  function notifyAssetsStateSubscribers(): void {
    for (let value of assetsStateSubscribers) {
      value();
    }
  }
  function getAssetsTierState(): Storage.AssetsTierState {
    if (assetsTierState !== null) {
      return assetsTierState;
    }
    if (
      eagerAssetsCapability() === null &&
      assetCapabilityRequester() === null
    ) {
      return {
        state: "off",
        why: "absent",
      };
    } else {
      return {
        state: "untried",
        why: null,
      };
    }
  }
  function setAssetsTierState(
    state: Storage.AssetsTierState["state"],
    why: string | null = null,
  ): boolean {
    let previous = getAssetsTierState();
    if (
      assetsTierState !== null &&
      assetsTierState.state === "off" &&
      state !== "off"
    ) {
      return false;
    }
    if (
      assetsTierState !== null &&
      previous.state === state &&
      previous.why === why
    ) {
      return false;
    }
    assetsTierState = {
      state: state,
      why: state === "off" ? why : null,
    };
    notifyAssetsStateSubscribers();
    return state === "off" && previous.state !== "off";
  }
  function subscribeAssetsState(subscriber: () => void): () => void {
    assetsStateSubscribers.add(subscriber);
    return () => assetsStateSubscribers.delete(subscriber);
  }
  function getAssetsCatalogState(): Storage.AssetsCatalogueState {
    return assetsCatalogState;
  }
  function listedAssetIds(): Set<string> | null {
    if (assetsCatalogState.state === "listed") {
      return new Set(assetsCatalogState.byId.keys());
    } else {
      return null;
    }
  }
  function assetCatalogUsage(
    byId: ReadonlyMap<string, Storage.ListedAsset>,
    limits: { maxFiles: number; maxBytes: number },
  ): Storage.AssetUsage {
    let bytes = 0;
    for (let value of byId.values()) {
      bytes += value.sizeBytes;
    }
    return {
      files: byId.size,
      bytes: bytes,
      maxFiles: limits.maxFiles,
      maxBytes: limits.maxBytes,
    };
  }
  function nonnegativeIntegerOrFallback(
    value: unknown,
    fallback: number,
  ): number {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      return Math.floor(value);
    } else {
      return fallback;
    }
  }
  function parseAssetsListResponse(
    input: unknown,
  ): Storage.AssetsCatalogueState {
    let response = input as Storage.DatabaseRecord | null;
    if (
      typeof response !== "object" ||
      response === null ||
      !Array.isArray(response.assets)
    ) {
      return {
        state: "unavailable",
        code: "upstream_error",
      };
    }
    let byId = new Map<string, Storage.ListedAsset>();
    for (let value of response.assets as readonly unknown[]) {
      if (typeof value !== "object" || value === null) {
        continue;
      }
      let value2 = value as Storage.DatabaseRecord;
      if (
        typeof value2.id !== "string" ||
        !runtime.BLOB_ID_PATTERN.test(value2.id)
      ) {
        continue;
      }
      byId.set(value2.id, {
        id: value2.id,
        url: typeof value2.url === "string" ? value2.url : "_blob/" + value2.id,
        contentType:
          typeof value2.contentType === "string" ? value2.contentType : "",
        sizeBytes: nonnegativeIntegerOrFallback(value2.sizeBytes, 0),
        createdAt: typeof value2.createdAt === "string" ? value2.createdAt : "",
      });
    }
    let usage =
        typeof response.usage === "object" && response.usage !== null
          ? (response.usage as Storage.DatabaseRecord)
          : {},
      computedUsage = assetCatalogUsage(byId, {
        maxFiles: nonnegativeIntegerOrFallback(
          usage.maxFiles,
          runtime.BLOB_STORAGE_LIMITS.files,
        ),
        maxBytes: nonnegativeIntegerOrFallback(
          usage.maxBytes,
          runtime.BLOB_STORAGE_LIMITS.total,
        ),
      });
    return {
      state: "listed",
      byId: byId,
      usage: {
        ...computedUsage,
        files: nonnegativeIntegerOrFallback(usage.files, computedUsage.files),
        bytes: nonnegativeIntegerOrFallback(usage.bytes, computedUsage.bytes),
      },
    };
  }
  async function refreshAssetsCatalog(
    providedAssets?: Pick<Storage.AssetsCapability, "list"> | null,
  ): Promise<Storage.AssetsCatalogueState> {
    let assets =
      providedAssets === undefined
        ? await resolveAssetsCapability()
        : providedAssets;
    if (assets === null) {
      assetsCatalogState = {
        state: "unavailable",
        code: "not_granted",
      };
      notifyAssetsStateSubscribers();
      return assetsCatalogState;
    }
    try {
      assetsCatalogState = parseAssetsListResponse(await assets.list());
    } catch (value: unknown) {
      let value2 = assetErrorCode(value);
      if (
        value2 === "not_granted" ||
        value2 === "capability_disabled" ||
        value2 === "capability_removed"
      ) {
        assetDeletionUnavailable = true;
      }
      if (
        assetsCatalogState.state !== "listed" ||
        (value2 !== "rate_limited" && value2 !== "store_unavailable")
      ) {
        assetsCatalogState = {
          state: "unavailable",
          code: value2,
        };
      }
    }
    notifyAssetsStateSubscribers();
    return assetsCatalogState;
  }
  function addCatalogAsset(asset: Storage.ListedAsset): void {
    if (assetsCatalogState.state !== "listed") {
      return;
    }
    let byId = new Map(assetsCatalogState.byId);
    byId.set(asset.id, asset);
    assetsCatalogState = {
      state: "listed",
      byId: byId,
      usage: assetCatalogUsage(byId, assetsCatalogState.usage),
    };
    notifyAssetsStateSubscribers();
  }
  function removeCatalogAssets(ids: ReadonlySet<string>): void {
    if (assetsCatalogState.state !== "listed" || ids.size === 0) {
      return;
    }
    let byId = new Map(assetsCatalogState.byId);
    for (let value of ids) {
      byId.delete(value);
    }
    assetsCatalogState = {
      state: "listed",
      byId: byId,
      usage: assetCatalogUsage(byId, assetsCatalogState.usage),
    };
    notifyAssetsStateSubscribers();
  }
  function blobIdsInFileText(files: Model.FileTable): Set<string> {
    let ids = new Set<string>();
    for (let value of Object.keys(files)) {
      for (let value2 of files[value].matchAll(
        /(?:_blob\\?\/|read(?:_asset)?[\s\u0060]+)([A-Za-z0-9_-]{8,})/g,
      )) {
        for (
          let count: number = 8, value3 = value2[1];
          count <= Math.min(value3.length, 64);
          count++
        ) {
          ids.add(value3.slice(0, count));
        }
      }
    }
    return ids;
  }
  function assessAssetReclamation(
    files: Model.FileTable,
    preservedIds: ReadonlySet<string> = new Set(),
  ): Storage.AssetReclamation | null {
    if (assetsCatalogState.state !== "listed") {
      return null;
    }
    let comparison = (0, runtime.compareReferencedAndStoredBlobs)(
        files,
        new Set(assetsCatalogState.byId.keys()),
      ),
      orphanIds = new Set(getRecentOrphanedAssets().map((input) => input.id)),
      windowed = (0, runtime.isSystemCollectionWindowed)(),
      now: number = Date.now(),
      isRecent = (input: string) => {
        let value = Date.parse(
          assetsCatalogState.state === "listed"
            ? (assetsCatalogState.byId.get(input)?.createdAt ?? "")
            : "",
        );
        return (
          Number.isFinite(value) && now - value < ASSET_RECLAIM_GRACE_PERIOD_MS
        );
      },
      candidates = windowed
        ? []
        : comparison.unreferenced.filter(
            (input) =>
              !orphanIds.has(input) &&
              !preservedIds.has(input) &&
              !isRecent(input),
          ),
      retainedIds =
        candidates.length > 0
          ? new Set([
              ...(0, runtime.retainedRemoteTextBlobIds)(),
              ...blobIdsInFileText(files),
            ])
          : new Set(),
      reclaimable = candidates
        .filter((input): boolean => !retainedIds.has(input))
        .map((input) => ({
          id: input,
          bytes:
            assetsCatalogState.state === "listed"
              ? (assetsCatalogState.byId.get(input)?.sizeBytes ?? 0)
              : 0,
        })),
      missing = comparison.missing.filter((input) => {
        let value = (0, runtime.storagePointerForFile)(input, files[input]);
        return (
          value === null || value.store !== "blob" || !orphanIds.has(value.id)
        );
      }),
      missingIds = new Set(
        comparison.missingIds.filter((input): boolean => !orphanIds.has(input)),
      );
    return {
      missing: missing,
      missingIds: missingIds,
      reclaimable: reclaimable,
      reclaimableBytes: reclaimable.reduce(
        (input, options) => input + options.bytes,
        0,
      ),
      windowed: windowed,
    };
  }
  function missingStoredBlobIds(files: Model.FileTable): Set<string> {
    return assessAssetReclamation(files)?.missingIds ?? new Set();
  }
  function formatAssetBytes(bytes: number): string {
    if (bytes >= runtime.MEBIBYTE) {
      return (
        (bytes / runtime.MEBIBYTE)
          .toFixed(bytes >= 10 * runtime.MEBIBYTE ? 0 : 1)
          .replace(/\.0$/, "") + " MB"
      );
    } else {
      return String(Math.max(1, Math.ceil(bytes / runtime.KIBIBYTE))) + " KB";
    }
  }
  function uploadFailureKind(code: string): Storage.AssetUploadFailureKind {
    switch (code) {
      case "not_granted":
        return "not-granted";
      case "capability_disabled":
      case "capability_removed":
        return "tier-off";
      case "unsupported_type":
        return "inline-if-fits";
      case "too_large":
        return "too-large";
      case "quota_or_state":
        return "quota";
      case "rate_limited":
        return "backoff";
      case "store_unavailable":
        return "retry-once";
      case "upstream_auth":
        return "reload";
      default:
        return "error";
    }
  }
  function assetErrorCode(error: unknown): string {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      typeof error.code === "string"
    ) {
      return error.code;
    }
    return "upstream_error";
  }
  async function uploadAssetWithRetry(
    assets: Pick<Storage.AssetsCapability, "upload">,
    blob: Blob,
    mime: string,
    options: Storage.AssetRetryOptions = {},
  ): Promise<Storage.StoredAssetUploadResult> {
    let sleep = options.sleep ?? waitAssetRetry,
      retriedUnavailable: boolean = false,
      retriedRateLimit: boolean = false;
    for (;;) {
      try {
        let value = (await assets.upload(blob, {
          type: mime,
        })) as Storage.DatabaseRecord | null;
        if (
          typeof value !== "object" ||
          value === null ||
          typeof value.id !== "string" ||
          !runtime.BLOB_ID_PATTERN.test(value.id)
        ) {
          return {
            ok: false,
            kind: "error",
            code: "upstream_error",
          };
        }
        let value2 =
            typeof value.url === "string" && value.url.startsWith("blob:")
              ? value.url
              : undefined,
          value3 =
            typeof value.sizeBytes === "number" &&
            Number.isFinite(value.sizeBytes) &&
            value.sizeBytes > 0
              ? Math.floor(value.sizeBytes)
              : blob.size,
          value4 =
            typeof value.contentType === "string" && value.contentType !== ""
              ? value.contentType
              : mime;
        addCatalogAsset({
          id: value.id,
          url: typeof value.url === "string" ? value.url : "_blob/" + value.id,
          contentType: value4,
          sizeBytes: value3,
          createdAt: (options.now ?? (() => new Date().toISOString()))(),
        });
        return {
          ok: true,
          id: value.id,
          bytes: value3,
          type: value4,
          ...(value2 !== undefined
            ? {
                url: value2,
              }
            : {}),
        };
      } catch (value: unknown) {
        let value2 = assetErrorCode(value),
          value3 = uploadFailureKind(value2);
        if (value3 === "retry-once" && !retriedUnavailable) {
          retriedUnavailable = true;
          options.onWait?.(ASSET_STORE_RETRY_MS, "store_unavailable");
          await sleep(ASSET_STORE_RETRY_MS);
          continue;
        }
        if (value3 === "backoff" && !retriedRateLimit) {
          retriedRateLimit = true;
          options.onWait?.(ASSET_RATE_LIMIT_RETRY_MS, "rate_limited");
          await sleep(ASSET_RATE_LIMIT_RETRY_MS);
          continue;
        }
        return {
          ok: false,
          kind: value3 === "retry-once" ? "error" : value3,
          code: value2,
        };
      }
    }
  }
  function rememberOrphanedAsset(asset: Storage.OrphanedAsset): void {
    recentOrphanedAssets = [
      ...recentOrphanedAssets.filter((input): boolean => input.id !== asset.id),
      asset,
    ].slice(-2000);
  }
  function getRecentOrphanedAssets(): readonly Storage.OrphanedAsset[] {
    return recentOrphanedAssets;
  }
  async function deleteStoredAssets(
    assetsToDelete: readonly Storage.OrphanedAsset[],
    providedAssets?: Pick<Storage.AssetsCapability, "delete"> | null,
    options: Storage.AssetRetryOptions = {},
  ): Promise<Storage.AssetDeletionResult> {
    let result: Storage.AssetDeletionResult = {
        freed: new Map(),
        unavailable: false,
        rateLimited: false,
        kept: [],
      },
      assets =
        providedAssets === undefined
          ? await resolveAssetsCapability()
          : providedAssets;
    if (assets === null) {
      assetDeletionUnavailable = true;
      notifyAssetsStateSubscribers();
      return {
        ...result,
        unavailable: true,
      };
    }
    let sleep = options.sleep ?? waitAssetRetry;
    for (let value of assetsToDelete) {
      let flag: boolean = false;
      for (;;) {
        try {
          await assets.delete(value.id);
          result.freed.set(value.id, value.bytes);
          break;
        } catch (value2: unknown) {
          let value3 = assetErrorCode(value2);
          if (value3 === "store_unavailable" && !flag) {
            flag = true;
            await sleep(ASSET_STORE_RETRY_MS);
            continue;
          }
          if (
            value3 === "capability_removed" ||
            value3 === "capability_disabled" ||
            value3 === "not_granted"
          ) {
            assetDeletionUnavailable = true;
            result.unavailable = true;
          } else if (value3 === "rate_limited") {
            result.rateLimited = true;
          } else {
            result.kept.push(value.id);
          }
          break;
        }
      }
      if (result.unavailable || result.rateLimited) {
        break;
      }
    }
    removeCatalogAssets(new Set(result.freed.keys()));
    return result;
  }
  async function publishedPageBlobIds(
    options: Storage.PublishedAssetProbe = {},
  ): Promise<Set<string> | null> {
    let url =
      options.url ??
      (typeof location !== "undefined" && /^https?:/.test(location.href)
        ? location.href.split("#")[0]
        : undefined);
    if (url === undefined) {
      return null;
    }
    let html = await (
      options.fetchText ??
      (async (input: string): Promise<string | null> => {
        try {
          let value = await fetch(input, {
            cache: "no-store",
            credentials: "same-origin",
          });
          if (value.ok) {
            return await value.text();
          } else {
            return null;
          }
        } catch {
          return null;
        }
      })
    )(url);
    if (html === null) {
      return null;
    }
    let embeddedJson = extractPublishedDocumentJson(html);
    if (embeddedJson === null) {
      return null;
    }
    try {
      let value: unknown = (
        JSON.parse(embeddedJson) as
          | { content?: { files?: unknown } }
          | null
          | undefined
      )?.content?.files;
      if (typeof value !== "object" || value === null) {
        return null;
      }
      let state: Record<string, string> = {};
      for (let [value2, value3] of Object.entries(value) as [
        string,
        unknown,
      ][]) {
        if (typeof value3 === "string") {
          state[value2] = value3;
        }
      }
      return new Set([
        ...(0, runtime.referencedBlobIds)(state),
        ...blobIdsInFileText(state),
      ]);
    } catch {
      return null;
    }
  }
  function extractPublishedDocumentJson(html: string): string | null {
    let scriptStart = html.indexOf(
      '<script type="application/json" id="appifact-doc">',
    );
    if (scriptStart < 0) {
      return null;
    }
    let jsonStart = scriptStart + 50,
      scriptEnd = html.indexOf("<\/script>", jsonStart);
    if (scriptEnd < 0) {
      return null;
    } else {
      return html.slice(jsonStart, scriptEnd);
    }
  }
  function excludePublishedAssets(
    assets: readonly Storage.OrphanedAsset[],
    publishedIds: ReadonlySet<string> | null,
  ): Storage.OrphanedAsset[] {
    if (publishedIds === null) {
      return [...assets];
    } else {
      return assets.filter((input): boolean => !publishedIds.has(input.id));
    }
  }
  async function sha256Hex(
    input: Uint8Array<ArrayBuffer> | ArrayBuffer,
  ): Promise<string> {
    let bytes = input instanceof Uint8Array ? input : new Uint8Array(input),
      digest = await crypto.subtle.digest("SHA-256", bytes),
      hex = "";
    for (let value of new Uint8Array(digest)) {
      hex += value.toString(16).padStart(2, "0");
    }
    return hex;
  }
  function inlineStorageFallbackMessage(code: string): string {
    if (code === "not_granted") {
      return (
        "Large-file storage isn’t granted to this page — files are stored in the page itself (" +
        formatAssetBytes(runtime.DESIGN_SYSTEM_INLINE_LIMITS.total) +
        " in all)."
      );
    } else {
      return (
        "Files are stored in the page (" +
        formatAssetBytes(runtime.DESIGN_SYSTEM_INLINE_LIMITS.total) +
        " in all); " +
        INLINE_STORAGE_UNAVAILABLE_DESCRIPTION +
        "."
      );
    }
  }
  function assetUploadFailureMessage(
    kind: Storage.AssetUploadFailureKind | undefined,
    code: string,
    bytes: number,
    mime: string = "",
  ): string {
    switch (kind) {
      case "too-large":
        return (0, runtime.explainUploadSize)(
          bytes,
          (0, runtime.storedFileByteLimit)(mime),
          mime === runtime.SVG_MIME_TYPE ? "the limit for SVG" : "the limit",
        );
      case "quota":
        return "this design system’s file storage is full or not accepting files right now — free space under Assets, or try again once it is saved.";
      case "backoff":
        return "rate-limited — add it again in a minute.";
      case "reload":
        return "the page could not confirm who you are — reload (or sign in again), then add it.";
      case "inline-if-fits":
        return (
          "the store doesn’t take this file type and at " +
          formatAssetBytes(bytes) +
          " it’s too large for the page"
        );
      default:
        return (
          "it couldn’t be stored (" +
          code +
          ") and at " +
          formatAssetBytes(bytes) +
          " it’s too large for the page"
        );
    }
  }
  function assetStorageUsageMessage(
    catalog: Storage.AssetsCatalogueState,
    fallbackUsage: { files: number; bytes: number },
  ): string {
    if (catalog.state === "listed") {
      if (catalog.usage.files === 0 && catalog.usage.bytes === 0) {
        return "";
      }
      return (
        "Stored alongside the page: " +
        String(catalog.usage.files) +
        (catalog.usage.files === 1 ? " file" : " files") +
        " · " +
        formatAssetBytes(catalog.usage.bytes) +
        " of " +
        formatAssetBytes(catalog.usage.maxBytes) +
        " used"
      );
    }
    if (fallbackUsage.files === 0 && fallbackUsage.bytes === 0) {
      return "";
    }
    return (
      "Stored alongside the page: " +
      String(fallbackUsage.files) +
      (fallbackUsage.files === 1 ? " file" : " files") +
      " · " +
      formatAssetBytes(fallbackUsage.bytes) +
      " of " +
      formatAssetBytes(runtime.BLOB_STORAGE_LIMITS.total) +
      " used"
    );
  }
  function reclaimAssetsButtonLabel(
    bytes: number,
    count: number,
    unavailable: boolean = assetDeletionUnavailable,
    showGeneralLabel: boolean = false,
  ): string {
    if (unavailable) {
      return "";
    }
    if (showGeneralLabel) {
      return "Free space";
    }
    if (count === 0) {
      return "";
    } else {
      return "Free " + formatAssetBytes(bytes);
    }
  }
  function reclaimAssetsConfirmation(count: number, bytes: number): string {
    return (
      "This permanently deletes " +
      String(count) +
      (count === 1 ? " stored file" : " stored files") +
      " (" +
      formatAssetBytes(bytes) +
      ") that no file in this version uses. Earlier versions of this design system that still show them will lose them too. This cannot be undone."
    );
  }
  function reclaimAssetsResultMessage(
    result: Storage.AssetDeletionResult,
  ): string {
    let count = result.freed.size,
      bytes = 0;
    for (let value of result.freed.values()) {
      bytes += value;
    }
    let partialMessage: string = result.unavailable
      ? " Freeing space isn’t available here."
      : result.rateLimited
        ? " The store is rate-limiting — free the rest in a minute."
        : result.kept.length > 0
          ? " " + String(result.kept.length) + " could not be freed yet."
          : "";
    return (
      (count === 0
        ? "Nothing was freed."
        : "Freed " +
          String(count) +
          (count === 1 ? " file" : " files") +
          " (" +
          formatAssetBytes(bytes) +
          ").") + partialMessage
    );
  }
  function missingAssetsMessage(paths: readonly string[]): string {
    let basenames = paths.map((input) => input.replace(/^.*\//, ""));
    return (
      String(paths.length) +
      (paths.length === 1
        ? " file this version uses is"
        : " files this version uses are") +
      " no longer in storage (" +
      basenames.slice(0, 3).join(", ") +
      (basenames.length > 3
        ? " and " + String(basenames.length - 3) + " more"
        : "") +
      ") — remove " +
      (paths.length === 1 ? "it or add it" : "them or add them") +
      " again."
    );
  }
  bindRuntimeValue(
    runtime,
    "assetCapabilityRuntime",
    () => assetCapabilityRuntime,
  );
  bindRuntimeValue(
    runtime,
    "eagerAssetsCapability",
    () => eagerAssetsCapability,
  );
  bindRuntimeValue(
    runtime,
    "assetCapabilityRequester",
    () => assetCapabilityRequester,
  );
  bindRuntimeValue(
    runtime,
    "assetsCapabilityPromise",
    () => assetsCapabilityPromise,
    (value) => {
      assetsCapabilityPromise = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "resolveAssetsCapability",
    () => resolveAssetsCapability,
  );
  bindRuntimeValue(
    runtime,
    "assetsTierState",
    () => assetsTierState,
    (value) => {
      assetsTierState = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "assetsStateSubscribers",
    () => assetsStateSubscribers,
    (value) => {
      assetsStateSubscribers = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "notifyAssetsStateSubscribers",
    () => notifyAssetsStateSubscribers,
  );
  bindRuntimeValue(runtime, "getAssetsTierState", () => getAssetsTierState);
  bindRuntimeValue(runtime, "setAssetsTierState", () => setAssetsTierState);
  bindRuntimeValue(runtime, "subscribeAssetsState", () => subscribeAssetsState);
  bindRuntimeValue(
    runtime,
    "assetsCatalogState",
    () => assetsCatalogState,
    (value) => {
      assetsCatalogState = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "assetDeletionUnavailable",
    () => assetDeletionUnavailable,
    (value) => {
      assetDeletionUnavailable = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "getAssetsCatalogState",
    () => getAssetsCatalogState,
  );
  bindRuntimeValue(runtime, "listedAssetIds", () => listedAssetIds);
  bindRuntimeValue(runtime, "assetCatalogUsage", () => assetCatalogUsage);
  bindRuntimeValue(
    runtime,
    "nonnegativeIntegerOrFallback",
    () => nonnegativeIntegerOrFallback,
  );
  bindRuntimeValue(
    runtime,
    "parseAssetsListResponse",
    () => parseAssetsListResponse,
  );
  bindRuntimeValue(runtime, "refreshAssetsCatalog", () => refreshAssetsCatalog);
  bindRuntimeValue(runtime, "addCatalogAsset", () => addCatalogAsset);
  bindRuntimeValue(runtime, "removeCatalogAssets", () => removeCatalogAssets);
  bindRuntimeValue(
    runtime,
    "ASSET_RECLAIM_GRACE_PERIOD_MS",
    () => ASSET_RECLAIM_GRACE_PERIOD_MS,
    (value) => {
      ASSET_RECLAIM_GRACE_PERIOD_MS = value;
    },
  );
  bindRuntimeValue(runtime, "blobIdsInFileText", () => blobIdsInFileText);
  bindRuntimeValue(
    runtime,
    "assessAssetReclamation",
    () => assessAssetReclamation,
  );
  bindRuntimeValue(runtime, "missingStoredBlobIds", () => missingStoredBlobIds);
  bindRuntimeValue(runtime, "formatAssetBytes", () => formatAssetBytes);
  bindRuntimeValue(runtime, "uploadFailureKind", () => uploadFailureKind);
  bindRuntimeValue(runtime, "assetErrorCode", () => assetErrorCode);
  bindRuntimeValue(
    runtime,
    "ASSET_RATE_LIMIT_RETRY_MS",
    () => ASSET_RATE_LIMIT_RETRY_MS,
    (value) => {
      ASSET_RATE_LIMIT_RETRY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ASSET_STORE_RETRY_MS",
    () => ASSET_STORE_RETRY_MS,
    (value) => {
      ASSET_STORE_RETRY_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "waitAssetRetry",
    () => waitAssetRetry,
    (value) => {
      waitAssetRetry = value;
    },
  );
  bindRuntimeValue(runtime, "uploadAssetWithRetry", () => uploadAssetWithRetry);
  bindRuntimeValue(
    runtime,
    "recentOrphanedAssets",
    () => recentOrphanedAssets,
    (value) => {
      recentOrphanedAssets = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "rememberOrphanedAsset",
    () => rememberOrphanedAsset,
  );
  bindRuntimeValue(
    runtime,
    "getRecentOrphanedAssets",
    () => getRecentOrphanedAssets,
  );
  bindRuntimeValue(runtime, "deleteStoredAssets", () => deleteStoredAssets);
  bindRuntimeValue(runtime, "publishedPageBlobIds", () => publishedPageBlobIds);
  bindRuntimeValue(
    runtime,
    "extractPublishedDocumentJson",
    () => extractPublishedDocumentJson,
  );
  bindRuntimeValue(
    runtime,
    "excludePublishedAssets",
    () => excludePublishedAssets,
  );
  bindRuntimeValue(runtime, "sha256Hex", () => sha256Hex);
  bindRuntimeValue(
    runtime,
    "INLINE_STORAGE_UNAVAILABLE_DESCRIPTION",
    () => INLINE_STORAGE_UNAVAILABLE_DESCRIPTION,
    (value) => {
      INLINE_STORAGE_UNAVAILABLE_DESCRIPTION = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "inlineStorageFallbackMessage",
    () => inlineStorageFallbackMessage,
  );
  bindRuntimeValue(
    runtime,
    "assetUploadFailureMessage",
    () => assetUploadFailureMessage,
  );
  bindRuntimeValue(
    runtime,
    "assetStorageUsageMessage",
    () => assetStorageUsageMessage,
  );
  bindRuntimeValue(
    runtime,
    "reclaimAssetsButtonLabel",
    () => reclaimAssetsButtonLabel,
  );
  bindRuntimeValue(
    runtime,
    "reclaimAssetsConfirmation",
    () => reclaimAssetsConfirmation,
  );
  bindRuntimeValue(
    runtime,
    "reclaimAssetsResultMessage",
    () => reclaimAssetsResultMessage,
  );
  bindRuntimeValue(runtime, "missingAssetsMessage", () => missingAssetsMessage);
  bindRuntimeValue(
    runtime,
    "RECLAIM_SAVE_FIRST_MESSAGE",
    () => RECLAIM_SAVE_FIRST_MESSAGE,
    (value) => {
      RECLAIM_SAVE_FIRST_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RECLAIM_SAVING_MESSAGE",
    () => RECLAIM_SAVING_MESSAGE,
    (value) => {
      RECLAIM_SAVING_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RECLAIM_NOTHING_UNUSED_MESSAGE",
    () => RECLAIM_NOTHING_UNUSED_MESSAGE,
    (value) => {
      RECLAIM_NOTHING_UNUSED_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RECLAIM_LIST_FAILED_MESSAGE",
    () => RECLAIM_LIST_FAILED_MESSAGE,
    (value) => {
      RECLAIM_LIST_FAILED_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RECLAIM_RECONNECTING_MESSAGE",
    () => RECLAIM_RECONNECTING_MESSAGE,
    (value) => {
      RECLAIM_RECONNECTING_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RECLAIM_WINDOWED_COLLECTION_MESSAGE",
    () => RECLAIM_WINDOWED_COLLECTION_MESSAGE,
    (value) => {
      RECLAIM_WINDOWED_COLLECTION_MESSAGE = value;
    },
  );
  return () => {
    assetsCapabilityPromise = null;
    assetsTierState = null;
    assetsStateSubscribers = new Set();
    assetsCatalogState = {
      state: "unknown",
    };
    assetDeletionUnavailable = false;
    ASSET_RECLAIM_GRACE_PERIOD_MS = 3600000;
    ASSET_RATE_LIMIT_RETRY_MS = 3000;
    ASSET_STORE_RETRY_MS = 1500;
    waitAssetRetry = (input: number) =>
      new Promise<void>((input2) => setTimeout(input2, input));
    recentOrphanedAssets = [];
    INLINE_STORAGE_UNAVAILABLE_DESCRIPTION =
      runtime.BLOB_STORE_UNAVAILABLE_MESSAGE;
    RECLAIM_SAVE_FIRST_MESSAGE = "Save your changes first, then free space.";
    RECLAIM_SAVING_MESSAGE =
      "Still saving your latest changes. Try again in a moment.";
    RECLAIM_NOTHING_UNUSED_MESSAGE =
      "Nothing to free: every stored file is in use.";
    RECLAIM_LIST_FAILED_MESSAGE =
      "Could not read what the store holds — try again in a moment.";
    RECLAIM_RECONNECTING_MESSAGE =
      "Reconnecting to this design system — try freeing space again in a moment.";
    RECLAIM_WINDOWED_COLLECTION_MESSAGE =
      "One area of this design system holds as many files as this page can load at once, so it can’t tell which stored files are unused. Nothing was freed.";
  };
}
