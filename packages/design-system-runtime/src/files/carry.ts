/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
import type {
  DesignFilesCodec,
  LazyReadState,
  FilesPeerSource,
  CarriedFileEdit,
  CarriedView,
  CarriedIndexEdit,
  CarryViewInput,
  VersionedIndex,
  FileData,
} from "../contracts/files-core";
import type * as Files from "../contracts";
export function installFilesCarry(runtime: RuntimeBindings): () => void {
  var designSystemFilesCodec: (
    indexPath: string,
    lazy?: LazyReadState,
  ) => DesignFilesCodec;
  var DEFAULT_DESIGN_SYSTEM_FILES_CODEC: DesignFilesCodec;
  var HOT_CARRY_MAX_INLINE_CHARS: number;
  var HOT_CARRY_MAX_AGE_MS: number;
  var HOT_CARRY_MAX_FILES: number;
  var HOT_CARRY_MAX_TOTAL_CHARS: number;
  var HOT_CARRY_STORAGE_PREFIX: string;
  var EMPTY_FILES_PEER_SOURCE: FilesPeerSource;
  var isCarriedFileIndex: (
    value: unknown,
  ) => value is import("../contracts/files-core").CarriedFilesIndex;
  var RECENT_PUBLISH_HEAL_WINDOW_MS: number;
  var RECENT_PUBLISH_CLASH_NOTICE_MS: number;
  var safeSessionStorage: () => Storage | null;
  var fileBaseName: (path: string) => string;
  var summarizeFileNames: (paths: readonly string[]) => string;
  var FILE_CONFLICT_CHOICE_SUFFIX: string;
  function currentDesignSystemArtifactPath(
    pageLocation: Pick<Location, "pathname"> | undefined = globalThis.location,
  ) {
    return (pageLocation?.pathname ?? "").replace(/(^|\/)_f\/[^/]+\//, "$1");
  }
  function designSystemCarryKey(
    viewerId: string | null | undefined,
    artifactPath: string = currentDesignSystemArtifactPath(),
  ): string {
    return (viewerId ?? "") + "\x00" + artifactPath;
  }
  function purgeOtherViewerCarryEntries(
    storage: Storage,
    viewerId: string | null | undefined,
    artifactPath: string = currentDesignSystemArtifactPath(),
  ): void {
    let currentKey: string =
        HOT_CARRY_STORAGE_PREFIX + designSystemCarryKey(viewerId, artifactPath),
      staleKeys: string[] = [];
    for (let index: number = 0; index < storage.length; index++) {
      let value = storage.key(index);
      if (
        value !== null &&
        value !== currentKey &&
        value.startsWith(HOT_CARRY_STORAGE_PREFIX) &&
        (value === HOT_CARRY_STORAGE_PREFIX + artifactPath ||
          value.endsWith("\x00" + artifactPath))
      ) {
        staleKeys.push(value);
      }
    }
    for (let value of staleKeys) {
      storage.removeItem(value);
    }
  }
  function snapshotDesignSystemView(
    flagged: Iterable<string>,
    host:
      | Pick<Window, "location" | "history" | "dispatchEvent">
      | undefined = typeof window !== "undefined" ? window : undefined,
  ): CarriedView {
    let section = host?.location?.hash?.slice(1) ?? "",
      paths: string[] = [...flagged];
    return {
      v: 1,
      ...(section !== ""
        ? {
            section: section,
          }
        : {}),
      ...(paths.length > 0
        ? {
            flagged: paths,
          }
        : {}),
    };
  }
  function restoreDesignSystemView(
    snapshot: unknown,
    host:
      | Pick<Window, "location" | "history" | "dispatchEvent">
      | undefined = typeof window !== "undefined" ? window : undefined,
  ) {
    let view =
      typeof snapshot === "object" && snapshot !== null
        ? (snapshot as CarryViewInput)
        : {};
    if (
      typeof view.section === "string" &&
      /^[A-Za-z0-9_.:~-]{1,120}$/.test(view.section) &&
      host !== undefined &&
      host.location.hash !== "#" + view.section
    ) {
      try {
        if (host.history !== undefined && host.location.protocol !== "about:") {
          host.history.replaceState(null, "", "#" + view.section);
        } else {
          host.location.hash = "#" + view.section;
        }
        host.dispatchEvent(new Event("hashchange"));
      } catch {}
    }
    if (Array.isArray(view.flagged)) {
      return view.flagged
        .filter((input: unknown): boolean => typeof input === "string")
        .slice(0, 200);
    } else {
      return [];
    }
  }
  function parseCarriedFileEdit(value: unknown) {
    if (
      typeof value !== "object" ||
      value === null ||
      typeof (value as { text?: unknown }).text !== "string"
    ) {
      return;
    }
    let edit: { text: string; base?: unknown; baseText?: unknown } = value as {
      text: string;
      base?: unknown;
      baseText?: unknown;
    };
    return {
      text: edit.text,
      ...(typeof edit.base === "string" || edit.base === null
        ? {
            base: edit.base,
          }
        : {}),
      ...(typeof edit.baseText === "string"
        ? {
            baseText: edit.baseText,
          }
        : {}),
    };
  }
  function readCarriedFileEdits(snapshot: unknown, field: string = "mine") {
    let edits = new Map<string, CarriedFileEdit>(),
      raw =
        typeof snapshot === "object" && snapshot !== null
          ? (snapshot as Record<string, unknown>)[field]
          : undefined;
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
      return edits;
    }
    for (let [value, value2] of Object.entries<unknown>(
      raw as Record<string, unknown>,
    )) {
      let value3 = parseCarriedFileEdit(value2);
      if (value3 !== undefined) {
        edits.set(value, value3);
      }
    }
    return edits;
  }
  function readCarriedIndexEdit(value: unknown) {
    if (typeof value !== "object" || value === null) {
      return;
    }
    let edit = value as { base?: unknown; mine?: unknown };
    if (isCarriedFileIndex(edit.base) && isCarriedFileIndex(edit.mine)) {
      return {
        base: edit.base,
        mine: edit.mine,
      };
    } else {
      return undefined;
    }
  }
  function activeElementIsEditing(
    pageDocument: Document | undefined = typeof document !== "undefined"
      ? document
      : undefined,
  ) {
    let active = pageDocument?.activeElement;
    if (active === null || active === undefined) {
      return false;
    }
    let tag = active.tagName?.toLowerCase();
    return (
      tag === "textarea" ||
      tag === "input" ||
      (active as HTMLElement).isContentEditable === true
    );
  }
  function stripEditingOffFromStashedIndex(
    stash: Files.FilesCrashStash,
    indexPath: string,
  ) {
    let cleanIndex = (input: string) => {
      try {
        let {
          editing: value,
          ...value2
        }: import("../contracts/files-core").JsonRecord = JSON.parse(input);
        if (
          (0, runtime.isSystemEditingDisabled)({
            editing: value,
          })
        ) {
          return (0, runtime.serializeIndexDocument)(value2);
        } else {
          return input;
        }
      } catch {
        return input;
      }
    };
    return {
      ...stash,
      read: async (): Promise<
        Awaited<ReturnType<Files.FilesCrashStash["read"]>>
      > => {
        let value = await stash.read();
        if (value === undefined) {
          return value;
        } else {
          return {
            ...value,
            edits: value.edits.map((input: Files.StashedFileEdit) =>
              input.path === indexPath && input.text !== null
                ? {
                    ...input,
                    text: cleanIndex(input.text),
                  }
                : input,
            ),
          };
        }
      },
    };
  }
  function prioritizeStashedTextEdits(stash: Files.FilesCrashStash) {
    return {
      ...stash,
      put: (input: Files.StashedFileEdit[], options: string) => {
        let value = input.filter(
            (input2: Files.StashedFileEdit): boolean => input2.text !== null,
          ),
          value2: boolean =
            value.reduce(
              (input2: number, options2: Files.StashedFileEdit) =>
                input2 + options2.path.length + (options2.text?.length ?? 0),
              0,
            ) <= runtime.CRASH_STASH_MAX_ARTIFACT_CHARS;
        return stash.put(
          value2
            ? [
                ...value,
                ...input.filter(
                  (input2: Files.StashedFileEdit): boolean =>
                    input2.text === null,
                ),
              ]
            : value,
          options,
        );
      },
    };
  }
  async function readOwedArtifactBlob(
    blobId: string,
  ): Promise<FileData | null> {
    try {
      let value = await fetch(
        (0, runtime.blobRelativeUrlModelFilePolicy)(blobId),
        {
          credentials: "same-origin",
        },
      );
      if (!value.ok) {
        return null;
      }
      return {
        bytes: new Uint8Array(await value.arrayBuffer()),
        type: (value.headers.get("content-type") ?? "").split(";")[0].trim(),
      };
    } catch {
      return null;
    }
  }
  bindRuntimeValue(
    runtime,
    "designSystemFilesCodec",
    () => designSystemFilesCodec,
    (value) => {
      designSystemFilesCodec = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "DEFAULT_DESIGN_SYSTEM_FILES_CODEC",
    () => DEFAULT_DESIGN_SYSTEM_FILES_CODEC,
    (value) => {
      DEFAULT_DESIGN_SYSTEM_FILES_CODEC = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HOT_CARRY_MAX_INLINE_CHARS",
    () => HOT_CARRY_MAX_INLINE_CHARS,
    (value) => {
      HOT_CARRY_MAX_INLINE_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HOT_CARRY_MAX_AGE_MS",
    () => HOT_CARRY_MAX_AGE_MS,
    (value) => {
      HOT_CARRY_MAX_AGE_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HOT_CARRY_MAX_FILES",
    () => HOT_CARRY_MAX_FILES,
    (value) => {
      HOT_CARRY_MAX_FILES = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HOT_CARRY_MAX_TOTAL_CHARS",
    () => HOT_CARRY_MAX_TOTAL_CHARS,
    (value) => {
      HOT_CARRY_MAX_TOTAL_CHARS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "HOT_CARRY_STORAGE_PREFIX",
    () => HOT_CARRY_STORAGE_PREFIX,
    (value) => {
      HOT_CARRY_STORAGE_PREFIX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EMPTY_FILES_PEER_SOURCE",
    () => EMPTY_FILES_PEER_SOURCE,
    (value) => {
      EMPTY_FILES_PEER_SOURCE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "currentDesignSystemArtifactPath",
    () => currentDesignSystemArtifactPath,
  );
  bindRuntimeValue(runtime, "designSystemCarryKey", () => designSystemCarryKey);
  bindRuntimeValue(
    runtime,
    "purgeOtherViewerCarryEntries",
    () => purgeOtherViewerCarryEntries,
  );
  bindRuntimeValue(
    runtime,
    "snapshotDesignSystemView",
    () => snapshotDesignSystemView,
  );
  bindRuntimeValue(
    runtime,
    "restoreDesignSystemView",
    () => restoreDesignSystemView,
  );
  bindRuntimeValue(runtime, "parseCarriedFileEdit", () => parseCarriedFileEdit);
  bindRuntimeValue(runtime, "readCarriedFileEdits", () => readCarriedFileEdits);
  bindRuntimeValue(
    runtime,
    "isCarriedFileIndex",
    () => isCarriedFileIndex,
    (value) => {
      isCarriedFileIndex = value;
    },
  );
  bindRuntimeValue(runtime, "readCarriedIndexEdit", () => readCarriedIndexEdit);
  bindRuntimeValue(
    runtime,
    "activeElementIsEditing",
    () => activeElementIsEditing,
  );
  bindRuntimeValue(
    runtime,
    "stripEditingOffFromStashedIndex",
    () => stripEditingOffFromStashedIndex,
  );
  bindRuntimeValue(
    runtime,
    "prioritizeStashedTextEdits",
    () => prioritizeStashedTextEdits,
  );
  bindRuntimeValue(
    runtime,
    "RECENT_PUBLISH_HEAL_WINDOW_MS",
    () => RECENT_PUBLISH_HEAL_WINDOW_MS,
    (value) => {
      RECENT_PUBLISH_HEAL_WINDOW_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "RECENT_PUBLISH_CLASH_NOTICE_MS",
    () => RECENT_PUBLISH_CLASH_NOTICE_MS,
    (value) => {
      RECENT_PUBLISH_CLASH_NOTICE_MS = value;
    },
  );
  bindRuntimeValue(runtime, "readOwedArtifactBlob", () => readOwedArtifactBlob);
  bindRuntimeValue(
    runtime,
    "safeSessionStorage",
    () => safeSessionStorage,
    (value) => {
      safeSessionStorage = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "fileBaseName",
    () => fileBaseName,
    (value) => {
      fileBaseName = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "summarizeFileNames",
    () => summarizeFileNames,
    (value) => {
      summarizeFileNames = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_CONFLICT_CHOICE_SUFFIX",
    () => FILE_CONFLICT_CHOICE_SUFFIX,
    (value) => {
      FILE_CONFLICT_CHOICE_SUFFIX = value;
    },
  );
  return () => {
    designSystemFilesCodec = (input: string, options?: LazyReadState) => ({
      indexPath: input,
      type: "design_system",
      schema: runtime.FILES_INDEX_MERGE_SCHEMA,
      emptyIndex: runtime.createEmptyFilesIndex,
      wants: (input2: Files.FileListingRow) =>
        (0, runtime.isProjectContentPath)(input2.path) &&
        !(
          options !== undefined &&
          (0, runtime.lazyFileReadMode)(options, input2.path) === "skipped"
        ),
      indexOf: (
        input2: import("../contracts/files-core").FileDocumentState<{
          files: Files.FileTable;
        }>,
        options2?: Files.FilesIndex,
      ) =>
        (0, runtime.buildFilesIndex)(
          input2.title,
          input2.content.files,
          options2,
        ),
      filesOf: (
        input2: import("../contracts/files-core").FileDocumentState<{
          files: Files.FileTable;
        }>,
      ) => (0, runtime.projectFilesForSave)(input2.content.files),
      compose: (input2: Files.FilesIndex, options2: Map<string, string>) =>
        (0, runtime.restoreFilesFromIndex)(input2, options2),
    });
    DEFAULT_DESIGN_SYSTEM_FILES_CODEC = designSystemFilesCodec(
      runtime.FILES_INDEX_PROJECT_PATH,
    );
    HOT_CARRY_MAX_INLINE_CHARS = 131072;
    HOT_CARRY_MAX_AGE_MS = runtime.CRASH_STASH_MAX_AGE_MS;
    HOT_CARRY_MAX_FILES = runtime.CRASH_STASH_MAX_ENTRIES;
    HOT_CARRY_MAX_TOTAL_CHARS = runtime.CRASH_STASH_MAX_ARTIFACT_CHARS;
    HOT_CARRY_STORAGE_PREFIX = "ds-carry:";
    EMPTY_FILES_PEER_SOURCE = {
      getSnapshot: () => [],
      subscribe: () => (): void => {
        return;
      },
    };
    isCarriedFileIndex = (input: unknown): input is Files.FilesIndex =>
      typeof input === "object" &&
      input !== null &&
      !Array.isArray(input) &&
      typeof (input as { v?: unknown }).v === "number";
    RECENT_PUBLISH_HEAL_WINDOW_MS = 3000;
    RECENT_PUBLISH_CLASH_NOTICE_MS = 1000;
    safeSessionStorage = () => {
      try {
        if (typeof sessionStorage !== "undefined") {
          return sessionStorage;
        } else {
          return null;
        }
      } catch {
        return null;
      }
    };
    fileBaseName = (input: string) => input.slice(input.lastIndexOf("/") + 1);
    summarizeFileNames = (items: readonly string[]) =>
      items.length <= 2
        ? items.map(fileBaseName).join(" and ")
        : fileBaseName(items[0]) + " and " + String(items.length - 1) + " more";
    FILE_CONFLICT_CHOICE_SUFFIX =
      " Choose theirs, yours, or yours as a copy in the banner at the top.";
  };
}
