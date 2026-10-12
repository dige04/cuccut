import type * as Host from "../contracts/platform-host";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installDocumentsArtifactDocument(
  runtime: RuntimeBindings,
): () => void {
  var RAIL_THUMB_RESIZE_SETTLE_MS: number;
  var activeArtifactDocument: Host.ActiveArtifactRuntime | undefined;
  function normalizeArtifactTitle(title: unknown): string | undefined {
    if (typeof title === "string" && title.length > 0) {
      return (0, runtime.truncateUtf16Safely)(
        title,
        RAIL_THUMB_RESIZE_SETTLE_MS,
      );
    } else {
      return undefined;
    }
  }
  function normalizeTitleInput(title: string): string {
    return (0, runtime.truncateUtf16Safely)(
      title.trim(),
      RAIL_THUMB_RESIZE_SETTLE_MS,
    );
  }
  function createRuntimeArtifactDocument<Content>(
    options: Host.RuntimeDocumentOptions<Content>,
  ): Host.ArtifactDocument<Content> {
    let runtime2 = options.runtime;
    function parseContent(input: unknown): Content {
      try {
        return options.parseContent(input);
      } catch {
        return options.initialContent;
      }
    }
    let defaultTitle = options.defaultTitle ?? "Untitled",
      snapshot = {
        title: normalizeArtifactTitle(options.snapshot.title) ?? defaultTitle,
        content: parseContent(options.snapshot.content),
        comments: (0, runtime.normalizeComments)(options.snapshot.comments),
      },
      readOnly: boolean = runtime2.saving.status === "readonly",
      contentHoldReason = options.contentHold?.(options.snapshot.content),
      saveError =
        runtime2.saving.status === "error"
          ? (runtime2.saving.lastError?.message ??
            "Autosave failed — retrying.")
          : undefined,
      saving: boolean = runtime2.saving.status === "saving",
      pendingCommentIds = new Set<string>(),
      documentSubscribers = new Set<(event?: { remote: boolean }) => void>(),
      saveSubscribers = new Set<(state: Host.SaveState) => void>();
    function getSaveState(): Host.SaveState {
      if (contentHoldReason !== undefined) {
        return {
          status: "readonly",
          message: contentHoldReason,
        };
      }
      if (readOnly) {
        return {
          status: "readonly",
          message: "This view cannot edit the document.",
        };
      }
      if (saveError !== undefined) {
        return {
          status: "error",
          message: saveError,
        };
      }
      if (saving || runtime2.saving.pending > 0) {
        return {
          status: "saving",
        };
      }
      return {
        status: "ready",
      };
    }
    function notifySubscribers2(): void {
      for (let value2 of [...documentSubscribers]) {
        value2();
      }
      let value = getSaveState();
      for (let value2 of [...saveSubscribers]) {
        value2(value);
      }
    }
    runtime2.saving.onStatus((input, options2): void => {
      saving = input === "saving";
      if (input === "readonly") {
        readOnly = true;
      }
      if (input === "error") {
        saveError = options2?.message ?? "Autosave failed — retrying.";
      } else if (input === "idle" || input === "readonly") {
        saveError = undefined;
      }
      if (input === "idle") {
        pendingCommentIds.clear();
      }
      notifySubscribers2();
    });
    runtime2.doc.observe("", (input): void => {
      let flag: boolean = false;
      for (let value of input) {
        if (value.origin === "local") {
          continue;
        }
        if (value.key === "title") {
          snapshot.title = normalizeArtifactTitle(value.value) ?? defaultTitle;
          flag = true;
        } else if (value.key === "content") {
          snapshot.content = parseContent(value.value);
          contentHoldReason = options.contentHold?.(value.value);
          flag = true;
        } else if (value.key === "comments") {
          snapshot.comments = (0, runtime.normalizeComments)(value.value);
          flag = true;
        }
      }
      if (flag) {
        notifySubscribers2();
      }
    });
    let serializeContent = (input: Content): unknown =>
      options.serializeContent !== undefined
        ? options.serializeContent(input, snapshot.title)
        : input;
    function setRuntimeField(input: string, options2: unknown): void {
      runtime2.doc.set(input, options2).catch((): void => {
        saveError = "Autosave failed — the change may not be stored.";
        notifySubscribers2();
      });
    }
    return {
      saveMode: (): "auto" => "auto",
      title: () => snapshot.title,
      setTitle: (input): void => {
        if (contentHoldReason !== undefined) {
          return;
        }
        let value = normalizeTitleInput(input);
        if (value.length === 0 || value === snapshot.title) {
          return;
        }
        snapshot.title = value;
        setRuntimeField("title", value);
        if (options.serializeContent !== undefined) {
          setRuntimeField("content", serializeContent(snapshot.content));
        }
        (0, runtime.recordArtifactEdit)();
        notifySubscribers2();
      },
      content: () => snapshot.content,
      setContent: (input): void => {
        if (contentHoldReason !== undefined || input === snapshot.content) {
          return;
        }
        snapshot.content = input;
        setRuntimeField("content", serializeContent(input));
        (0, runtime.recordArtifactEdit)();
        notifySubscribers2();
      },
      updateContent: (input, options2): void => {
        if (contentHoldReason !== undefined) {
          return;
        }
        let value = input(snapshot.content);
        if (value === snapshot.content) {
          return;
        }
        snapshot.content = value;
        setRuntimeField("content", serializeContent(value));
        if (options2?.auto !== true) {
          (0, runtime.recordArtifactEdit)();
        }
        notifySubscribers2();
      },
      state: () => snapshot,
      comments: () => snapshot.comments,
      addComment: (input) => {
        if (snapshot.comments.length >= runtime.MAX_ARTIFACT_COMMENTS) {
          return;
        }
        let value = (0, runtime.normalizeComments)([
          {
            ...input,
            id: crypto.randomUUID().slice(0, 8),
            at: Date.now(),
          },
        ])[0];
        if (!value) {
          return;
        }
        snapshot.comments = [...snapshot.comments, value];
        pendingCommentIds.add(value.id);
        setRuntimeField("comments", snapshot.comments);
        notifySubscribers2();
        return value;
      },
      removeComment: (input): void => {
        let value = snapshot.comments.filter(
          (input2: Host.ArtifactComment): boolean => input2.id !== input,
        );
        if (value.length === snapshot.comments.length) {
          return;
        }
        snapshot.comments = value;
        pendingCommentIds.delete(input);
        setRuntimeField("comments", snapshot.comments);
        notifySubscribers2();
      },
      commentSync: () => {
        let size = pendingCommentIds.size;
        if (readOnly && size > 0) {
          return {
            status: "blocked",
            pending: size,
            message: "This view cannot edit the document.",
          };
        }
        if (saveError !== undefined && size > 0) {
          return {
            status: "error",
            pending: size,
            message: saveError,
          };
        }
        if (size > 0) {
          return {
            status: "publishing",
            pending: size,
          };
        }
        return {
          status: "idle",
          pending: 0,
        };
      },
      pendingCommentIds: () => new Set(pendingCommentIds),
      retryCommentPublish: (): void => {
        runtime2.saving.save().catch((): void => {});
      },
      dirty: (): boolean => false,
      readOnly: () => readOnly || contentHoldReason !== undefined,
      saveState: getSaveState,
      documentBytes: () =>
        new TextEncoder().encode(JSON.stringify(snapshot)).length,
      save: async (): Promise<void> => {
        if (readOnly) {
          return;
        }
        await runtime2.saving.save().catch((): void => {});
        notifySubscribers2();
      },
      stashOffer: (): undefined => {
        return;
      },
      restoreStash: (): undefined => {
        return;
      },
      discardStash: (): void => {
        return;
      },
      restoreCount: (): number => 0,
      subscribe: (input) => {
        documentSubscribers.add(input);
        return () => documentSubscribers.delete(input);
      },
      subscribeSave: (input) => {
        saveSubscribers.add(input);
        return () => saveSubscribers.delete(input);
      },
    };
  }
  function setAutoSavingArtifactRuntime(
    input: Host.ActiveArtifactRuntime | undefined,
  ): void {
    activeArtifactDocument = input;
  }
  function getAutoSavingArtifactRuntime():
    | Host.ActiveArtifactRuntime
    | undefined {
    return activeArtifactDocument;
  }
  async function detectAutoSavingArtifactRuntime(): Promise<void> {
    if (typeof window === "undefined") {
      return;
    }
    let value: Host.ProtocolGlobal = window;
    if (value.appifact === undefined) {
      return;
    }
    try {
      let value2 = await value.appifact.ready();
      if (value2.saving.mode !== "auto") {
        return;
      }
      let value3 = await value2.doc.getAll();
      setAutoSavingArtifactRuntime({
        runtime: value2,
        snapshot: value3,
      });
    } catch (value2: unknown) {
      console.error(
        "appifact runtime probe failed — booting the frame model",
        value2,
      );
    }
  }
  bindRuntimeValue(
    runtime,
    "RAIL_THUMB_RESIZE_SETTLE_MS",
    () => RAIL_THUMB_RESIZE_SETTLE_MS,
    (value) => {
      RAIL_THUMB_RESIZE_SETTLE_MS = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeArtifactTitle",
    () => normalizeArtifactTitle,
  );
  bindRuntimeValue(runtime, "normalizeTitleInput", () => normalizeTitleInput);
  bindRuntimeValue(
    runtime,
    "createRuntimeArtifactDocument",
    () => createRuntimeArtifactDocument,
  );
  bindRuntimeValue(
    runtime,
    "activeArtifactDocument",
    () => activeArtifactDocument,
    (value) => {
      activeArtifactDocument = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "setAutoSavingArtifactRuntime",
    () => setAutoSavingArtifactRuntime,
  );
  bindRuntimeValue(
    runtime,
    "getAutoSavingArtifactRuntime",
    () => getAutoSavingArtifactRuntime,
  );
  bindRuntimeValue(
    runtime,
    "detectAutoSavingArtifactRuntime",
    () => detectAutoSavingArtifactRuntime,
  );
  return () => {
    RAIL_THUMB_RESIZE_SETTLE_MS = 200;
  };
}
