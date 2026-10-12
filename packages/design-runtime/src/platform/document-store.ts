/** Restored application module; prepare first, initialize in original order. */
import {
  bindRuntimeValue,
  type Dynamic,
  type RuntimeBindings,
} from "../runtime-types";

export function installPlatformDocumentStore(
  runtime: RuntimeBindings,
): () => void {
  function normalizeDocumentSnapshot(
    input?: Dynamic,
    options?: Dynamic,
  ): Dynamic {
    let value: Dynamic =
        typeof input == "object" && input !== null ? input : {},
      value2: Dynamic;
    try {
      value2 = options.parseContent(value.content);
    } catch {
      value2 = options.initialContent;
    }
    return {
      title:
        (0, runtime.normalizeDocumentTitle)(value.title) ??
        options.defaultTitle ??
        "Appifact",
      content: value2,
      comments: (0, runtime.parseDocumentComments)(value.comments),
    };
  }
  function createDocumentStore(options?: Dynamic): Dynamic {
    let value: Dynamic = (0, runtime.getDatabaseRuntimeSnapshot)();
    if (
      value !== undefined &&
      options.publish === undefined &&
      options.canPublish === undefined &&
      options.embeddedState === undefined &&
      options.pageParts === undefined
    )
      return (0, runtime.createDatabaseDocumentStore)({
        runtime: value.runtime,
        snapshot: value.snapshot,
        parseContent: options.parseContent,
        ...(options.serializeContent !== undefined
          ? {
              serializeContent: options.serializeContent,
            }
          : {}),
        ...(options.contentHold !== undefined
          ? {
              contentHold: options.contentHold,
            }
          : {}),
        initialContent: options.initialContent,
        ...(options.defaultTitle !== undefined
          ? {
              defaultTitle: options.defaultTitle,
            }
          : {}),
      });
    let value2: Dynamic =
        options.pageParts ??
        (0, runtime.readCompiledPageParts)((globalThis as Dynamic).document),
      value3: Dynamic =
        options.embeddedState !== undefined
          ? options.embeddedState
          : (0, runtime.readEmbeddedDocument)((globalThis as Dynamic).document),
      value4: Dynamic = options.stash ?? (0, runtime.createDocumentStash)(),
      value5: Dynamic = options.roFlag ?? (0, runtime.createReadOnlyStash)(),
      value6: Dynamic =
        options.canPublish ?? (0, runtime.canRequestPublishCapability)(),
      value7: Dynamic = normalizeDocumentSnapshot(value3, options),
      value8: Dynamic = (0, runtime.hashDocumentState)(
        (0, runtime.safeInlineJson)(value27(value7)),
      ),
      value9: Dynamic = value7,
      items: Dynamic = [],
      flag: Dynamic = false,
      index: Dynamic = 0,
      flag2: Dynamic = false,
      value10: Dynamic,
      value11: Dynamic,
      flag3: Dynamic = false,
      flag4: Dynamic = false,
      value12: Dynamic = options.contentHold?.(value3?.content),
      value13: Dynamic = value12 !== undefined || !value6,
      flag5: Dynamic = false,
      value14: Dynamic =
        value12 ??
        (value6
          ? undefined
          : // CucCut: the host global is designHost.
            "This view\u2019s runtime does not offer self-publish (window.designHost.self is absent) \u2014 content can be viewed but not saved from here.");
    if (!value13) {
      let value36: Dynamic = value5.read();
      value36 !== null &&
        value36.length > 0 &&
        ((value13 = true), (value14 = value36));
    }
    let flag6: Dynamic = false,
      value15: Dynamic,
      flag7: Dynamic = false,
      values: Dynamic = new Set(),
      values2: Dynamic = new Set();
    function value16(): Dynamic {
      if (value13)
        return flag5
          ? {
              status: "readonly",
              message: value14,
              atBoot: true,
            }
          : {
              status: "readonly",
              message: value14,
            };
      let value36: Dynamic = flag2
        ? {
            status: "saving",
          }
        : value10 !== undefined
          ? {
              status: "error",
              message: value10,
              ...(value11 !== undefined
                ? {
                    code: value11,
                  }
                : {}),
            }
          : {
              status: flag ? "dirty" : flag3 ? "saved" : "ready",
            };
      return flag4
        ? {
            ...value36,
            reloading: true,
          }
        : value36;
    }
    function value17(): Dynamic {
      let length: Dynamic = (0, runtime.filterEffectiveCommentOperations)(
        value7.comments,
        items,
      ).length;
      return value13 && length > 0
        ? {
            status: "blocked",
            pending: length,
            message: value14,
          }
        : value15 !== undefined
          ? {
              status: "error",
              pending: length,
              message: value15,
            }
          : flag6 || length > 0
            ? {
                status: "publishing",
                pending: length,
              }
            : {
                status: "idle",
                pending: 0,
              };
    }
    let flag8: Dynamic = false;
    function value18(): Dynamic {
      flag8 && ((flag8 = false), queueMicrotask((): Dynamic => value19()));
    }
    function value19(input?: Dynamic): Dynamic {
      values.size === 0 && (flag8 = true);
      for (let value36 of values as Dynamic) value36(input);
      value20();
    }
    function value20(): Dynamic {
      values2.size === 0 && (flag8 = true);
      let value36: Dynamic = value16();
      for (let value37 of values2 as Dynamic) value37(value36);
    }
    let flag9: Dynamic = true,
      value21: Dynamic,
      value22: Dynamic;
    function value23(): Dynamic {
      let value36: Dynamic = items,
        value37: Dynamic = value21 ? value21.state : value9;
      flag9 = value4.write(
        JSON.stringify({
          v: 2,
          at: value21 ? value21.at : Date.now(),
          state: value37,
          ...(value36.length > 0
            ? {
                ops: value36,
              }
            : {}),
          ...(value22 !== undefined && !value21
            ? {
                expectEmbed: value22,
              }
            : {}),
        }),
      );
      return flag9;
    }
    {
      let value36: Dynamic = (0, runtime.parseDocumentStash)(value4.read());
      if (value36) {
        let value37: Dynamic = normalizeDocumentSnapshot(
            value36.state,
            options,
          ),
          callback: Dynamic = (input?: Dynamic): Dynamic =>
            options.serializeContent !== undefined
              ? options.serializeContent(input.content, input.title)
              : input.content,
          value38: Dynamic = (0, runtime.filterEffectiveCommentOperations)(
            value7.comments,
            (0, runtime.parseCommentOperations)(value36.ops),
          );
        if (value38.length === 0 && value36.ops === undefined) {
          let values3: Dynamic = new Set(
            value7.comments.map((input?: Dynamic): Dynamic => input.id),
          );
          value38 = value37.comments
            .filter((input?: Dynamic): Dynamic => !values3.has(input.id))
            .map(
              (input?: Dynamic): Dynamic => ({
                op: "add",
                comment: input,
              }),
            );
        }
        let value39: Dynamic =
          JSON.stringify({
            t: value37.title,
            c: callback(value37),
          }) ===
          JSON.stringify({
            t: value7.title,
            c: callback(value7),
          });
        items = value38;
        items.length > 0 &&
          (value9 = {
            ...value9,
            comments: (0, runtime.applyCommentOperations)(
              value7.comments,
              items,
            ),
          });
        value39
          ? items.length === 0
            ? value4.clear()
            : value23()
          : value36.expectEmbed === value8
            ? ((value9 = {
                title: value37.title,
                content: value37.content,
                comments: (0, runtime.applyCommentOperations)(
                  value7.comments,
                  items,
                ),
              }),
              (flag = true),
              value23())
            : (value21 = {
                at: value36.at,
                state: value37,
              });
      }
    }
    function value24(input?: Dynamic): Dynamic {
      value13 = true;
      value14 =
        input.code === "not_writer"
          ? runtime.readOnlyDocumentMessage
          : input.code === "consent_required"
            ? "Saving needs the self-publish permission this view declined (or has not answered). Reload and accept the prompt to edit."
            : "This view cannot save: " +
              input.message +
              " (" +
              input.code +
              ")";
      (input.code === "not_writer" ||
        input.code === "not_declared" ||
        input.code === "capability_disabled" ||
        input.code === "capability_removed") &&
        value5.write(value14);
    }
    function value25(input?: Dynamic, options2: Dynamic = false): Dynamic {
      value9 = input;
      flag = true;
      flag3 = false;
      value10 = undefined;
      value11 = undefined;
      options2 || ((value21 = undefined), (0, runtime.recordEdit)());
      value23();
      value19();
    }
    function value26(): Dynamic {
      value9 = {
        ...value9,
        comments: (0, runtime.applyCommentOperations)(value7.comments, items),
      };
      value23();
      value19();
    }
    function value27(input?: Dynamic): Dynamic {
      return options.serializeContent !== undefined
        ? {
            ...input,
            content: options.serializeContent(input.content, input.title),
          }
        : input;
    }
    function value28(input?: Dynamic): Dynamic {
      return (0, runtime.compileArtifactDocument)(
        {
          ...value2,
          title: input.title,
        },
        (0, runtime.safeInlineJson)(value27(input)),
      );
    }
    async function value29(
      input?: Dynamic,
      options2?: Dynamic,
    ): Promise<Dynamic> {
      return (options.publish ?? (0, runtime.requirePublishCapability)())(
        input,
        options2,
      );
    }
    let value30: Dynamic = Promise.resolve();
    function value31(input?: Dynamic): Dynamic {
      let value36: Dynamic = value30.then(input, input);
      value30 = value36.then(
        (): Dynamic => {},
        (): Dynamic => {},
      );
      return value36;
    }
    function value32(): Dynamic {
      if (
        value13 ||
        flag6 ||
        (0, runtime.filterEffectiveCommentOperations)(value7.comments, items)
          .length === 0
      )
        return;
      flag6 = true;
      value15 = undefined;
      value19();
      let flag10: Dynamic = false;
      value31(async (): Promise<Dynamic> => {
        try {
          let value36: Dynamic = (0, runtime.filterEffectiveCommentOperations)(
            value7.comments,
            items,
          );
          if (value36.length === 0) return;
          let state: Dynamic = {
            title: value7.title,
            content: value7.content,
            comments: (0, runtime.applyCommentOperations)(
              value7.comments,
              value36,
            ),
          };
          if (
            JSON.stringify(state.comments) === JSON.stringify(value7.comments)
          ) {
            let values3: Dynamic = new Set(value36);
            items = items.filter(
              (input?: Dynamic): Dynamic => !values3.has(input),
            );
            value9 = {
              ...value9,
              comments: (0, runtime.applyCommentOperations)(
                value7.comments,
                items,
              ),
            };
            value23();
            return;
          }
          let value37: Dynamic = value28(state);
          if (
            new TextEncoder().encode(value37).length >
            runtime.maxCompiledDocumentBytes
          ) {
            value15 =
              "The document is over the 16 MiB limit \u2014 the comment is kept locally but cannot publish until content shrinks.";
            return;
          }
          value22 = (0, runtime.hashDocumentState)(
            (0, runtime.safeInlineJson)(
              value27(
                normalizeDocumentSnapshot(
                  JSON.parse(JSON.stringify(state)),
                  options,
                ),
              ),
            ),
          );
          value23();
          if (flag && !flag9) {
            value22 = undefined;
            value15 =
              "Comment held: you have unsaved edits that could NOT be kept locally (this document is too large to stash), and posting the comment reloads the page. Save your edits first, then retry.";
            return;
          }
          try {
            await value29(value37);
          } catch (value38: Dynamic) {
            if (
              (0, runtime.normalizePublishError)(value38).code !==
              "upstream_error"
            )
              throw value38;
            await new Promise(
              (input?: Dynamic): Dynamic =>
                setTimeout(input, 400 + Math.random() * 1200),
            );
            await value29(value37);
          }
          value7 = state;
          items = (0, runtime.filterEffectiveCommentOperations)(
            value7.comments,
            items,
          );
          value9 = {
            ...value9,
            comments: (0, runtime.applyCommentOperations)(
              value7.comments,
              items,
            ),
          };
          value23();
        } catch (value36: Dynamic) {
          value22 = undefined;
          let value37: Dynamic = (0, runtime.normalizePublishError)(value36);
          value37.code === "conflict"
            ? (flag10 = true)
            : runtime.publishAuthorizationErrorCodes.includes(value37.code)
              ? value24(value37)
              : value37.code === "rate_limited"
                ? ((value15 =
                    "Commenting too frequently \u2014 will retry in a moment."),
                  setTimeout(
                    (): Dynamic => {
                      value15 = undefined;
                      value32();
                    },
                    4e3 + Math.random() * 3e3,
                  ))
                : (value15 =
                    "Comment not published (" +
                    value37.message +
                    ") \u2014 it is kept here; use retry to try again.");
          value23();
        } finally {
          flag6 = false;
          value19();
          !flag10 && value15 === undefined && !value13 && value32();
        }
      });
    }
    async function value33(): Promise<Dynamic> {
      if (value13 || flag2 || !flag) return;
      flag2 = true;
      value10 = undefined;
      value11 = undefined;
      value20();
      let title: Dynamic = value9.title,
        content: Dynamic = value9.content;
      await value31(async (): Promise<Dynamic> => {
        try {
          value23();
          let value36: Dynamic = (0, runtime.filterEffectiveCommentOperations)(
              value7.comments,
              items,
            ),
            state: Dynamic = {
              title: title,
              content: content,
              comments: (0, runtime.applyCommentOperations)(
                value7.comments,
                value36,
              ),
            },
            value37: Dynamic =
              options.publishesPage === false && options.publish !== undefined
                ? ""
                : value28(state),
            length: Dynamic = new TextEncoder().encode(value37).length;
          if (length > runtime.maxCompiledDocumentBytes) {
            value10 =
              "The document is " +
              String(Math.round(length / 1024 / 1024)) +
              " MiB \u2014 over the 16 MiB limit. Remove or shrink images (the usual culprit) and save again.";
            return;
          }
          let value38: Dynamic =
              options.publish !== undefined
                ? {
                    published: value27(state),
                    base: value27(value7),
                  }
                : undefined,
            value39: Dynamic;
          try {
            value39 = await value29(value37, value38);
          } catch (value40: Dynamic) {
            if (
              (0, runtime.normalizePublishError)(value40).code !==
              "upstream_error"
            )
              throw value40;
            await new Promise(
              (input?: Dynamic): Dynamic =>
                setTimeout(input, 400 + Math.random() * 1200),
            );
            value39 = await value29(value37, value38);
          }
          value7 = state;
          items = (0, runtime.filterEffectiveCommentOperations)(
            value7.comments,
            items,
          );
          value9 = {
            ...value9,
            comments: (0, runtime.applyCommentOperations)(
              value7.comments,
              items,
            ),
          };
          value39?.reloads !== false && (flag4 = true);
          value9.title === title && value9.content === content
            ? ((flag = false),
              (flag3 = value39?.reloads !== false),
              items.length === 0 && (value15 = undefined),
              flag3 || value21 || items.length > 0 ? value23() : value4.clear(),
              flag3 || value32())
            : !flag9 &&
              value39?.reloads !== false &&
              (value10 =
                "Saved \u2014 but you kept typing during the save, and those newer changes could NOT be kept locally (this document is too large to stash). Copy anything important now: the page is about to reload to the version without them.");
        } catch (value36: Dynamic) {
          let value37: Dynamic = (0, runtime.normalizePublishError)(value36);
          value11 = value37.code;
          value37.code === "conflict"
            ? (value10 = flag9
                ? "Someone saved a newer version first \u2014 loading it now. Your changes are kept and will be offered for restore."
                : "Someone saved a newer version first \u2014 loading it now. Your changes could NOT be kept locally (this document is too large to stash), so copy anything important before the reload.")
            : runtime.publishAuthorizationErrorCodes.includes(value37.code)
              ? value24(value37)
              : value37.say !== undefined
                ? (value10 = value37.say)
                : value37.code === "rate_limited"
                  ? (value10 =
                      "Not saved (" +
                      value37.message +
                      "). Your changes are kept; give it a moment, then save again.")
                  : value37.code === "invalid_content" ||
                      value37.code === "transform_error"
                    ? (value10 =
                        "The store refused the document (" +
                        value37.code +
                        ": " +
                        value37.message +
                        "). This is usually a content problem \u2014 most often a pasted replacement character (U+FFFD, the question-mark-in-a-box glyph), which the platform rejects; find and remove the odd character, then save again. If the content looks clean, this is an appifact bug.")
                    : value37.code === "too_large"
                      ? (value10 =
                          "The store refused the document as too large (16 MiB limit). Remove or shrink images and save again.")
                      : (value10 =
                          "Saving failed (" +
                          value37.message +
                          "). Your changes are kept \u2014 try again.");
        } finally {
          flag2 = false;
          value19();
        }
      });
    }
    let value34: Dynamic =
        options.canPublish === undefined &&
        (options.publish === undefined || options.publishWrapsFrame === true),
      value35: Dynamic =
        !value13 && value34 && !(0, runtime.hasCachedPublishCapability)()
          ? (0, runtime.getPublishCapability)().then(
              (input?: Dynamic): Dynamic => {
                input !== null ||
                  value13 ||
                  ((value13 = true),
                  (flag5 = !flag),
                  (value14 =
                    "This view can't save: no publish path is available here."),
                  value19());
              },
            )
          : Promise.resolve();
    !value13 &&
      value34 &&
      value35
        .then(
          (): Dynamic =>
            value13
              ? null
              : Promise.all([
                  (0, runtime.awaitCurrentUserCanEdit)(),
                  (0, runtime.getAssetsCapability)(),
                ]),
        )
        .then((input?: Dynamic): Dynamic => {
          input === null ||
            input[0] !== false ||
            input[1] !== null ||
            value13 ||
            ((value13 = true),
            (flag5 = !flag),
            (value14 = runtime.readOnlyDocumentMessage),
            value19());
        });
    value13 || queueMicrotask((): Dynamic => value32());
    return {
      saveMode: (): Dynamic => "manual",
      state: (): Dynamic => value9,
      content: (): Dynamic => value9.content,
      title: (): Dynamic => value9.title,
      comments: (): Dynamic => value9.comments,
      dirty: (): Dynamic => flag,
      readOnly: (): Dynamic => value13,
      saveState: value16,
      commentSync: value17,
      setContent(input: Dynamic): Dynamic {
        input !== value9.content &&
          value25({
            ...value9,
            content: input,
          });
      },
      updateContent(input: Dynamic, options2: Dynamic): Dynamic {
        let value36: Dynamic = input(value9.content);
        value36 !== value9.content &&
          value25(
            {
              ...value9,
              content: value36,
            },
            options2?.auto === true,
          );
      },
      adoptRemote(input: Dynamic): Dynamic {
        let value36: Dynamic = input(value7.content, value9.content);
        (value36.base === value7.content &&
          value36.current === value9.content) ||
          ((value7 = {
            ...value7,
            content: value36.base,
          }),
          (value9 = {
            ...value9,
            content: value36.current,
          }),
          flag &&
            !value36.dirty &&
            value9.title === value7.title &&
            ((flag = false), !value21 && items.length === 0 && value4.clear()),
          flag && value23(),
          value19({
            remote: true,
          }));
      },
      setTitle(input: Dynamic): Dynamic {
        let value36: Dynamic = (0, runtime.normalizeNewDocumentTitle)(input);
        value36.length === 0 ||
          value36 === value9.title ||
          value25({
            ...value9,
            title: value36,
          });
      },
      addComment(input: Dynamic): Dynamic {
        if (value9.comments.length >= runtime.maxDocumentComments) return;
        let value36: Dynamic = (0, runtime.parseDocumentComments)([
          {
            ...input,
            id: crypto.randomUUID().slice(0, 8),
            at: Date.now(),
          },
        ])[0];
        if (value36) {
          items = [
            ...items,
            {
              op: "add",
              comment: value36,
            },
          ];
          value26();
          value32();
          return value36;
        }
      },
      removeComment(input: Dynamic): Dynamic {
        (!items.some(
          (input2?: Dynamic): Dynamic =>
            input2.op === "add" && input2.comment.id === input,
        ) &&
          !value7.comments.some(
            (input2?: Dynamic): Dynamic => input2.id === input,
          )) ||
          ((items = [
            ...items.filter(
              (input2?: Dynamic): Dynamic =>
                !(input2.op === "add" && input2.comment.id === input),
            ),
            {
              op: "remove",
              id: input,
            },
          ]),
          value26(),
          value32());
      },
      pendingCommentIds(): Dynamic {
        let values3: Dynamic = new Set();
        for (let value36 of (0, runtime.filterEffectiveCommentOperations)(
          value7.comments,
          items,
        ) as Dynamic)
          value36.op === "add" && values3.add(value36.comment.id);
        return values3;
      },
      retryCommentPublish(): Dynamic {
        value15 !== undefined && ((value15 = undefined), value32());
      },
      documentBytes(): Dynamic {
        return new TextEncoder().encode(value28(value9)).length;
      },
      save: value33,
      stashOffer: (): Dynamic =>
        value21
          ? {
              at: value21.at,
            }
          : undefined,
      restoreStash(): Dynamic {
        if (!value21) return;
        let value36: Dynamic = value21,
          state: Dynamic = {
            title: value9.title,
            content: value9.content,
          };
        value21 = undefined;
        index += 1;
        value25({
          title: value36.state.title,
          content: value36.state.content,
          comments: (0, runtime.applyCommentOperations)(value7.comments, items),
        });
        return {
          label: "Restore unsaved changes",
          do(): Dynamic {
            value21 = undefined;
            value25({
              title: value36.state.title,
              content: value36.state.content,
              comments: (0, runtime.applyCommentOperations)(
                value7.comments,
                items,
              ),
            });
          },
          undo(): Dynamic {
            value21 = value36;
            value25(
              {
                title: state.title,
                content: state.content,
                comments: (0, runtime.applyCommentOperations)(
                  value7.comments,
                  items,
                ),
              },
              true,
            );
            (0, runtime.recordEdit)();
          },
        };
      },
      restoreCount: (): Dynamic => index,
      discardStash(): Dynamic {
        value21 &&
          ((value21 = undefined),
          items.length === 0 ? value4.clear() : value23(),
          value19());
      },
      subscribe(input: Dynamic): Dynamic {
        values.add(input);
        value18();
        return (): Dynamic => values.delete(input);
      },
      subscribeSave(input: Dynamic): Dynamic {
        values2.add(input);
        value18();
        return (): Dynamic => values2.delete(input);
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "normalizeDocumentSnapshot",
    () => normalizeDocumentSnapshot,
  );
  bindRuntimeValue(runtime, "createDocumentStore", () => createDocumentStore);
  return () => {};
}
