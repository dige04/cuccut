/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformDatabaseDocumentStore(
  runtime: RuntimeBindings,
): () => void {
  var PlatformDatabaseDocumentStoreConstant: Dynamic;
  function normalizeDocumentTitle(items?: Dynamic): Dynamic {
    return typeof items == "string" && items.length > 0
      ? (0, runtime.truncateUtf16Safely)(
          items,
          PlatformDatabaseDocumentStoreConstant,
        )
      : undefined;
  }
  function normalizeNewDocumentTitle(input?: Dynamic): Dynamic {
    return (0, runtime.truncateUtf16Safely)(
      input.trim(),
      PlatformDatabaseDocumentStoreConstant,
    );
  }
  function createDatabaseDocumentStore(options?: Dynamic): Dynamic {
    let runtime2: Dynamic = options.runtime;
    function value(input?: Dynamic): Dynamic {
      try {
        return options.parseContent(input);
      } catch {
        return options.initialContent;
      }
    }
    let value2: Dynamic = options.defaultTitle ?? "Untitled",
      state: Dynamic = {
        title: normalizeDocumentTitle(options.snapshot.title) ?? value2,
        content: value(options.snapshot.content),
        comments: (0, runtime.parseDocumentComments)(options.snapshot.comments),
      },
      value3: Dynamic = runtime2.saving.status === "readonly",
      value4: Dynamic = options.contentHold?.(options.snapshot.content),
      value5: Dynamic =
        runtime2.saving.status === "error"
          ? (runtime2.saving.lastError?.message ??
            "Autosave failed \u2014 retrying.")
          : undefined,
      value6: Dynamic = runtime2.saving.status === "saving",
      values: Dynamic = new Set(),
      values2: Dynamic = new Set(),
      values3: Dynamic = new Set();
    function value7(): Dynamic {
      return value4 !== undefined
        ? {
            status: "readonly",
            message: value4,
          }
        : value3
          ? {
              status: "readonly",
              message: "This view cannot edit the document.",
            }
          : value5 !== undefined
            ? {
                status: "error",
                message: value5,
              }
            : value6 || runtime2.saving.pending > 0
              ? {
                  status: "saving",
                }
              : {
                  status: "ready",
                };
    }
    function value8(): Dynamic {
      for (let value11 of [...values2] as Dynamic) value11();
      let value10: Dynamic = value7();
      for (let value11 of [...values3] as Dynamic) value11(value10);
    }
    runtime2.saving.onStatus((input?: Dynamic, options2?: Dynamic): Dynamic => {
      value6 = input === "saving";
      input === "readonly" && (value3 = true);
      input === "error"
        ? (value5 = options2?.message ?? "Autosave failed \u2014 retrying.")
        : (input === "idle" || input === "readonly") && (value5 = undefined);
      input === "idle" && values.clear();
      value8();
    });
    runtime2.doc.observe("", (input?: Dynamic): Dynamic => {
      let flag: Dynamic = false;
      for (let value10 of input as Dynamic)
        value10.origin !== "local" &&
          (value10.key === "title"
            ? ((state.title = normalizeDocumentTitle(value10.value) ?? value2),
              (flag = true))
            : value10.key === "content"
              ? ((state.content = value(value10.value)),
                (value4 = options.contentHold?.(value10.value)),
                (flag = true))
              : value10.key === "comments" &&
                ((state.comments = (0, runtime.parseDocumentComments)(
                  value10.value,
                )),
                (flag = true)));
      flag && value8();
    });
    let callback: Dynamic = (input?: Dynamic): Dynamic =>
      options.serializeContent !== undefined
        ? options.serializeContent(input, state.title)
        : input;
    function value9(input?: Dynamic, options2?: Dynamic): Dynamic {
      runtime2.doc.set(input, options2).catch((): Dynamic => {
        value5 = "Autosave failed \u2014 the change may not be stored.";
        value8();
      });
    }
    return {
      saveMode: (): Dynamic => "auto",
      title: (): Dynamic => state.title,
      setTitle: (input?: Dynamic): Dynamic => {
        if (value4 !== undefined) return;
        let value10: Dynamic = normalizeNewDocumentTitle(input);
        value10.length === 0 ||
          value10 === state.title ||
          ((state.title = value10),
          value9("title", value10),
          options.serializeContent !== undefined &&
            value9("content", callback(state.content)),
          (0, runtime.recordEdit)(),
          value8());
      },
      content: (): Dynamic => state.content,
      setContent: (input?: Dynamic): Dynamic => {
        value4 !== undefined ||
          input === state.content ||
          ((state.content = input),
          value9("content", callback(input)),
          (0, runtime.recordEdit)(),
          value8());
      },
      updateContent: (input?: Dynamic, options2?: Dynamic): Dynamic => {
        if (value4 !== undefined) return;
        let value10: Dynamic = input(state.content);
        value10 !== state.content &&
          ((state.content = value10),
          value9("content", callback(value10)),
          options2?.auto !== true && (0, runtime.recordEdit)(),
          value8());
      },
      state: (): Dynamic => state,
      comments: (): Dynamic => state.comments,
      addComment: (input?: Dynamic): Dynamic => {
        if (state.comments.length >= runtime.maxDocumentComments) return;
        let value10: Dynamic = (0, runtime.parseDocumentComments)([
          {
            ...input,
            id: crypto.randomUUID().slice(0, 8),
            at: Date.now(),
          },
        ])[0];
        if (value10) {
          state.comments = [...state.comments, value10];
          values.add(value10.id);
          value9("comments", state.comments);
          value8();
          return value10;
        }
      },
      removeComment: (input?: Dynamic): Dynamic => {
        let value10: Dynamic = state.comments.filter(
          (input2?: Dynamic): Dynamic => input2.id !== input,
        );
        value10.length !== state.comments.length &&
          ((state.comments = value10),
          values.delete(input),
          value9("comments", state.comments),
          value8());
      },
      commentSync: (): Dynamic => {
        let size: Dynamic = values.size;
        return value3 && size > 0
          ? {
              status: "blocked",
              pending: size,
              message: "This view cannot edit the document.",
            }
          : value5 !== undefined && size > 0
            ? {
                status: "error",
                pending: size,
                message: value5,
              }
            : size > 0
              ? {
                  status: "publishing",
                  pending: size,
                }
              : {
                  status: "idle",
                  pending: 0,
                };
      },
      pendingCommentIds: (): Dynamic => new Set(values),
      retryCommentPublish: (): Dynamic => {
        runtime2.saving.save().catch((): Dynamic => {});
      },
      dirty: (): Dynamic => false,
      readOnly: (): Dynamic => value3 || value4 !== undefined,
      saveState: value7,
      documentBytes: (): Dynamic =>
        new TextEncoder().encode(JSON.stringify(state)).length,
      save: async (): Promise<Dynamic> => {
        value3 ||
          (await runtime2.saving.save().catch((): Dynamic => {}), value8());
      },
      stashOffer: (): Dynamic => {},
      restoreStash: (): Dynamic => {},
      discardStash: (): Dynamic => {},
      restoreCount: (): Dynamic => 0,
      subscribe: (input?: Dynamic): Dynamic => (
        values2.add(input),
        (): Dynamic => values2.delete(input)
      ),
      subscribeSave: (input?: Dynamic): Dynamic => (
        values3.add(input),
        (): Dynamic => values3.delete(input)
      ),
    };
  }
  bindRuntimeValue(
    runtime,
    "PlatformDatabaseDocumentStoreConstant",
    () => PlatformDatabaseDocumentStoreConstant,
    (value) => {
      PlatformDatabaseDocumentStoreConstant = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "normalizeDocumentTitle",
    () => normalizeDocumentTitle,
  );
  bindRuntimeValue(
    runtime,
    "normalizeNewDocumentTitle",
    () => normalizeNewDocumentTitle,
  );
  bindRuntimeValue(
    runtime,
    "createDatabaseDocumentStore",
    () => createDatabaseDocumentStore,
  );
  return () => {
    PlatformDatabaseDocumentStoreConstant = 200;
  };
}
