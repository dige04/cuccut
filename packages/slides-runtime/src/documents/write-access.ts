/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../bindings";
import type {
  ArtifactDocumentEnvironment,
  ArtifactPageParts,
  StorageSlot,
} from "./artifact-document";

/** Whether this view may save, and why not when it may not. */
export interface SlidesWriteAccess {
  canWrite: boolean;
  /** Shown to the user when `canWrite` is false. */
  reason?: string;
}

declare module "../bindings" {
  interface RuntimeBindings {
    CONTENT_SIGN_IN_REQUIRED_MESSAGE: string;
    EDITING_UNAVAILABLE_MESSAGE: string;
    LIVE_READ_ONLY_MESSAGE: string;
    FILE_LIST_UNAVAILABLE_MESSAGE: string;
    determineSlidesWriteAccess: () => Promise<SlidesWriteAccess>;
    unavailableStorageSlot: StorageSlot<string>;
    constantReadOnlyReasonSlot: (reason: string) => StorageSlot<string>;
    EMPTY_EMBEDDED_PAGE_PARTS: ArtifactPageParts;
    readOnlyEmbeddedDocumentOptions: (
      content: unknown,
      readOnlyReason?: string,
    ) => ArtifactDocumentEnvironment;
  }
}

export function installDocumentsWriteAccess(
  runtime: RuntimeBindings,
): () => void {
  var CONTENT_SIGN_IN_REQUIRED_MESSAGE: string;
  var EDITING_UNAVAILABLE_MESSAGE: string;
  var LIVE_READ_ONLY_MESSAGE: string;
  var FILE_LIST_UNAVAILABLE_MESSAGE: string;
  var unavailableStorageSlot: StorageSlot<string>;
  var EMPTY_EMBEDDED_PAGE_PARTS: ArtifactPageParts;
  async function determineSlidesWriteAccess(): Promise<SlidesWriteAccess> {
    if (!(0, runtime.selfPublishAvailable)()) {
      return {
        canWrite: false,
        reason: EDITING_UNAVAILABLE_MESSAGE,
      };
    }
    let options = (0, runtime.readCurrentArtifactReadOnlyReason)();
    if (options !== null) {
      return {
        canWrite: false,
        reason: options,
      };
    }
    let [value, value2, value3, value4] = await Promise.all([
      (0, runtime.currentUserCan)("data.write"),
      (0, runtime.currentUserCan)("files.write"),
      (0, runtime.currentUserCanEdit)(),
      (0, runtime.getAssetsCapability)(),
    ]);
    if (value !== null || value2 !== null) {
      if ((value === true || value2 === true) && value3 !== false) {
        return {
          canWrite: true,
        };
      } else {
        return {
          canWrite: false,
          reason: LIVE_READ_ONLY_MESSAGE,
        };
      }
    }
    if (value3 !== true && value4 === null) {
      return {
        canWrite: false,
        reason: LIVE_READ_ONLY_MESSAGE,
      };
    }
    return {
      canWrite: true,
    };
  }
  function constantReadOnlyReasonSlot(reason: string): StorageSlot<string> {
    return {
      read: () => reason,
      write: () => false,
      clear(): void {},
    };
  }
  function readOnlyEmbeddedDocumentOptions(
    content: unknown,
    readOnlyReason: string = CONTENT_SIGN_IN_REQUIRED_MESSAGE,
  ): ArtifactDocumentEnvironment {
    return {
      embeddedState: {
        title:
          typeof document !== "undefined" ? document.title : undefined,
        content: content,
        comments: [],
      },
      roFlag: constantReadOnlyReasonSlot(readOnlyReason),
      stash: unavailableStorageSlot,
      canPublish: true,
      pageParts: EMPTY_EMBEDDED_PAGE_PARTS,
    };
  }
  bindRuntimeValue(
    runtime,
    "CONTENT_SIGN_IN_REQUIRED_MESSAGE",
    () => CONTENT_SIGN_IN_REQUIRED_MESSAGE,
    (value) => {
      CONTENT_SIGN_IN_REQUIRED_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "EDITING_UNAVAILABLE_MESSAGE",
    () => EDITING_UNAVAILABLE_MESSAGE,
    (value) => {
      EDITING_UNAVAILABLE_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "LIVE_READ_ONLY_MESSAGE",
    () => LIVE_READ_ONLY_MESSAGE,
    (value) => {
      LIVE_READ_ONLY_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "FILE_LIST_UNAVAILABLE_MESSAGE",
    () => FILE_LIST_UNAVAILABLE_MESSAGE,
    (value) => {
      FILE_LIST_UNAVAILABLE_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "determineSlidesWriteAccess",
    () => determineSlidesWriteAccess,
  );
  bindRuntimeValue(
    runtime,
    "unavailableStorageSlot",
    () => unavailableStorageSlot,
    (value) => {
      unavailableStorageSlot = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "constantReadOnlyReasonSlot",
    () => constantReadOnlyReasonSlot,
  );
  bindRuntimeValue(
    runtime,
    "EMPTY_EMBEDDED_PAGE_PARTS",
    () => EMPTY_EMBEDDED_PAGE_PARTS,
    (value) => {
      EMPTY_EMBEDDED_PAGE_PARTS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "readOnlyEmbeddedDocumentOptions",
    () => readOnlyEmbeddedDocumentOptions,
  );
  return () => {
    (0, runtime.initializeCompiledPage)();
    (0, runtime.initializeAssetStorage)();
    CONTENT_SIGN_IN_REQUIRED_MESSAGE =
      "You might not have access to this content. Reload the page to try again.";
    EDITING_UNAVAILABLE_MESSAGE = "Editing isn’t available in this view.";
    LIVE_READ_ONLY_MESSAGE = "Read-only. You can view live changes.";
    FILE_LIST_UNAVAILABLE_MESSAGE =
      "Couldn’t read the full file list. Reload to try again.";
    unavailableStorageSlot = {
      read: () => null,
      write: () => false,
      clear(): void {},
    };
    EMPTY_EMBEDDED_PAGE_PARTS = {
      title: "",
      readme: "",
      readmeMeta: "",
      css: "",
      js: "",
      emulator: false,
    };
  };
}
