import type * as Host from "../contracts/platform-host";
import type * as React from "react";
/** Restored application module; prepare first, initialize in original order. */
import { bindRuntimeValue, type RuntimeBindings } from "../runtime-types";
export function installDocumentsStorage(runtime: RuntimeBindings): () => void {
  var READ_ONLY_ARTIFACT_MESSAGE: string;
  var ARTIFACT_STASH_PREFIX: string;
  var ARTIFACT_READ_ONLY_PREFIX: string;
  function artifactStashKey(input: string): string {
    return (
      ARTIFACT_STASH_PREFIX + (0, runtime.normalizeArtifactSessionPath)(input)
    );
  }
  function createSessionStorageSlot(key: string): Host.StorageSlot {
    return {
      read() {
        try {
          return sessionStorage.getItem(key);
        } catch {
          return null;
        }
      },
      write(input): boolean {
        try {
          sessionStorage.setItem(key, input);
          return true;
        } catch {
          return false;
        }
      },
      clear(): void {
        try {
          sessionStorage.removeItem(key);
        } catch {}
      },
    };
  }
  function currentArtifactStash(): Host.StorageSlot {
    return createSessionStorageSlot(artifactStashKey(location.pathname));
  }
  function createArtifactLocalFlag(flagName: string): Host.StorageSlot {
    if (typeof location === "undefined") {
      return {
        read: (): null => null,
        write: (): boolean => false,
        clear: (): void => {
          return;
        },
      };
    }
    return createSessionStorageSlot(
      "appifact-" +
        flagName +
        "/" +
        (0, runtime.normalizeArtifactSessionPath)(location.pathname),
    );
  }
  function readCurrentArtifactReadOnlyReason(): string | null {
    let value = currentArtifactReadOnlySlot().read();
    if (value !== null && value.length > 0) {
      return value;
    } else {
      return null;
    }
  }
  function currentArtifactReadOnlySlot(): Host.StorageSlot {
    if (typeof location === "undefined") {
      return {
        read: (): null => null,
        write: (): boolean => false,
        clear: (): void => {
          return;
        },
      };
    }
    return createSessionStorageSlot(
      ARTIFACT_READ_ONLY_PREFIX +
        artifactStashKey(location.pathname).slice(ARTIFACT_STASH_PREFIX.length),
    );
  }
  function hashArtifactState(text: string): string {
    let firstHash: number = 3735928559,
      secondHash: number = 1103547991;
    for (let index: number = 0; index < text.length; index++) {
      let value = text.charCodeAt(index);
      firstHash = Math.imul(firstHash ^ value, 2654435761);
      secondHash = Math.imul(secondHash ^ value, 1597334677);
    }
    firstHash =
      Math.imul(firstHash ^ (firstHash >>> 16), 2246822507) ^
      Math.imul(secondHash ^ (secondHash >>> 13), 3266489909);
    secondHash =
      Math.imul(secondHash ^ (secondHash >>> 16), 2246822507) ^
      Math.imul(firstHash ^ (firstHash >>> 13), 3266489909);
    return (
      (secondHash >>> 0).toString(16).padStart(8, "0") +
      (firstHash >>> 0).toString(16).padStart(8, "0")
    );
  }
  function parseArtifactStash(
    text: string | null,
  ): Host.ParsedStash | undefined {
    if (text === null) {
      return;
    }
    try {
      let value = JSON.parse(text) as Record<string, unknown> | null;
      if (
        typeof value === "object" &&
        value !== null &&
        (value.v === 2 || value.v === 1) &&
        typeof value.at === "number" &&
        "state" in value
      ) {
        let value2 = value;
        return {
          at: value2.at as number,
          state: value2.state,
          ops: value2.ops,
          expectEmbed:
            typeof value2.expectEmbed === "string"
              ? value2.expectEmbed
              : undefined,
        };
      }
    } catch {}
    return;
  }
  function parseEmbeddedArtifactState<Content>(
    state: unknown,
    options: Host.ArtifactParser<Content>,
  ): Host.ArtifactEnvelope<Content> {
    let record =
        typeof state === "object" && state !== null
          ? (state as Record<string, unknown>)
          : {},
      content: Content;
    try {
      content = options.parseContent(record.content);
    } catch {
      content = options.initialContent;
    }
    return {
      title:
        (0, runtime.normalizeArtifactTitle)(record.title) ??
        options.defaultTitle ??
        "Appifact",
      content: content,
      comments: (0, runtime.normalizeComments)(record.comments),
    };
  }
  function createArtifactDocument<Content>(
    options: Host.DocumentOptions<Content>,
  ): Host.ArtifactDocument<Content> {
    let autoSaveRuntime = (0, runtime.getAutoSavingArtifactRuntime)();
    if (
      autoSaveRuntime !== undefined &&
      options.publish === undefined &&
      options.canPublish === undefined &&
      options.embeddedState === undefined &&
      options.pageParts === undefined
    ) {
      return (0, runtime.createRuntimeArtifactDocument)({
        runtime: autoSaveRuntime.runtime,
        snapshot: autoSaveRuntime.snapshot,
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
    }
    let pageParts =
        options.pageParts ??
        (0, runtime.readCompiledPageAnatomy)(
          (globalThis as typeof globalThis & { document: Document }).document,
        ),
      embeddedState =
        options.embeddedState !== undefined
          ? options.embeddedState
          : (0, runtime.readCompiledPageDocument)(
              (globalThis as typeof globalThis & { document: Document })
                .document,
            ),
      stash = options.stash ?? currentArtifactStash(),
      readOnlyFlag = options.roFlag ?? currentArtifactReadOnlySlot(),
      canPublish = options.canPublish ?? (0, runtime.selfPublishAvailable)(),
      publishedState = parseEmbeddedArtifactState(embeddedState, options),
      embeddedStateHash = hashArtifactState(
        (0, runtime.stringifyInlineJson)(serializeEnvelope(publishedState)),
      ),
      localState = publishedState,
      pendingCommentOperations: Host.CommentOperation[] = [],
      dirty: boolean = false,
      restoreCount = 0,
      saving: boolean = false,
      saveError: string | undefined,
      saveErrorCode: string | undefined,
      hasSaved: boolean = false,
      reloading: boolean = false,
      contentHoldReason = options.contentHold?.(
        (embeddedState as { content?: unknown } | undefined)?.content,
      ),
      readOnly = contentHoldReason !== undefined || !canPublish,
      readOnlyAtBoot: boolean = false,
      readOnlyReason =
        contentHoldReason ??
        (canPublish
          ? undefined
          : // CucCut: the host global is designSystemHost, not claude.
            "This view’s runtime does not offer self-publish (window." +
            "designSystemHost.self is absent) — content can be viewed but not saved " +
            "from here.");
    if (!readOnly) {
      let value = readOnlyFlag.read();
      if (value !== null && value.length > 0) {
        readOnly = true;
        readOnlyReason = value;
      }
    }
    let publishingComments: boolean = false,
      commentPublishError: string | undefined,
      flag: boolean = false,
      documentSubscribers = new Set<(event?: { remote: boolean }) => void>(),
      saveSubscribers = new Set<(state: Host.SaveState) => void>();
    function getSaveState(): Host.SaveState {
      if (readOnly) {
        if (readOnlyAtBoot) {
          return {
            status: "readonly",
            message: readOnlyReason,
            atBoot: true,
          };
        } else {
          return {
            status: "readonly",
            message: readOnlyReason,
          };
        }
      }
      let value: Host.SaveState = saving
        ? {
            status: "saving",
          }
        : saveError !== undefined
          ? {
              status: "error",
              message: saveError,
              ...(saveErrorCode !== undefined
                ? {
                    code: saveErrorCode,
                  }
                : {}),
            }
          : {
              status: dirty ? "dirty" : hasSaved ? "saved" : "ready",
            };
      if (reloading) {
        return {
          ...value,
          reloading: true,
        };
      } else {
        return value;
      }
    }
    function getCommentSyncState(): Host.CommentSync {
      let length = (0, runtime.applicableCommentOperations)(
        publishedState.comments,
        pendingCommentOperations,
      ).length;
      if (readOnly && length > 0) {
        return {
          status: "blocked",
          pending: length,
          message: readOnlyReason,
        };
      }
      if (commentPublishError !== undefined) {
        return {
          status: "error",
          pending: length,
          message: commentPublishError,
        };
      }
      if (publishingComments || length > 0) {
        return {
          status: "publishing",
          pending: length,
        };
      }
      return {
        status: "idle",
        pending: 0,
      };
    }
    let notificationOwed: boolean = false;
    function flushOwedNotification(): void {
      if (!notificationOwed) {
        return;
      }
      notificationOwed = false;
      queueMicrotask(() => notifyDocumentSubscribers());
    }
    function notifyDocumentSubscribers(input?: { remote: boolean }): void {
      if (documentSubscribers.size === 0) {
        notificationOwed = true;
      }
      for (let value of documentSubscribers) {
        value(input);
      }
      notifySaveSubscribers();
    }
    function notifySaveSubscribers(): void {
      if (saveSubscribers.size === 0) {
        notificationOwed = true;
      }
      let value = getSaveState();
      for (let value2 of saveSubscribers) {
        value2(value);
      }
    }
    let stashWriteSucceeded = true,
      stashOffer:
        | { at: number; state: Host.ArtifactEnvelope<Content> }
        | undefined,
      expectedEmbeddedStateHash: string | undefined;
    function writeStash(): boolean {
      let value = pendingCommentOperations,
        value2 = stashOffer ? stashOffer.state : localState;
      stashWriteSucceeded = stash.write(
        JSON.stringify({
          v: 2,
          at: stashOffer ? stashOffer.at : Date.now(),
          state: value2,
          ...(value.length > 0
            ? {
                ops: value,
              }
            : {}),
          ...(expectedEmbeddedStateHash !== undefined && !stashOffer
            ? {
                expectEmbed: expectedEmbeddedStateHash,
              }
            : {}),
        }),
      );
      return stashWriteSucceeded;
    }
    {
      let value = parseArtifactStash(stash.read());
      if (value) {
        let value2 = parseEmbeddedArtifactState(value.state, options),
          callback = (input: Host.ArtifactEnvelope<Content>) =>
            options.serializeContent !== undefined
              ? options.serializeContent(input.content, input.title)
              : input.content,
          value3 = (0, runtime.applicableCommentOperations)(
            publishedState.comments,
            (0, runtime.normalizeCommentOperations)(value.ops),
          );
        if (value3.length === 0 && value.ops === undefined) {
          let values = new Set(
            publishedState.comments.map((input) => input.id),
          );
          value3 = value2.comments
            .filter((input): boolean => !values.has(input.id))
            .map((input) => ({
              op: "add",
              comment: input,
            }));
        }
        let value4: boolean =
          JSON.stringify({
            t: value2.title,
            c: callback(value2),
          }) ===
          JSON.stringify({
            t: publishedState.title,
            c: callback(publishedState),
          });
        pendingCommentOperations = value3;
        if (pendingCommentOperations.length > 0) {
          localState = {
            ...localState,
            comments: (0, runtime.applyCommentOperations)(
              publishedState.comments,
              pendingCommentOperations,
            ),
          };
        }
        if (value4) {
          if (pendingCommentOperations.length === 0) {
            stash.clear();
          } else {
            writeStash();
          }
        } else if (value.expectEmbed === embeddedStateHash) {
          localState = {
            title: value2.title,
            content: value2.content,
            comments: (0, runtime.applyCommentOperations)(
              publishedState.comments,
              pendingCommentOperations,
            ),
          };
          dirty = true;
          writeStash();
        } else {
          stashOffer = {
            at: value.at,
            state: value2,
          };
        }
      }
    }
    function markReadOnlyFromError(input: Host.PublishError): void {
      readOnly = true;
      readOnlyReason =
        input.code === "not_writer"
          ? READ_ONLY_ARTIFACT_MESSAGE
          : input.code === "consent_required"
            ? "Saving needs the self-publish permission this view declined (or has not answered). Reload and accept the prompt to edit."
            : "This view cannot save: " +
              input.message +
              " (" +
              input.code +
              ")";
      if (
        input.code === "not_writer" ||
        input.code === "not_declared" ||
        input.code === "capability_disabled" ||
        input.code === "capability_removed"
      ) {
        readOnlyFlag.write(readOnlyReason);
      }
    }
    function updateLocalState(
      input: Host.ArtifactEnvelope<Content>,
      options2: boolean = false,
    ): void {
      localState = input;
      dirty = true;
      hasSaved = false;
      saveError = undefined;
      saveErrorCode = undefined;
      if (!options2) {
        stashOffer = undefined;
        (0, runtime.recordArtifactEdit)();
      }
      writeStash();
      notifyDocumentSubscribers();
    }
    function recomposeComments(): void {
      localState = {
        ...localState,
        comments: (0, runtime.applyCommentOperations)(
          publishedState.comments,
          pendingCommentOperations,
        ),
      };
      writeStash();
      notifyDocumentSubscribers();
    }
    function serializeEnvelope(
      input: Host.ArtifactEnvelope<Content>,
    ): Host.ArtifactEnvelope<unknown> {
      if (options.serializeContent !== undefined) {
        return {
          ...input,
          content: options.serializeContent(input.content, input.title),
        };
      } else {
        return input;
      }
    }
    function buildPublishedPage(input: Host.ArtifactEnvelope<Content>): string {
      return (0, runtime.assembleCompiledPage)(
        {
          ...pageParts,
          title: input.title,
        },
        (0, runtime.stringifyInlineJson)(serializeEnvelope(input)),
      );
    }
    async function publishPage(
      input: string,
      options2?: {
        published: Host.ArtifactEnvelope<unknown>;
        base: Host.ArtifactEnvelope<unknown>;
      },
    ): Promise<Host.PublishResult | undefined> {
      return (options.publish ?? (0, runtime.createSelfPublisher)())(
        input,
        options2,
      );
    }
    let publishChain: Promise<void> = Promise.resolve();
    function serializePublish<Result>(
      input: () => Promise<Result>,
    ): Promise<Result> {
      let value = publishChain.then(input, input);
      publishChain = value.then(
        (): void => {
          return;
        },
        (): void => {
          return;
        },
      );
      return value;
    }
    function publishPendingComments(): void {
      if (readOnly || publishingComments) {
        return;
      }
      if (
        (0, runtime.applicableCommentOperations)(
          publishedState.comments,
          pendingCommentOperations,
        ).length === 0
      ) {
        return;
      }
      publishingComments = true;
      commentPublishError = undefined;
      notifyDocumentSubscribers();
      let flag2: boolean = false;
      serializePublish(async (): Promise<void> => {
        try {
          let value = (0, runtime.applicableCommentOperations)(
            publishedState.comments,
            pendingCommentOperations,
          );
          if (value.length === 0) {
            return;
          }
          let state = {
            title: publishedState.title,
            content: publishedState.content,
            comments: (0, runtime.applyCommentOperations)(
              publishedState.comments,
              value,
            ),
          };
          if (
            JSON.stringify(state.comments) ===
            JSON.stringify(publishedState.comments)
          ) {
            let values = new Set(value);
            pendingCommentOperations = pendingCommentOperations.filter(
              (input): boolean => !values.has(input),
            );
            localState = {
              ...localState,
              comments: (0, runtime.applyCommentOperations)(
                publishedState.comments,
                pendingCommentOperations,
              ),
            };
            writeStash();
            return;
          }
          let value2 = buildPublishedPage(state);
          if (
            new TextEncoder().encode(value2).length >
            runtime.compiledPageMaxBytes
          ) {
            commentPublishError =
              "The document is over the 16 MiB limit — the comment is " +
              "kept locally but cannot publish until content shrinks.";
            return;
          }
          expectedEmbeddedStateHash = hashArtifactState(
            (0, runtime.stringifyInlineJson)(
              serializeEnvelope(
                parseEmbeddedArtifactState(
                  JSON.parse(JSON.stringify(state)),
                  options,
                ),
              ),
            ),
          );
          writeStash();
          if (dirty && !stashWriteSucceeded) {
            expectedEmbeddedStateHash = undefined;
            commentPublishError =
              "Comment held: you have unsaved edits that could NOT be kept locally (this document is too large to stash), and posting the comment reloads the page. Save your edits first, then retry.";
            return;
          }
          try {
            await publishPage(value2);
          } catch (value3: unknown) {
            if (
              (0, runtime.normalizeSelfPublishError)(value3).code !==
              "upstream_error"
            ) {
              throw value3;
            }
            await new Promise((input) =>
              setTimeout(input, 400 + Math.random() * 1200),
            );
            await publishPage(value2);
          }
          publishedState = state;
          pendingCommentOperations = (0, runtime.applicableCommentOperations)(
            publishedState.comments,
            pendingCommentOperations,
          );
          localState = {
            ...localState,
            comments: (0, runtime.applyCommentOperations)(
              publishedState.comments,
              pendingCommentOperations,
            ),
          };
          writeStash();
        } catch (value: unknown) {
          expectedEmbeddedStateHash = undefined;
          let value2 = (0, runtime.normalizeSelfPublishError)(value);
          if (value2.code === "conflict") {
            flag2 = true;
          } else if (
            runtime.SELF_PUBLISH_PERMISSION_ERROR_CODES.includes(value2.code)
          ) {
            markReadOnlyFromError(value2);
          } else if (value2.code === "rate_limited") {
            commentPublishError =
              "Commenting too frequently — will retry in a moment.";
            setTimeout(
              (): void => {
                commentPublishError = undefined;
                publishPendingComments();
              },
              4000 + Math.random() * 3000,
            );
          } else {
            commentPublishError =
              "Comment not published (" +
              value2.message +
              ") — it is kept here; use retry to try again.";
          }
          writeStash();
        } finally {
          publishingComments = false;
          notifyDocumentSubscribers();
          if (!flag2 && commentPublishError === undefined && !readOnly) {
            publishPendingComments();
          }
        }
      });
    }
    async function save(): Promise<void> {
      if (readOnly || saving || !dirty) {
        return;
      }
      saving = true;
      saveError = undefined;
      saveErrorCode = undefined;
      notifySaveSubscribers();
      let { title: value, content: value2 } = localState;
      await serializePublish(async (): Promise<void> => {
        try {
          writeStash();
          let value3 = (0, runtime.applicableCommentOperations)(
              publishedState.comments,
              pendingCommentOperations,
            ),
            state = {
              title: value,
              content: value2,
              comments: (0, runtime.applyCommentOperations)(
                publishedState.comments,
                value3,
              ),
            },
            value4 =
              options.publishesPage === false && options.publish !== undefined
                ? ""
                : buildPublishedPage(state),
            length = new TextEncoder().encode(value4).length;
          if (length > runtime.compiledPageMaxBytes) {
            saveError =
              "The document is " +
              String(Math.round(length / 1024 / 1024)) +
              " MiB — over the 16 MiB limit. Remove or shrink images " +
              "(the usual culprit) and save again.";
            return;
          }
          let value5 =
              options.publish !== undefined
                ? {
                    published: serializeEnvelope(state),
                    base: serializeEnvelope(publishedState),
                  }
                : undefined,
            value6: Host.PublishResult | undefined;
          try {
            value6 = await publishPage(value4, value5);
          } catch (value7: unknown) {
            if (
              (0, runtime.normalizeSelfPublishError)(value7).code !==
              "upstream_error"
            ) {
              throw value7;
            }
            await new Promise((input) =>
              setTimeout(input, 400 + Math.random() * 1200),
            );
            value6 = await publishPage(value4, value5);
          }
          publishedState = state;
          pendingCommentOperations = (0, runtime.applicableCommentOperations)(
            publishedState.comments,
            pendingCommentOperations,
          );
          localState = {
            ...localState,
            comments: (0, runtime.applyCommentOperations)(
              publishedState.comments,
              pendingCommentOperations,
            ),
          };
          if (value6?.reloads !== false) {
            reloading = true;
          }
          if (localState.title === value && localState.content === value2) {
            dirty = false;
            hasSaved = value6?.reloads !== false;
            if (pendingCommentOperations.length === 0) {
              commentPublishError = undefined;
            }
            if (hasSaved || stashOffer || pendingCommentOperations.length > 0) {
              writeStash();
            } else {
              stash.clear();
            }
            if (!hasSaved) {
              publishPendingComments();
            }
          } else if (!stashWriteSucceeded && value6?.reloads !== false) {
            saveError =
              "Saved — but you kept typing during the save, and those newer " +
              "changes could NOT be kept locally (this document is too large to stash). Copy anything important now: the page is about to reload to the version without them.";
          }
        } catch (value3: unknown) {
          let value4 = (0, runtime.normalizeSelfPublishError)(value3);
          saveErrorCode = value4.code;
          if (value4.code === "conflict") {
            saveError = stashWriteSucceeded
              ? "Someone saved a newer version first — loading it now. Your " +
                "changes are kept and will be offered for restore."
              : "Someone saved a newer version first — loading it now. Your " +
                "changes could NOT be kept locally (this document is too large to stash), so copy anything important before the reload.";
          } else if (
            runtime.SELF_PUBLISH_PERMISSION_ERROR_CODES.includes(value4.code)
          ) {
            markReadOnlyFromError(value4);
          } else if (value4.say !== undefined) {
            saveError = value4.say;
          } else if (value4.code === "rate_limited") {
            saveError =
              "Not saved (" +
              value4.message +
              "). Your changes are kept; give it a moment, then save again.";
          } else if (
            value4.code === "invalid_content" ||
            value4.code === "transform_error"
          ) {
            saveError =
              "The store refused the document (" +
              value4.code +
              ": " +
              value4.message +
              "). This is usually a content problem — most often a pasted " +
              "replacement character (U+FFFD, the question-mark-in-a-box glyph), which the platform rejects; find and remove the odd character, then save again. If the content looks clean, this is an appifact bug.";
          } else if (value4.code === "too_large") {
            saveError =
              "The store refused the document as too large (16 MiB limit). Remove or shrink images and save again.";
          } else {
            saveError =
              "Saving failed (" +
              value4.message +
              "). Your changes are kept — " +
              "try again.";
          }
        } finally {
          saving = false;
          notifyDocumentSubscribers();
        }
      });
    }
    let canCheckLiveState =
        options.canPublish === undefined &&
        (options.publish === undefined || options.publishWrapsFrame === true),
      selfCapabilityReady =
        !readOnly && canCheckLiveState && !(0, runtime.selfPublishInstalled)()
          ? (0, runtime.getSelfPublishCapability)().then(
              (input: Host.SelfCapability | null): void => {
                if (input !== null || readOnly) {
                  return;
                }
                readOnly = true;
                readOnlyAtBoot = !dirty;
                readOnlyReason =
                  "This view can't save: no publish path is available here.";
                notifyDocumentSubscribers();
              },
            )
          : Promise.resolve();
    if (!readOnly && canCheckLiveState) {
      selfCapabilityReady
        .then(() =>
          readOnly
            ? null
            : Promise.all([
                (0, runtime.currentUserCanEditAsync)(),
                (0, runtime.getAssetsCapability)(),
              ]),
        )
        .then(
          (
            input:
              | [boolean | null | undefined, Host.AssetsCapability | null]
              | null,
          ): void => {
            if (
              input === null ||
              input[0] !== false ||
              input[1] !== null ||
              readOnly
            ) {
              return;
            }
            readOnly = true;
            readOnlyAtBoot = !dirty;
            readOnlyReason = READ_ONLY_ARTIFACT_MESSAGE;
            notifyDocumentSubscribers();
          },
        );
    }
    if (!readOnly) {
      queueMicrotask(() => publishPendingComments());
    }
    return {
      saveMode: (): "manual" => "manual",
      state: () => localState,
      content: () => localState.content,
      title: () => localState.title,
      comments: () => localState.comments,
      dirty: (): boolean => dirty,
      readOnly: () => readOnly,
      saveState: getSaveState,
      commentSync: getCommentSyncState,
      setContent(input): void {
        if (input === localState.content) {
          return;
        }
        updateLocalState({
          ...localState,
          content: input,
        });
      },
      updateContent(input, options2): void {
        let value = input(localState.content);
        if (value === localState.content) {
          return;
        }
        updateLocalState(
          {
            ...localState,
            content: value,
          },
          options2?.auto === true,
        );
      },
      adoptRemote(input): void {
        let value = input(publishedState.content, localState.content);
        if (
          value.base === publishedState.content &&
          value.current === localState.content
        ) {
          return;
        }
        publishedState = {
          ...publishedState,
          content: value.base,
        };
        localState = {
          ...localState,
          content: value.current,
        };
        if (
          dirty &&
          !value.dirty &&
          localState.title === publishedState.title
        ) {
          dirty = false;
          if (!stashOffer && pendingCommentOperations.length === 0) {
            stash.clear();
          }
        }
        if (dirty) {
          writeStash();
        }
        notifyDocumentSubscribers({
          remote: true,
        });
      },
      setTitle(input): void {
        let value = (0, runtime.normalizeTitleInput)(input);
        if (value.length === 0 || value === localState.title) {
          return;
        }
        updateLocalState({
          ...localState,
          title: value,
        });
      },
      addComment(input) {
        if (localState.comments.length >= runtime.MAX_ARTIFACT_COMMENTS) {
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
        pendingCommentOperations = [
          ...pendingCommentOperations,
          {
            op: "add",
            comment: value,
          },
        ];
        recomposeComments();
        publishPendingComments();
        return value;
      },
      removeComment(input): void {
        if (
          !pendingCommentOperations.some(
            (input2) => input2.op === "add" && input2.comment.id === input,
          ) &&
          !publishedState.comments.some(
            (input2): boolean => input2.id === input,
          )
        ) {
          return;
        }
        pendingCommentOperations = [
          ...pendingCommentOperations.filter(
            (input2): boolean =>
              !(input2.op === "add" && input2.comment.id === input),
          ),
          {
            op: "remove",
            id: input,
          },
        ];
        recomposeComments();
        publishPendingComments();
      },
      pendingCommentIds() {
        let values = new Set<string>();
        for (let value of (0, runtime.applicableCommentOperations)(
          publishedState.comments,
          pendingCommentOperations,
        )) {
          if (value.op === "add") {
            values.add(value.comment.id);
          }
        }
        return values;
      },
      retryCommentPublish(): void {
        if (commentPublishError === undefined) {
          return;
        }
        commentPublishError = undefined;
        publishPendingComments();
      },
      documentBytes() {
        return new TextEncoder().encode(buildPublishedPage(localState)).length;
      },
      save: save,
      stashOffer: () =>
        stashOffer
          ? {
              at: stashOffer.at,
            }
          : undefined,
      restoreStash() {
        if (!stashOffer) {
          return;
        }
        let value = stashOffer,
          state = {
            title: localState.title,
            content: localState.content,
          };
        stashOffer = undefined;
        restoreCount += 1;
        updateLocalState({
          title: value.state.title,
          content: value.state.content,
          comments: (0, runtime.applyCommentOperations)(
            publishedState.comments,
            pendingCommentOperations,
          ),
        });
        return {
          label: "Restore unsaved changes",
          do(): void {
            stashOffer = undefined;
            updateLocalState({
              title: value.state.title,
              content: value.state.content,
              comments: (0, runtime.applyCommentOperations)(
                publishedState.comments,
                pendingCommentOperations,
              ),
            });
          },
          undo(): void {
            stashOffer = value;
            updateLocalState(
              {
                title: state.title,
                content: state.content,
                comments: (0, runtime.applyCommentOperations)(
                  publishedState.comments,
                  pendingCommentOperations,
                ),
              },
              true,
            );
            (0, runtime.recordArtifactEdit)();
          },
        };
      },
      restoreCount: () => restoreCount,
      discardStash(): void {
        if (!stashOffer) {
          return;
        }
        stashOffer = undefined;
        if (pendingCommentOperations.length === 0) {
          stash.clear();
        } else {
          writeStash();
        }
        notifyDocumentSubscribers();
      },
      subscribe(input) {
        documentSubscribers.add(input);
        flushOwedNotification();
        return () => documentSubscribers.delete(input);
      },
      subscribeSave(input) {
        saveSubscribers.add(input);
        flushOwedNotification();
        return () => saveSubscribers.delete(input);
      },
    };
  }
  bindRuntimeValue(
    runtime,
    "READ_ONLY_ARTIFACT_MESSAGE",
    () => READ_ONLY_ARTIFACT_MESSAGE,
    (value) => {
      READ_ONLY_ARTIFACT_MESSAGE = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ARTIFACT_STASH_PREFIX",
    () => ARTIFACT_STASH_PREFIX,
    (value) => {
      ARTIFACT_STASH_PREFIX = value;
    },
  );
  bindRuntimeValue(
    runtime,
    "ARTIFACT_READ_ONLY_PREFIX",
    () => ARTIFACT_READ_ONLY_PREFIX,
    (value) => {
      ARTIFACT_READ_ONLY_PREFIX = value;
    },
  );
  bindRuntimeValue(runtime, "artifactStashKey", () => artifactStashKey);
  bindRuntimeValue(
    runtime,
    "createSessionStorageSlot",
    () => createSessionStorageSlot,
  );
  bindRuntimeValue(runtime, "currentArtifactStash", () => currentArtifactStash);
  bindRuntimeValue(
    runtime,
    "createArtifactLocalFlag",
    () => createArtifactLocalFlag,
  );
  bindRuntimeValue(
    runtime,
    "readCurrentArtifactReadOnlyReason",
    () => readCurrentArtifactReadOnlyReason,
  );
  bindRuntimeValue(
    runtime,
    "currentArtifactReadOnlySlot",
    () => currentArtifactReadOnlySlot,
  );
  bindRuntimeValue(runtime, "hashArtifactState", () => hashArtifactState);
  bindRuntimeValue(runtime, "parseArtifactStash", () => parseArtifactStash);
  bindRuntimeValue(
    runtime,
    "parseEmbeddedArtifactState",
    () => parseEmbeddedArtifactState,
  );
  bindRuntimeValue(
    runtime,
    "createArtifactDocument",
    () => createArtifactDocument,
  );
  return () => {
    READ_ONLY_ARTIFACT_MESSAGE =
      "You can view this artifact but not edit it. Saving needs write access from an owner.";
    ARTIFACT_STASH_PREFIX = "appifact-stash/";
    ARTIFACT_READ_ONLY_PREFIX = "appifact-ro/";
  };
}
